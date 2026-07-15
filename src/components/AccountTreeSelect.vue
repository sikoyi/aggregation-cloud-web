<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Search } from 'lucide-vue-next'

import { getAllPages } from '@/api/http'
import type { AnyRecord } from '@/types/api'
import { statusLabel, statusTagType } from '@/utils/format'

const props = defineProps<{
  modelValue: unknown
  disabled?: boolean
  filters?: AnyRecord
  multiple?: boolean
  associationOnly?: boolean
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
const loading = ref(false)
const searchKeyword = ref('')
const treeData = ref<AccountTreeNode[]>([])
const loggedInCount = ref(0)
const selectableCount = ref(0)
const treeProps = {
  label: 'label',
  children: 'children',
  disabled: 'disabled',
}

const isMultiple = computed(() => props.multiple !== false)
const selectedAccountIds = computed(() => {
  if (Array.isArray(props.modelValue)) return props.modelValue.filter(Boolean).map(String)
  return props.modelValue ? [String(props.modelValue)] : []
})
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

function accountNodeId(accountId: string) {
  return `account:${accountId}`
}

function queryParams(extra: AnyRecord = {}) {
  const filters = props.filters || {}
  return {
    business_platform: filters.business_platform || undefined,
    runtime_platform: filters.runtime_platform || undefined,
    provider: filters.provider || undefined,
    login_status: props.associationOnly ? undefined : 'logged_in,logged_in_dm_unavailable',
    ...extra,
  }
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
    disabled: !selectable,
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
  loading.value = true
  try {
    const [groups, accounts] = await Promise.all([
      getAllPages<AnyRecord>('/api/account-groups', queryParams()),
      getAllPages<AnyRecord>('/api/accounts', queryParams()),
    ])

    const eligibleAccountIds = new Set(accounts.map((account) => String(account.id)))
    const groupedAccountIds = new Set<string>()
    const availableAccountIds = new Set<string>()
    const groupNodes = await Promise.all(
      groups.map(async (group) => {
        const groupAccounts = await getAllPages<AnyRecord>(
          `/api/account-groups/${encodeURIComponent(String(group.id))}/accounts`,
          queryParams(),
        )
        const items = groupAccounts.filter((account) => {
          if (!eligibleAccountIds.has(String(account.id))) return false
          if (props.filters?.business_platform && account.business_platform !== props.filters.business_platform) return false
          if (!accountMatchesRuntime(account)) return false
          return true
        })
        items.forEach((account) => groupedAccountIds.add(String(account.id)))
        items
          .filter((account) => props.associationOnly || account.bound_slot_id)
          .forEach((account) => availableAccountIds.add(String(account.id)))
        const label = String(group.name || group.id)
        return {
          id: `group:${group.id}`,
          label,
          searchText: label.toLowerCase(),
          disabled: !items.length,
          children: items.map(toAccountNode),
        }
      }),
    )

    const ungroupedAccounts = accounts.filter((account) => {
      if (groupedAccountIds.has(String(account.id))) return false
      return accountMatchesRuntime(account)
    })
    ungroupedAccounts
      .filter((account) => props.associationOnly || account.bound_slot_id)
      .forEach((account) => availableAccountIds.add(String(account.id)))
    loggedInCount.value = accounts.filter(accountMatchesRuntime).length
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
    treeRef.value?.filter?.(searchKeyword.value)
    const nextSelected = selectedAccountIds.value.filter((accountId) => availableAccountIds.has(accountId))
    if (nextSelected.length !== selectedAccountIds.value.length) {
      emitSelection(nextSelected)
    }
  } finally {
    loading.value = false
  }
}

function emitChecked(node?: AccountTreeNode) {
  const checkedNodes = (treeRef.value?.getCheckedNodes?.(true) || []) as AccountTreeNode[]
  let accountIds = checkedNodes
    .map((item) => item.accountId)
    .filter((accountId): accountId is string => Boolean(accountId))

  // 主号只允许选一个，避免传给后端时出现数组和单值混用。
  if (!isMultiple.value) {
    const clickedAccountId = node?.accountId
    accountIds = clickedAccountId && accountIds.includes(clickedAccountId)
      ? [clickedAccountId]
      : accountIds.slice(-1)
    treeRef.value?.setCheckedKeys?.(accountIds.map(accountNodeId))
  }

  emitSelection(accountIds)
}

onMounted(loadTree)

watch(selectedAccountIds, () => nextTick(syncCheckedKeys))

watch(searchKeyword, (value) => treeRef.value?.filter?.(value))

watch(
  () => props.filters,
  () => loadTree(),
  { deep: true },
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
    </div>
    <el-alert
      v-if="!loading && emptyMessage"
      class="account-tree-select__alert"
      :title="emptyMessage"
      type="warning"
      :closable="false"
      show-icon
    />
    <el-tree
      ref="treeRef"
      :data="treeData"
      :props="treeProps"
      node-key="id"
      show-checkbox
      default-expand-all
      :check-strictly="!isMultiple"
      :expand-on-click-node="false"
      :disabled="disabled"
      :filter-node-method="filterNode"
      :empty-text="emptyMessage || '暂无已登录账号'"
      @check="emitChecked"
    >
      <template #default="{ data }">
        <span class="account-tree-node">
          <span class="account-tree-node__copy">
            <span class="account-tree-node__label">{{ data.label }}</span>
            <span v-if="data.deviceLabel" class="account-tree-node__device">{{ data.deviceLabel }}</span>
          </span>
          <el-tag
            v-if="data.accountId"
            size="small"
            :type="statusTagType(data.loginStatus)"
            effect="light"
            round
          >
            {{ statusLabel(data.loginStatus) }}
          </el-tag>
        </span>
      </template>
    </el-tree>
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
}

.account-tree-select :deep(.el-tree) {
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
</style>
