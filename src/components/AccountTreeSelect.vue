<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ListFilter, Search, X } from 'lucide-vue-next'

import { loadAccountSelectionOptions } from '@/api/selectionOptions'
import { useAuthStore } from '@/stores/auth'
import type { AnyRecord } from '@/types/api'
import { statusLabel, statusTagType } from '@/utils/format'
import {
  buildUserPreferenceKey,
  readStringListPreference,
  writeStringListPreference,
} from '@/utils/localPreferences'

const props = defineProps<{
  modelValue: unknown
  disabled?: boolean
  filters?: AnyRecord
  multiple?: boolean
  associationOnly?: boolean
  groupByDevice?: boolean
  groupFilterPreferenceKey?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | string[]]
}>()

interface AccountTreeNode {
  id: string
  accountId?: string
  label: string
  searchText?: string
  deviceLabel?: string
  loginStatus?: string
  disabled?: boolean
  children?: AccountTreeNode[]
}

const treeRef = ref()
const auth = useAuthStore()
const loading = ref(false)
const searchKeyword = ref('')
const treeData = ref<AccountTreeNode[]>([])
const selectedGroupNodeIds = ref<string[]>([])
const loggedInCount = ref(0)
const selectableCount = ref(0)
const treeProps = {
  label: 'label',
  children: 'children',
  disabled: 'disabled',
  value: 'id',
}
const treeHeight = 350

const isMultiple = computed(() => props.multiple !== false)
const groupFilterEnabled = computed(() => Boolean(props.groupFilterPreferenceKey))
const groupFilterStorageKey = computed(() => buildUserPreferenceKey(
  auth.user?.id,
  props.groupFilterPreferenceKey,
))
const groupOptions = computed(() => treeData.value.map((node) => ({
  value: node.id,
  label: node.label,
})))
const visibleTreeData = computed(() => {
  if (!selectedGroupNodeIds.value.length) return treeData.value
  const selectedIds = new Set(selectedGroupNodeIds.value)
  return treeData.value.filter((node) => selectedIds.has(node.id))
})
const groupFilterLabel = computed(() => selectedGroupNodeIds.value.length
  ? `已筛 ${selectedGroupNodeIds.value.length} 组`
  : '筛选分组')
const selectedAccountIds = computed(() => {
  if (Array.isArray(props.modelValue)) return props.modelValue.filter(Boolean).map(String)
  return props.modelValue ? [String(props.modelValue)] : []
})
const filterSignature = computed(() => JSON.stringify({
  association_only: Boolean(props.associationOnly),
  group_by_device: Boolean(props.groupByDevice),
  business_platform: String(props.filters?.business_platform || ''),
  runtime_platform: String(props.filters?.runtime_platform || ''),
  provider: String(props.filters?.provider || ''),
  exclude_account_id: String(props.filters?.exclude_account_id || ''),
}))
let loadRequestId = 0
const emptyMessage = computed(() => {
  if (props.associationOnly) {
    return loggedInCount.value === 0 ? '当前业务 App 暂无可关联账号' : ''
  }
  const filters = props.filters || {}
  const hasRuntimeFilter = Boolean(filters.runtime_platform || filters.provider)
  if (loggedInCount.value === 0) {
    return hasRuntimeFilter
      ? '当前业务 App 在该执行平台/供应商下暂无已登录账号'
      : '当前业务 App 暂无已登录账号'
  }
  if (selectableCount.value === 0) {
    return hasRuntimeFilter
      ? '当前业务 App 在该执行平台/供应商下的已登录账号都未绑定可用设备，暂时不能下发任务'
      : '当前业务 App 的已登录账号都未绑定设备，暂时不能下发任务'
  }
  return ''
})
const treeEmptyMessage = computed(() => {
  if (selectedGroupNodeIds.value.length && !visibleTreeData.value.length) {
    return props.groupByDevice ? '所选设备分组暂无符合条件的账号' : '所选账号分组暂无符合条件的账号'
  }
  return emptyMessage.value || '暂无已登录账号'
})

function loadGroupFilterPreference() {
  selectedGroupNodeIds.value = groupFilterStorageKey.value
    ? readStringListPreference(localStorage, groupFilterStorageKey.value)
    : []
}

function clearGroupFilter() {
  selectedGroupNodeIds.value = []
}

function accountNodeId(accountId: string) {
  return `account:${accountId}`
}

function accountMatchesRuntime(account: AnyRecord) {
  const filters = props.filters || {}
  if (filters.exclude_account_id && String(account.id) === String(filters.exclude_account_id)) return false
  if (props.associationOnly) return true
  if (filters.runtime_platform && account.bound_slot_runtime_platform !== filters.runtime_platform) return false
  if (filters.provider && account.bound_slot_provider !== filters.provider) return false
  return true
}

function accountLabel(account: AnyRecord) {
  return String(
    account.login_username
      || account.username
      || account.display_name
      || account.platform_account_id
      || account.id,
  )
}

function compactStatusLabel(status: unknown) {
  return String(status || '') === 'logged_in_dm_unavailable'
    ? '私信不可用'
    : statusLabel(status)
}

function toAccountNode(account: AnyRecord): AccountTreeNode {
  const label = accountLabel(account)
  const providerSlotId = String(account.bound_slot_provider_id || '')
  const slotName = String(account.bound_slot_name || '')
  const hasSlot = Boolean(account.bound_slot_id)
  const selectable = props.associationOnly || hasSlot
  return {
    id: accountNodeId(String(account.id)),
    accountId: String(account.id),
    label: selectable ? label : `${label}（未绑定设备）`,
    searchText: [
      label,
      account.username,
      account.login_username,
      account.display_name,
      account.platform_account_id,
      slotName,
      providerSlotId,
    ].filter(Boolean).join(' ').toLowerCase(),
    deviceLabel: slotName || providerSlotId
      ? [slotName, providerSlotId].filter(Boolean).join(' / ')
      : undefined,
    loginStatus: String(account.login_status || 'unknown'),
    disabled: Boolean(props.disabled) || !selectable,
  }
}

function toDeviceAccountNode(slot: AnyRecord, account: AnyRecord): AccountTreeNode {
  const node = toAccountNode(account)
  const slotName = String(slot.display_name || slot.provider_slot_no || '')
  const providerSlotId = String(slot.provider_slot_id || '')
  return {
    ...node,
    searchText: [node.searchText, slotName, providerSlotId].filter(Boolean).join(' ').toLowerCase(),
    deviceLabel: [slotName, providerSlotId].filter(Boolean).join(' / ') || undefined,
  }
}

function filterNode(value: string, data: AnyRecord) {
  const keyword = value.trim().toLowerCase()
  if (!keyword) return true
  return String(data.searchText || data.label).toLowerCase().includes(keyword)
}

function syncCheckedKeys() {
  treeRef.value?.setCheckedKeys?.(selectedAccountIds.value.map(accountNodeId))
}

function emitSelection(accountIds: string[]) {
  emit('update:modelValue', isMultiple.value ? accountIds : String(accountIds[0] || ''))
}

async function loadTree() {
  const requestId = ++loadRequestId
  loading.value = true
  try {
    if (props.groupByDevice) {
      await loadDeviceGroupedTree(requestId)
      return
    }

    const accounts = await loadAccountSelectionOptions(
      props.filters || {},
      { associationOnly: props.associationOnly },
    )
    if (requestId !== loadRequestId) return

    const eligibleAccounts = accounts.filter(accountMatchesRuntime)
    const accountsByGroup = new Map<string, AnyRecord[]>()
    const groupNames = new Map<string, string>()
    const groupedAccountIds = new Set<string>()
    const availableAccountIds = new Set<string>()

    eligibleAccounts.forEach((account) => {
      const groupId = String(account.group_id || '')
      if (!groupId) return
      const items = accountsByGroup.get(groupId) || []
      items.push(account)
      accountsByGroup.set(groupId, items)
      groupNames.set(groupId, String(account.group_name || groupId))
      groupedAccountIds.add(String(account.id))
    })

    const groupNodes = Array.from(accountsByGroup.entries()).map(([groupId, items]) => {
      items
        .filter((account) => props.associationOnly || account.bound_slot_id)
        .forEach((account) => availableAccountIds.add(String(account.id)))
      const label = groupNames.get(groupId) || groupId
      return {
        id: `group:${groupId}`,
        label,
        searchText: label.toLowerCase(),
        disabled: Boolean(props.disabled) || !items.length,
        children: items.map(toAccountNode),
      }
    })

    const ungroupedAccounts = eligibleAccounts.filter((account) => {
      if (groupedAccountIds.has(String(account.id))) return false
      return true
    })
    ungroupedAccounts
      .filter((account) => props.associationOnly || account.bound_slot_id)
      .forEach((account) => availableAccountIds.add(String(account.id)))
    loggedInCount.value = eligibleAccounts.length
    selectableCount.value = availableAccountIds.size
    treeData.value = [
      ...groupNodes.filter((node) => node.children?.length),
      ...(ungroupedAccounts.length
        ? [
            {
              id: 'group:ungrouped',
              label: '未分组账号',
              searchText: '未分组账号',
              children: ungroupedAccounts.map(toAccountNode),
            },
          ]
        : []),
    ]

    await nextTick()
    syncCheckedKeys()
    treeRef.value?.setExpandedKeys?.(treeData.value.map((node) => node.id))
    treeRef.value?.filter?.(searchKeyword.value)
    const nextSelected = selectedAccountIds.value.filter((accountId) => availableAccountIds.has(accountId))
    if (nextSelected.length !== selectedAccountIds.value.length) {
      emitSelection(nextSelected)
    }
  } finally {
    if (requestId === loadRequestId) loading.value = false
  }
}

async function loadDeviceGroupedTree(requestId: number) {
  const filters = props.filters || {}
  const accounts = await loadAccountSelectionOptions(
    filters,
    { associationOnly: props.associationOnly },
  )
  if (requestId !== loadRequestId) return

  const eligibleAccounts = accounts.filter(
    (account) => account.bound_slot_id && accountMatchesRuntime(account),
  )
  const accountsByGroup = new Map<string, AnyRecord[]>()
  const groupNames = new Map<string, string>()
  const groupedAccountIds = new Set<string>()
  const availableAccountIds = new Set<string>()

  eligibleAccounts.forEach((account) => {
    const groupId = String(account.bound_slot_group_id || '')
    if (!groupId) return
    const items = accountsByGroup.get(groupId) || []
    items.push(account)
    accountsByGroup.set(groupId, items)
    groupNames.set(groupId, String(account.bound_slot_group_name || groupId))
    groupedAccountIds.add(String(account.id))
  })

  const groupNodes = Array.from(accountsByGroup.entries()).map(([groupId, items]) => {
    const children = items.map((account) => {
      availableAccountIds.add(String(account.id))
      return toDeviceAccountNode({
        display_name: account.bound_slot_name,
        provider_slot_id: account.bound_slot_provider_id,
      }, account)
    })
    const label = groupNames.get(groupId) || groupId
    return {
      id: `group:${groupId}`,
      label,
      searchText: label.toLowerCase(),
      disabled: Boolean(props.disabled) || !children.length,
      children,
    }
  })

  const ungroupedAccounts = eligibleAccounts.filter(
    (account) => !groupedAccountIds.has(String(account.id)),
  )
  const ungroupedChildren = ungroupedAccounts.map((account) => {
    availableAccountIds.add(String(account.id))
    return toDeviceAccountNode({
      display_name: account.bound_slot_name,
      provider_slot_id: account.bound_slot_provider_id,
    }, account)
  })
  loggedInCount.value = eligibleAccounts.length
  selectableCount.value = availableAccountIds.size
  treeData.value = [
    ...groupNodes.filter((node) => node.children.length),
    ...(ungroupedChildren.length
      ? [{
          id: 'group:ungrouped-slots',
          label: '未分组设备',
          searchText: '未分组设备',
          children: ungroupedChildren,
        }]
      : []),
  ]

  await nextTick()
  syncCheckedKeys()
  treeRef.value?.setExpandedKeys?.(treeData.value.map((node) => node.id))
  treeRef.value?.filter?.(searchKeyword.value)
  const nextSelected = selectedAccountIds.value.filter((accountId) => availableAccountIds.has(accountId))
  if (nextSelected.length !== selectedAccountIds.value.length) {
    emitSelection(nextSelected)
  }
}

function emitChecked(node?: AnyRecord) {
  const checkedNodes = (treeRef.value?.getCheckedNodes?.(true) || []) as AccountTreeNode[]
  let accountIds = checkedNodes
    .map((item) => item.accountId)
    .filter((accountId): accountId is string => Boolean(accountId))

  // 主号只允许选一个，避免传给后端时出现数组和单值混用。
  if (!isMultiple.value) {
    const clickedAccountId = node?.accountId ? String(node.accountId) : ''
    accountIds = clickedAccountId && accountIds.includes(clickedAccountId)
      ? [clickedAccountId]
      : accountIds.slice(-1)
    treeRef.value?.setCheckedKeys?.(accountIds.map(accountNodeId))
  }

  emitSelection(accountIds)
}

onMounted(() => {
  loadGroupFilterPreference()
  loadTree()
})

watch(selectedAccountIds, () => nextTick(syncCheckedKeys))

watch(searchKeyword, (value) => treeRef.value?.filter?.(value))

watch(groupFilterStorageKey, loadGroupFilterPreference)

watch(selectedGroupNodeIds, (value) => {
  if (groupFilterStorageKey.value) {
    writeStringListPreference(localStorage, groupFilterStorageKey.value, value)
  }
})

watch(visibleTreeData, async () => {
  await nextTick()
  syncCheckedKeys()
  treeRef.value?.setExpandedKeys?.(visibleTreeData.value.map((node) => node.id))
  treeRef.value?.filter?.(searchKeyword.value)
})

watch(
  filterSignature,
  () => loadTree(),
)
</script>

<template>
  <div class="account-tree-select" v-loading="loading">
    <div class="account-tree-select__toolbar">
      <el-input
        v-model="searchKeyword"
        :prefix-icon="Search"
        clearable
        placeholder="搜索账号 / 设备名称 / Provider ID"
      />
      <el-popover
        v-if="groupFilterEnabled"
        placement="bottom-end"
        :width="260"
        trigger="click"
      >
        <template #reference>
          <el-button
            class="account-tree-select__filter-button"
            :type="selectedGroupNodeIds.length ? 'primary' : 'default'"
            plain
            :icon="ListFilter"
          >
            {{ groupFilterLabel }}
          </el-button>
        </template>
        <div class="group-filter-popover">
          <div class="group-filter-popover__header">
            <span>显示设备分组</span>
            <el-button
              v-if="selectedGroupNodeIds.length"
              link
              type="primary"
              :icon="X"
              @click="clearGroupFilter"
            >
              显示全部
            </el-button>
          </div>
          <el-scrollbar max-height="260px">
            <el-checkbox-group v-model="selectedGroupNodeIds" class="group-filter-popover__options">
              <el-checkbox
                v-for="option in groupOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </el-checkbox>
            </el-checkbox-group>
          </el-scrollbar>
          <el-empty
            v-if="!groupOptions.length"
            description="暂无可筛选分组"
            :image-size="48"
          />
        </div>
      </el-popover>
    </div>
    <el-alert
      v-if="!loading && emptyMessage"
      class="account-tree-select__alert"
      :title="emptyMessage"
      type="warning"
      :closable="false"
      show-icon
    />
    <el-tree-v2
      ref="treeRef"
      :data="visibleTreeData"
      :props="treeProps"
      :height="treeHeight"
      :item-size="46"
      show-checkbox
      :default-expanded-keys="visibleTreeData.map((node) => node.id)"
      :check-strictly="!isMultiple"
      :expand-on-click-node="false"
      :filter-method="filterNode"
      scrollbar-always-on
      :empty-text="treeEmptyMessage"
      @check="emitChecked"
    >
      <template #default="{ data }">
        <span class="account-tree-node">
          <span class="account-tree-node__copy">
            <span class="account-tree-node__label">{{ data.label }}</span>
            <span v-if="data.deviceLabel" class="account-tree-node__device">{{ data.deviceLabel }}</span>
          </span>
          <el-tooltip
            v-if="data.accountId"
            :content="statusLabel(data.loginStatus)"
            placement="top"
            :disabled="compactStatusLabel(data.loginStatus) === statusLabel(data.loginStatus)"
          >
            <el-tag
              class="account-tree-node__status"
              size="small"
              :type="statusTagType(data.loginStatus)"
              effect="light"
              round
            >
              {{ compactStatusLabel(data.loginStatus) }}
            </el-tag>
          </el-tooltip>
        </span>
      </template>
    </el-tree-v2>
  </div>
</template>

<style scoped>
.account-tree-select {
  width: 100%;
  min-height: 260px;
  max-height: 420px;
  overflow: auto;
  padding: 10px 12px;
  border: 1px solid #dbe4f0;
  border-radius: 6px;
  background: #f8fafc;
}

.account-tree-select__alert {
  margin-bottom: 10px;
}

.account-tree-select__toolbar {
  position: sticky;
  z-index: 2;
  top: -10px;
  margin: -10px -12px 10px;
  padding: 10px 12px;
  border-bottom: 1px solid #dbe4f0;
  background: rgb(248 250 252 / 96%);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  gap: 8px;
}

.account-tree-select__filter-button {
  flex: 0 0 auto;
}

.account-tree-select :deep(.el-tree),
.account-tree-select :deep(.el-tree-v2) {
  background: transparent;
}

.account-tree-select :deep(.el-tree-node__content) {
  min-width: 0;
}

.account-tree-node {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-right: 8px;
}

.account-tree-node__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-tree-node__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  line-height: 1.3;
}

.account-tree-node__device {
  overflow: hidden;
  color: #7b8da1;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-tree-node__status {
  flex: 0 0 auto;
  white-space: nowrap;
}

.group-filter-popover__header {
  display: flex;
  min-height: 32px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  color: #27364a;
  font-weight: 600;
}

.group-filter-popover__options {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.group-filter-popover__options :deep(.el-checkbox) {
  width: 100%;
  height: 34px;
  margin-right: 0;
  padding: 0 6px;
  border-radius: 4px;
}

.group-filter-popover__options :deep(.el-checkbox:hover) {
  background: #f3f7fb;
}
</style>
