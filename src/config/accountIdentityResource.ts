import { businessPlatformOptions, loginStatusOptions } from '@/config/options'
import { accountExportAction } from '@/config/accountExport'
import type { ResourceConfig, SelectOption } from '@/types/crud'

const platformHealthOptions: SelectOption[] = [
  { label: '未知', value: 'unknown' },
  { label: '正常', value: 'normal' },
  { label: '受限', value: 'restricted' },
  { label: '封禁', value: 'banned' },
  { label: '已停用', value: 'disabled' },
  { label: '已删除', value: 'deleted' },
]

const platformSessionOptions: SelectOption[] = [
  ...loginStatusOptions,
  { label: '需要安全验证', value: 'challenge_required' },
  { label: '会话已过期', value: 'session_expired' },
  { label: '异常', value: 'error' },
]

export function buildAccountIdentityResource(accounts: ResourceConfig): ResourceConfig {
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
    expandRow: 'accountIdentity',
    batchActions: [accountExportAction('identities')],
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
      { key: 'keyword', label: '关键词', placeholder: '登录账号 / 用户名 / 昵称' },
      { key: 'business_platform', label: '业务 App', type: 'select', options: businessPlatformOptions },
      { key: 'platform_health_status', label: '账号健康状态', type: 'select', options: platformHealthOptions },
      { key: 'session_login_status', label: '设备登录状态', type: 'select', options: platformSessionOptions },
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
        key: 'slot_group_id',
        label: '设备分组',
        type: 'remoteSelect',
        remote: {
          endpoint: '/api/slot-groups',
          labelKey: 'name',
          valueKey: 'id',
          searchParam: 'keyword',
          pageSize: 100,
        },
        placeholder: '全部设备分组',
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
      {
        key: 'export_status',
        label: '导出状态',
        type: 'select',
        options: [
          { label: '已导出', value: 'exported' },
          { label: '未导出', value: 'unexported' },
        ],
      },
    ],
  }
}
