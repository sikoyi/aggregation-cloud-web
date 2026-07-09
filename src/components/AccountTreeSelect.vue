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
const treeProps = {
  label: 'label',
  children: 'children',
  disabled: 'disabled',
}

const selectedAccountIds = computed(() =>
  Array.isArray(props.modelValue) ? props.modelValue.filter(Boolean).map(String) : [],
)

function accountNodeId(accountId: string) {
  return `account:${accountId}`
}

function queryParams(extra: AnyRecord = {}) {
  const filters = props.filters || {}
  return {
    business_platform: filters.business_platform || undefined,
    login_status: 'logged_in',
    page: 1,
    page_size: 100,
    ...extra,
  }
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
    const groupNodes = await Promise.all(
      groupsPage.items.map(async (group) => {
        const accounts = await http.get<PageResult<AnyRecord>>(
          `/api/account-groups/${encodeURIComponent(String(group.id))}/accounts`,
          { login_status: 'logged_in', page: 1, page_size: 100 },
        )
        const items = accounts.items.filter((account) => {
          if (props.filters?.business_platform && account.business_platform !== props.filters.business_platform) return false
          return true
        })
        items.forEach((account) => groupedAccountIds.add(String(account.id)))
        return {
          id: `group:${group.id}`,
          label: String(group.name || group.id),
          disabled: !items.length,
          children: items.map(toAccountNode),
        }
      }),
    )

    const ungroupedAccounts = accountsPage.items.filter((account) => !groupedAccountIds.has(String(account.id)))
    treeData.value = [
      ...groupNodes,
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
      empty-text="暂无已登录账号"
      @check="emitChecked"
    />
  </div>
</template>

<style scoped>
.account-tree-select {
  min-height: 260px;
  max-height: 420px;
  overflow: auto;
  padding: 10px 12px;
  border: 1px solid #dbe4f0;
  border-radius: 6px;
  background: #f8fafc;
}

.account-tree-select :deep(.el-tree) {
  background: transparent;
}
</style>
