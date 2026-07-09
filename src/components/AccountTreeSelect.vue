<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import { http } from '@/api/http'
import type { AnyRecord, PageResult } from '@/types/api'

const props = defineProps<{
  modelValue: unknown
  disabled?: boolean
  filters?: AnyRecord
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

interface AccountTreeNode {
  id: string
  accountId?: string
  label: string
  disabled?: boolean
  children?: AccountTreeNode[]
}

const treeRef = ref()
const loading = ref(false)
const treeData = ref<AccountTreeNode[]>([])
const loggedInCount = ref(0)
const selectableCount = ref(0)
const treeProps = {
  label: 'label',
  children: 'children',
  disabled: 'disabled',
}

const selectedAccountIds = computed(() =>
  Array.isArray(props.modelValue) ? props.modelValue.filter(Boolean).map(String) : [],
)
const emptyMessage = computed(() => {
  const filters = props.filters || {}
  const hasRuntimeFilter = Boolean(filters.runtime_platform || filters.provider)
  if (loggedInCount.value === 0) {
    return hasRuntimeFilter
      ? '当前业务 App 在该执行平台/供应商下暂无已登录账号'
      : '当前业务 App 暂无已登录账号'
  }
  if (selectableCount.value === 0) {
    return hasRuntimeFilter
      ? '当前业务 App 在该执行平台/供应商下的已登录账号都未绑定可用设备，暂时不能下发发布任务'
      : '当前业务 App 的已登录账号都未绑定设备，暂时不能下发发布任务'
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
    login_status: 'logged_in',
    page: 1,
    page_size: 100,
    ...extra,
  }
}

function accountMatchesRuntime(account: AnyRecord) {
  const filters = props.filters || {}
  if (filters.runtime_platform && account.bound_slot_runtime_platform !== filters.runtime_platform) return false
  if (filters.provider && account.bound_slot_provider !== filters.provider) return false
  return true
}

function accountLabel(account: AnyRecord) {
  return String(
    account.login_username ||
      account.username ||
      account.display_name ||
      account.platform_account_id ||
      account.id,
  )
}

function toAccountNode(account: AnyRecord): AccountTreeNode {
  const label = accountLabel(account)
  const hasSlot = Boolean(account.bound_slot_id)
  return {
    id: accountNodeId(String(account.id)),
    accountId: String(account.id),
    label: hasSlot ? label : `${label}（未绑定设备）`,
    disabled: !hasSlot,
  }
}

function syncCheckedKeys() {
  treeRef.value?.setCheckedKeys?.(selectedAccountIds.value.map(accountNodeId))
}

async function loadTree() {
  loading.value = true
  try {
    const [groupsPage, accountsPage] = await Promise.all([
      http.get<PageResult<AnyRecord>>('/api/account-groups', queryParams()),
      http.get<PageResult<AnyRecord>>('/api/accounts', queryParams()),
    ])

    const groupedAccountIds = new Set<string>()
    const availableAccountIds = new Set<string>()
    const groupNodes = await Promise.all(
      groupsPage.items.map(async (group) => {
        const accounts = await http.get<PageResult<AnyRecord>>(
          `/api/account-groups/${encodeURIComponent(String(group.id))}/accounts`,
          queryParams({ page: 1, page_size: 100 }),
        )
        const items = accounts.items.filter((account) => {
          if (props.filters?.business_platform && account.business_platform !== props.filters.business_platform) return false
          if (!accountMatchesRuntime(account)) return false
          return true
        })
        items.forEach((account) => groupedAccountIds.add(String(account.id)))
        items.filter((account) => account.bound_slot_id).forEach((account) => availableAccountIds.add(String(account.id)))
        return {
          id: `group:${group.id}`,
          label: String(group.name || group.id),
          disabled: !items.length,
          children: items.map(toAccountNode),
        }
      }),
    )

    const ungroupedAccounts = accountsPage.items.filter((account) => !groupedAccountIds.has(String(account.id)))
    ungroupedAccounts.filter((account) => account.bound_slot_id).forEach((account) => availableAccountIds.add(String(account.id)))
    loggedInCount.value = accountsPage.items.length
    selectableCount.value = availableAccountIds.size
    treeData.value = [
      ...groupNodes.filter((node) => node.children?.length),
      ...(ungroupedAccounts.length
        ? [
            {
              id: 'group:ungrouped',
              label: '未分组账号',
              children: ungroupedAccounts.map(toAccountNode),
            },
          ]
        : []),
    ]

    await nextTick()
    syncCheckedKeys()
    const nextSelected = selectedAccountIds.value.filter((accountId) => availableAccountIds.has(accountId))
    if (nextSelected.length !== selectedAccountIds.value.length) {
      emit('update:modelValue', nextSelected)
    }
  } finally {
    loading.value = false
  }
}

function emitChecked() {
  const checkedNodes = (treeRef.value?.getCheckedNodes?.(true) || []) as AccountTreeNode[]
  emit(
    'update:modelValue',
    checkedNodes
      .map((node) => node.accountId)
      .filter((accountId): accountId is string => Boolean(accountId)),
  )
}

onMounted(loadTree)

watch(selectedAccountIds, () => nextTick(syncCheckedKeys))

watch(
  () => props.filters,
  () => loadTree(),
  { deep: true },
)
</script>

<template>
  <div class="account-tree-select" v-loading="loading">
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
      :check-strictly="false"
      :expand-on-click-node="false"
      :disabled="disabled"
      :empty-text="emptyMessage || '暂无已登录账号'"
      @check="emitChecked"
    />
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

.account-tree-select :deep(.el-tree) {
  background: transparent;
}
</style>
