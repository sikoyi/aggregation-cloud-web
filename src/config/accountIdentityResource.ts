import { businessPlatformOptions } from '@/config/options'
import { accountExportAction } from '@/config/accountExport'
import type { AnyRecord } from '@/types/api'
import type { FieldConfig, ResourceConfig, RowActionConfig, SelectOption } from '@/types/crud'

const platformHealthOptions: SelectOption[] = [
  { label: '未知', value: 'unknown' },
  { label: '正常', value: 'normal' },
  { label: '受限', value: 'restricted' },
  { label: '封禁', value: 'banned' },
  { label: '已停用', value: 'disabled' },
  { label: '已删除', value: 'deleted' },
]

function visiblePlatformAccountIds(records: AnyRecord[]): string[] {
  const accountIds = new Set<string>()
  for (const record of records) {
    if (!Array.isArray(record.platform_summaries)) continue
    for (const summary of record.platform_summaries) {
      const accountId = String(summary?.account_id || '').trim()
      if (accountId) accountIds.add(accountId)
    }
  }
  return [...accountIds]
}

function visiblePlatformAccountRows(records: AnyRecord[]): AnyRecord[] {
  return visiblePlatformAccountIds(records).map((id) => ({ id }))
}

function identityPlatformBatchAction(accounts: ResourceConfig, key: string) {
  const action = accounts.batchActions?.find((item) => item.key === key)
  if (!action?.batchBody) return null
  return {
    ...action,
    batchBody: (payload: AnyRecord, records: AnyRecord[]) =>
      action.batchBody!(payload, visiblePlatformAccountRows(records)),
  }
}

function identityPlatformOnboardingAction(accounts: ResourceConfig): RowActionConfig | null {
  const action = accounts.batchActions?.find((item) => item.key === 'batch-account-onboarding')
  if (!action?.batchBody) return null
  return {
    ...action,
    fields: [
      {
        key: 'business_platform',
        label: '目标业务 App',
        type: 'select',
        options: businessPlatformOptions,
        required: true,
        placeholder: '请选择本次上号的业务 App',
      },
      ...(action.fields || []),
    ],
    batchBody: (payload, records) => {
      const targetPlatform = String(payload.business_platform || '').trim()
      if (!targetPlatform) throw new Error('请选择本次上号的业务 App')

      const exportedCount = records.filter((record) => Boolean(record.credentials_exported_at)).length
      if (exportedCount) {
        throw new Error(`所选登录身份中有 ${exportedCount} 个已导出，不能再次上号`)
      }

      const missingCount = records.filter((record) => (
        !Array.isArray(record.platform_summaries)
        || !record.platform_summaries.some(
          (summary: AnyRecord) => String(summary?.business_platform || '') === targetPlatform,
        )
      )).length
      if (missingCount) {
        const platformLabel = businessPlatformOptions.find((option) => option.value === targetPlatform)?.label
          || targetPlatform
        throw new Error(`所选登录身份中有 ${missingCount} 个没有 ${platformLabel} 平台账号，请调整选择后重试`)
      }

      const seen = new Set<string>()
      const accountRows: AnyRecord[] = []
      for (const record of records) {
        for (const summary of record.platform_summaries as AnyRecord[]) {
          if (String(summary?.business_platform || '') !== targetPlatform) continue
          const id = String(summary?.account_id || '').trim()
          if (!id || seen.has(id)) continue
          seen.add(id)
          accountRows.push({
            id,
            business_platform: targetPlatform,
            credentials_exported_at: record.credentials_exported_at,
          })
        }
      }
      return action.batchBody!(payload, accountRows)
    },
  }
}

function inheritAccountFilters(accounts: ResourceConfig, keys: string[]): FieldConfig[] {
  const filtersByKey = new Map((accounts.filters || []).map((filter) => [filter.key, filter]))
  return keys.flatMap((key) => {
    const filter = filtersByKey.get(key)
    return filter ? [{ ...filter }] : []
  })
}

function identityPlatformDeleteAction(): RowActionConfig {
  return {
    key: 'batch-delete-accounts',
    permission: 'accounts.delete',
    label: '删除账号数据',
    method: 'POST',
    icon: 'trash',
    variant: 'danger',
    selectionLimit: 100,
    batchPath: () => '/api/accounts/delete/batch',
    batchBody: (_payload, records) => ({
      account_ids: visiblePlatformAccountIds(records),
    }),
    confirm: (record) => {
      const records = Array.isArray(record.selectedRows) ? record.selectedRows : []
      const accountCount = visiblePlatformAccountIds(records).length
      return `确认删除所选登录身份下的 ${accountCount} 个平台账号？设备会话、发布内容、评论、指标、监听记录和备份数据会一并清理，此操作不可恢复。`
    },
    successTitle: '账号批量删除完成',
    successMessage: (data) =>
      `已删除 ${Number(data.deleted_count || 0)} 个账号，同时删除 ${Number(data.deleted_published_content_count || 0)} 条关联发布内容`,
  }
}

export function buildAccountIdentityResource(accounts: ResourceConfig): ResourceConfig {
  const accountAgeTypeAction = identityPlatformBatchAction(accounts, 'batch-update-account-age-type')
  const accountLoginStatusAction = identityPlatformBatchAction(accounts, 'batch-update-login-status')
  const accountOnboardingAction = identityPlatformOnboardingAction(accounts)
  const accountTagAction = identityPlatformBatchAction(accounts, 'batch-set-tags')
  return {
    key: 'accountIdentities',
    title: accounts.title,
    permissionModule: 'accounts',
    endpoint: '/api/account-identities',
    createEndpoint: accounts.createEndpoint,
    createLabel: accounts.createLabel,
    createSuccessTitle: accounts.createSuccessTitle,
    createSuccessMessage: accounts.createSuccessMessage,
    createNotificationType: accounts.createNotificationType,
    keepCreateOpenWhen: accounts.keepCreateOpenWhen,
    createBody: accounts.createBody,
    createFields: accounts.createFields,
    listParams: accounts.listParams,
    expandRow: 'accountIdentity',
    batchActions: [
      accountExportAction('identities'),
      accountOnboardingAction,
      accountAgeTypeAction,
      accountLoginStatusAction,
      accountTagAction,
      identityPlatformDeleteAction(),
    ].filter((action): action is RowActionConfig => action !== null),
    inlineActionKeys: ['edit-credentials'],
    rowActions: [
      {
        key: 'edit-credentials',
        label: '编辑登录凭据',
        icon: 'edit',
        permission: 'accounts.edit',
        visible: (row) => row.can_edit_credentials === true,
      },
    ],
    columns: [
      { key: 'login_username', label: '登录身份', type: 'loginIdentity', minWidth: 250 },
      { key: 'identity_tag_names', label: '账号标签', type: 'identityTags', minWidth: 170 },
      { key: 'password_secret_ref', label: '登录凭证', type: 'accountCredentials', minWidth: 260 },
      { key: 'platform_summaries', label: '平台 / 账号状态', type: 'identityPlatforms', minWidth: 230 },
      { key: 'active_session_count', label: '设备会话', type: 'identitySessions', minWidth: 190 },
      { key: 'has_pending_candidate', label: '关联状态', type: 'identityCandidate', width: 112, align: 'center' },
      { key: 'created_at', label: '创建时间', type: 'datetime', width: 165, align: 'center' },
    ],
    filters: [
      ...inheritAccountFilters(accounts, [
        'account_id',
        'login_username',
        'slot_group_id',
        'tag_id',
        'bound_slot_name',
        'provider_slot_id',
        'business_platform',
        'country',
        'login_status',
        'export_status',
        'account_age_type',
        'warmup_status',
        'warmup_plan_id',
        'runtime_platform',
        'provider',
        'keyword',
      ]),
      { key: 'platform_health_status', label: '账号健康状态', type: 'select', options: platformHealthOptions },
      {
        key: 'bound_state',
        label: '设备绑定',
        type: 'select',
        options: [
          { label: '已绑定设备', value: 'bound' },
          { label: '未绑定设备', value: 'unbound' },
        ],
      },
      {
        key: 'candidate_status',
        label: '关联候选',
        type: 'select',
        options: [
          { label: '待确认', value: 'pending' },
          { label: '已确认', value: 'confirmed' },
          { label: '已拒绝', value: 'rejected' },
        ],
      },
    ],
  }
}
