import { http } from '@/api/http'
import type { AnyRecord } from '@/types/api'
import type { ResourceConfig } from '@/types/crud'

import {
  accountStatusOptions,
  businessPlatformOptions,
  enabledStatusOptions,
  accountScopeTypeOptions,
  executionModeOptions,
  loginStatusOptions,
  providerOptions,
  runtimePlatformOptions,
  runtimeStatusOptions,
  scriptParamTypeOptions,
  scriptStatusOptions,
  slotStatusOptions,
  slotTypeOptions,
  templateStatusOptions,
  taskStatusOptions,
  twoFaOptions,
} from './options'

const jsonPlaceholder = '{}'

const scriptRemoteSelect = {
  endpoint: '/api/scripts',
  labelKey: 'name',
  valueKey: 'script_key',
  detailPath: (value: string) => `/api/scripts/by-key/${encodeURIComponent(value)}`,
  secondaryKey: 'script_key',
  searchParam: 'keyword',
  params: { status: 'enabled' },
  pageSize: 50,
}

// 常见关联资源统一用远程下拉，表单提交仍然使用后端需要的 id/key。
const accountRemoteSelect = {
  endpoint: '/api/accounts',
  labelKeys: ['handle', 'display_name', 'login_username', 'platform_account_id'],
  valueKey: 'id',
  detailPath: (value: string) => `/api/accounts/${encodeURIComponent(value)}`,
  secondaryKeys: ['login_username', 'platform_account_id'],
  searchParam: 'keyword',
  params: { status: 'normal' },
  pageSize: 50,
}

const accountMultiSelect = {
  ...accountRemoteSelect,
  multiple: true,
}

// 后端模型仍然使用 Execution Slot；前端面向运营统一展示为“设备”。
const slotRemoteSelect = {
  endpoint: '/api/execution-slots',
  labelKeys: ['display_name', 'provider_slot_id', 'slot_key', 'provider_slot_no'],
  valueKey: 'id',
  detailPath: (value: string) => `/api/execution-slots/${encodeURIComponent(value)}`,
  secondaryKeys: ['provider_slot_id', 'status'],
  searchParam: 'keyword',
  pageSize: 50,
}

const slotMultiSelect = {
  ...slotRemoteSelect,
  multiple: true,
}

const proxyRemoteSelect = {
  endpoint: '/api/resource-center/proxies',
  labelKeys: ['name', 'host'],
  valueKey: 'id',
  detailPath: (value: string) => `/api/resource-center/proxies/${encodeURIComponent(value)}`,
  secondaryKeys: ['host', 'username'],
  searchParam: 'keyword',
  params: { status: 'enabled' },
  pageSize: 50,
}

const accountGroupRemoteSelect = {
  endpoint: '/api/account-groups',
  labelKey: 'name',
  valueKey: 'id',
  detailPath: (value: string) => `/api/account-groups/${encodeURIComponent(value)}`,
  secondaryKey: 'business_platform',
  searchParam: 'keyword',
  params: { status: 'enabled' },
  pageSize: 50,
}

const accountGroupMultiSelect = {
  ...accountGroupRemoteSelect,
  multiple: true,
}

const slotGroupRemoteSelect = {
  endpoint: '/api/slot-groups',
  labelKey: 'name',
  valueKey: 'id',
  detailPath: (value: string) => `/api/slot-groups/${encodeURIComponent(value)}`,
  secondaryKey: 'business_platform',
  searchParam: 'keyword',
  params: { status: 'enabled' },
  pageSize: 50,
}

const taskTemplateRemoteSelect = {
  endpoint: '/api/task-templates',
  labelKey: 'name',
  valueKey: 'id',
  detailPath: (value: string) => `/api/task-templates/${encodeURIComponent(value)}`,
  secondaryKey: 'script_key',
  searchParam: 'keyword',
  params: { status: 'enabled' },
  pageSize: 50,
}

const scriptCreateKeys = [
  'script_key',
  'name',
  'description',
  'supported_runtime_platforms',
  'supported_providers',
  'supported_business_platforms',
  'max_timeout_seconds',
  'status',
]

const scriptUpdateKeys = scriptCreateKeys.filter((key) => key !== 'script_key')

function pickPayload(payload: AnyRecord, keys: string[]) {
  return keys.reduce<AnyRecord>((result, key) => {
    if (payload[key] !== undefined) result[key] = payload[key]
    return result
  }, {})
}

async function createScriptParams(createdScript: AnyRecord, payload: AnyRecord) {
  const items = Array.isArray(payload.params) ? payload.params : []
  if (!items.length) return undefined
  return http.put(`/api/scripts/${createdScript.id}/params`, { items })
}

async function loadScriptForEdit(record: AnyRecord) {
  const detail = await http.get<{ script: AnyRecord; params: AnyRecord[] }>(`/api/scripts/${record.id}/detail`)
  return { ...detail.script, params: detail.params || [] }
}

async function updateScriptParams(updatedScript: AnyRecord, payload: AnyRecord, record: AnyRecord) {
  const items = Array.isArray(payload.params) ? payload.params : []
  const scriptId = updatedScript.id || record.id
  return http.put(`/api/scripts/${scriptId}/params`, { items })
}

const taskTemplatePayloadKeys = [
  'name',
  'script_key',
  'business_platform',
  'runtime_platform',
  'provider',
  'account_scope_type',
  'execution_mode',
  'status',
  'slot_id',
  'slot_group_id',
  'account_ids',
  'account_group_ids',
  'default_params',
  'description',
]

function buildExecutionWindow(record: AnyRecord) {
  return record.execution_window_start && record.execution_window_end
    ? [record.execution_window_start, record.execution_window_end]
    : []
}

function buildTaskTemplateBody(payload: AnyRecord, record?: AnyRecord) {
  const body = pickPayload(payload, taskTemplatePayloadKeys)
  const windowValue = Array.isArray(payload.execution_window) ? payload.execution_window : []
  body.execution_window_start = windowValue[0] || null
  body.execution_window_end = windowValue[1] || null
  body.execution_timezone = String(record?.execution_timezone || payload.execution_timezone || 'Asia/Shanghai')
  return body
}

export const resources: Record<string, ResourceConfig> = {
  accounts: {
    key: 'accounts',
    title: '账号管理',
    endpoint: '/api/accounts',
    createLabel: '新增账号',
    columns: [
      { key: 'id', label: 'ID', type: 'id' },
      { key: 'handle', label: 'Handle' },
      { key: 'login_username', label: '登录名' },
      { key: 'business_platform', label: '平台' },
      { key: 'status', label: '状态', type: 'status' },
      { key: 'login_status', label: '登录状态', type: 'status' },
      { key: 'bound_slot_id', label: '设备', type: 'relation', relation: slotRemoteSelect },
      { key: 'proxy_id', label: '代理', type: 'relation', relation: proxyRemoteSelect },
      { key: 'updated_at', label: '更新时间', type: 'datetime' },
    ],
    filters: [
      { key: 'business_platform', label: '业务平台', type: 'select', options: businessPlatformOptions },
      { key: 'status', label: '账号状态', type: 'select', options: accountStatusOptions },
      { key: 'login_status', label: '登录状态', type: 'select', options: loginStatusOptions },
      { key: 'keyword', label: '关键词', placeholder: 'Handle / 昵称 / 登录名' },
    ],
    createFields: [
      { key: 'business_platform', label: '业务平台', type: 'select', options: businessPlatformOptions, defaultValue: 'threads' },
      { key: 'login_username', label: '登录用户名', required: true },
      { key: 'handle', label: 'Handle' },
      { key: 'display_name', label: '显示名称' },
      { key: 'platform_account_id', label: '平台账号 ID' },
      { key: 'avatar_url', label: '头像 URL' },
      { key: 'profile_url', label: '主页 URL' },
      { key: 'password_secret_ref', label: '密码密文引用' },
      { key: 'twofa_type', label: '2FA 类型', type: 'select', options: twoFaOptions, defaultValue: 'none' },
      { key: 'totp_secret_ref', label: 'TOTP 引用' },
      { key: 'backup_code_ref', label: '备用码引用' },
      { key: 'status', label: '状态', type: 'select', options: accountStatusOptions, defaultValue: 'normal' },
      { key: 'metadata', label: '扩展数据', type: 'json', defaultValue: {}, span: 2, placeholder: jsonPlaceholder },
    ],
    updateFields: [
      { key: 'login_username', label: '登录用户名' },
      { key: 'handle', label: 'Handle' },
      { key: 'display_name', label: '显示名称' },
      { key: 'platform_account_id', label: '平台账号 ID' },
      { key: 'avatar_url', label: '头像 URL' },
      { key: 'profile_url', label: '主页 URL' },
      { key: 'password_secret_ref', label: '密码密文引用' },
      { key: 'twofa_type', label: '2FA 类型', type: 'select', options: twoFaOptions },
      { key: 'totp_secret_ref', label: 'TOTP 引用' },
      { key: 'backup_code_ref', label: '备用码引用' },
      { key: 'status', label: '状态', type: 'select', options: accountStatusOptions },
      { key: 'metadata', label: '扩展数据', type: 'json', span: 2 },
    ],
    rowActions: [
      {
        key: 'bind-slot',
        label: '绑定设备',
        method: 'POST',
        icon: 'link',
        path: (record) => `/api/accounts/${record.id}/bind-slot`,
        fields: [
          { key: 'slot_id', label: '设备', type: 'remoteSelect', remote: slotRemoteSelect, required: true, placeholder: '请选择设备' },
          { key: 'remark', label: '备注' },
        ],
      },
      {
        key: 'bind-proxy',
        label: '绑定代理',
        method: 'POST',
        icon: 'link',
        path: (record) => `/api/accounts/${record.id}/bind-proxy`,
        fields: [
          { key: 'proxy_id', label: '代理', type: 'remoteSelect', remote: proxyRemoteSelect, required: true, placeholder: '请选择代理' },
          { key: 'remark', label: '备注' },
        ],
      },
      {
        key: 'unbind-proxy',
        label: '解绑代理',
        method: 'POST',
        icon: 'unlink',
        path: (record) => `/api/accounts/${record.id}/unbind-proxy`,
        confirm: '确认解绑该账号代理？',
      },
      {
        key: 'login-task',
        label: '创建登录任务',
        method: 'POST',
        icon: 'play',
        path: (record) => `/api/accounts/${record.id}/login-task`,
        fields: [
          { key: 'slot_id', label: '设备', type: 'remoteSelect', remote: slotRemoteSelect, placeholder: '默认使用账号已绑定设备' },
          { key: 'credential_ref', label: '凭据引用' },
          { key: 'twofa_mode', label: '2FA 模式', type: 'select', options: twoFaOptions },
          { key: 'login_check_after_success', label: '登录后检测', type: 'boolean', defaultValue: true },
          { key: 'params', label: '任务参数', type: 'json', defaultValue: {}, span: 2 },
        ],
      },
      {
        key: 'login-check-task',
        label: '登录检测任务',
        method: 'POST',
        icon: 'play',
        path: (record) => `/api/accounts/${record.id}/login-check-task`,
        fields: [
          { key: 'slot_id', label: '设备', type: 'remoteSelect', remote: slotRemoteSelect, placeholder: '默认使用账号已绑定设备' },
          { key: 'params', label: '任务参数', type: 'json', defaultValue: {}, span: 2 },
        ],
      },
      { key: 'metrics', label: '指标快照', method: 'GET', icon: 'list', path: (record) => `/api/accounts/${record.id}/metrics`, refresh: false },
    ],
  },

  accountGroups: {
    key: 'accountGroups',
    title: '账号分组',
    endpoint: '/api/account-groups',
    createLabel: '新增账号组',
    columns: [
      { key: 'id', label: 'ID', type: 'id' },
      { key: 'name', label: '名称' },
      { key: 'business_platform', label: '平台' },
      { key: 'status', label: '状态', type: 'status' },
      { key: 'member_count', label: '成员数' },
      { key: 'updated_at', label: '更新时间', type: 'datetime' },
    ],
    filters: [
      { key: 'business_platform', label: '业务平台', type: 'select', options: businessPlatformOptions },
      { key: 'status', label: '状态', type: 'select', options: enabledStatusOptions },
      { key: 'keyword', label: '关键词', placeholder: '名称 / 描述' },
    ],
    createFields: [
      { key: 'business_platform', label: '业务平台', type: 'select', options: businessPlatformOptions, defaultValue: 'threads' },
      { key: 'name', label: '名称', required: true },
      { key: 'description', label: '描述', type: 'textarea', span: 2 },
      { key: 'status', label: '状态', type: 'select', options: enabledStatusOptions, defaultValue: 'enabled' },
      { key: 'metadata', label: '扩展数据', type: 'json', defaultValue: {}, span: 2 },
    ],
    updateFields: [
      { key: 'name', label: '名称' },
      { key: 'status', label: '状态', type: 'select', options: enabledStatusOptions },
      { key: 'description', label: '描述', type: 'textarea', span: 2 },
      { key: 'metadata', label: '扩展数据', type: 'json', span: 2 },
    ],
    rowActions: [
      {
        key: 'add-account',
        label: '添加账号',
        method: 'POST',
        icon: 'users',
        path: (record) => `/api/account-groups/${record.id}/accounts`,
        fields: [
          { key: 'account_id', label: '账号', type: 'remoteSelect', remote: accountRemoteSelect, required: true, placeholder: '请选择账号' },
          { key: 'sort_order', label: '排序', type: 'number' },
          { key: 'remark', label: '备注' },
          { key: 'metadata', label: '扩展数据', type: 'json', defaultValue: {}, span: 2 },
        ],
      },
      { key: 'list-accounts', label: '查看成员', method: 'GET', icon: 'list', path: (record) => `/api/account-groups/${record.id}/accounts`, params: { page: 1, page_size: 100 }, refresh: false },
      {
        key: 'remove-account',
        label: '移除账号',
        method: 'DELETE',
        icon: 'trash',
        variant: 'danger',
        path: (record, payload) => `/api/account-groups/${record.id}/accounts/${payload?.account_id}`,
        fields: [{ key: 'account_id', label: '账号', type: 'remoteSelect', remote: accountRemoteSelect, required: true, placeholder: '请选择账号' }],
        confirm: '确认从账号组移除该账号？',
      },
      { key: 'enable', label: '启用', method: 'POST', icon: 'power', path: (record) => `/api/account-groups/${record.id}/enable`, variant: 'success' },
      { key: 'disable', label: '禁用', method: 'POST', icon: 'powerOff', path: (record) => `/api/account-groups/${record.id}/disable`, variant: 'danger', confirm: '确认禁用该账号组？禁用后不能再调整成员。' },
    ],
  },

  slots: {
    key: 'slots',
    title: '设备管理',
    endpoint: '/api/execution-slots',
    createLabel: '新增设备',
    columns: [
      { key: 'id', label: 'ID', type: 'id' },
      { key: 'display_name', label: '名称' },
      { key: 'provider_slot_id', label: 'Provider ID' },
      { key: 'runtime_platform', label: '执行平台' },
      { key: 'provider', label: '供应商' },
      { key: 'status', label: '状态', type: 'status' },
      { key: 'bound_account_id', label: '账号', type: 'relation', relation: accountRemoteSelect },
      { key: 'proxy_id', label: '代理', type: 'relation', relation: proxyRemoteSelect },
      { key: 'last_seen_at', label: '心跳', type: 'datetime' },
    ],
    filters: [
      {
        key: 'provider',
        label: '供应商',
        type: 'select',
        options: providerOptions,
      },
      { key: 'business_platform', label: '业务平台', type: 'select', options: businessPlatformOptions },
      { key: 'status', label: '状态', type: 'select', options: slotStatusOptions },
      { key: 'keyword', label: '关键词', placeholder: 'Profile ID / 编号 / 名称' },
    ],
    createFields: [
      { key: 'runtime_platform', label: '执行平台', type: 'select', options: runtimePlatformOptions, defaultValue: 'fingerprint_browser' },
      {
        key: 'provider',
        label: '供应商',
        type: 'select',
        options: providerOptions,
        defaultValue: 'adspower',
      },
      { key: 'slot_type', label: '设备类型', type: 'select', options: slotTypeOptions, defaultValue: 'fingerprint_profile' },
      { key: 'provider_slot_id', label: 'Provider 设备 ID', required: true },
      { key: 'provider_slot_no', label: 'Provider 编号' },
      { key: 'slot_key', label: '设备 Key' },
      { key: 'display_name', label: '显示名称' },
      { key: 'business_platform', label: '业务平台', type: 'select', options: businessPlatformOptions, defaultValue: 'threads' },
      { key: 'metadata', label: '扩展数据', type: 'json', defaultValue: {}, span: 2 },
    ],
    updateFields: [
      { key: 'provider_slot_no', label: 'Provider 编号' },
      { key: 'slot_key', label: '设备 Key' },
      { key: 'display_name', label: '显示名称' },
      { key: 'business_platform', label: '业务平台', type: 'select', options: businessPlatformOptions },
      { key: 'status', label: '状态', type: 'select', options: slotStatusOptions },
      { key: 'metadata', label: '扩展数据', type: 'json', span: 2 },
    ],
    rowActions: [
      { key: 'bind-account', label: '绑定账号', method: 'POST', icon: 'link', path: (record) => `/api/execution-slots/${record.id}/bind-account`, fields: [{ key: 'account_id', label: '账号', type: 'remoteSelect', remote: accountRemoteSelect, required: true, placeholder: '请选择账号' }, { key: 'remark', label: '备注' }] },
      { key: 'bind-proxy', label: '绑定代理', method: 'POST', icon: 'link', path: (record) => `/api/execution-slots/${record.id}/bind-proxy`, fields: [{ key: 'proxy_id', label: '代理', type: 'remoteSelect', remote: proxyRemoteSelect, required: true, placeholder: '请选择代理' }, { key: 'remark', label: '备注' }] },
      { key: 'unbind-proxy', label: '解绑代理', method: 'POST', icon: 'unlink', path: (record) => `/api/execution-slots/${record.id}/unbind-proxy`, confirm: '确认解绑该设备代理？' },
      { key: 'enable', label: '启用', method: 'POST', icon: 'power', path: (record) => `/api/execution-slots/${record.id}/enable`, variant: 'success' },
      { key: 'disable', label: '禁用', method: 'POST', icon: 'powerOff', path: (record) => `/api/execution-slots/${record.id}/disable`, variant: 'danger', confirm: '确认禁用该设备？' },
      { key: 'runtime', label: '关联 Runtime', method: 'GET', icon: 'list', path: (record) => `/api/execution-slots/${record.id}/runtime`, refresh: false },
    ],
  },

  slotGroups: {
    key: 'slotGroups',
    title: '设备分组',
    endpoint: '/api/slot-groups',
    createLabel: '新增设备组',
    columns: [
      { key: 'id', label: 'ID', type: 'id' },
      { key: 'name', label: '名称' },
      { key: 'runtime_platform', label: '执行平台' },
      { key: 'provider', label: '供应商' },
      { key: 'business_platform', label: '平台' },
      { key: 'status', label: '状态', type: 'status' },
      { key: 'member_count', label: '成员数' },
      { key: 'updated_at', label: '更新时间', type: 'datetime' },
    ],
    filters: [
      { key: 'runtime_platform', label: '执行平台', type: 'select', options: runtimePlatformOptions },
      {
        key: 'provider',
        label: '供应商',
        type: 'select',
        options: providerOptions,
      },
      { key: 'business_platform', label: '业务平台', type: 'select', options: businessPlatformOptions },
      { key: 'status', label: '状态', type: 'select', options: enabledStatusOptions },
      { key: 'keyword', label: '关键词', placeholder: '名称 / 描述' },
    ],
    createFields: [
      { key: 'runtime_platform', label: '执行平台', type: 'select', options: runtimePlatformOptions, defaultValue: 'fingerprint_browser' },
      {
        key: 'provider',
        label: '供应商',
        type: 'select',
        options: providerOptions,
        defaultValue: 'adspower',
      },
      { key: 'business_platform', label: '业务平台', type: 'select', options: businessPlatformOptions, defaultValue: 'threads' },
      { key: 'name', label: '名称', required: true },
      { key: 'status', label: '状态', type: 'select', options: enabledStatusOptions, defaultValue: 'enabled' },
      { key: 'description', label: '描述', type: 'textarea', span: 2 },
      { key: 'metadata', label: '扩展数据', type: 'json', defaultValue: {}, span: 2 },
    ],
    updateFields: [
      { key: 'name', label: '名称' },
      { key: 'status', label: '状态', type: 'select', options: enabledStatusOptions },
      { key: 'description', label: '描述', type: 'textarea', span: 2 },
      { key: 'metadata', label: '扩展数据', type: 'json', span: 2 },
    ],
    rowActions: [
      { key: 'add-slot', label: '添加设备', method: 'POST', icon: 'link', path: (record) => `/api/slot-groups/${record.id}/slots`, fields: [{ key: 'slot_id', label: '设备', type: 'remoteSelect', remote: slotRemoteSelect, required: true, placeholder: '请选择设备' }, { key: 'sort_order', label: '排序', type: 'number' }, { key: 'remark', label: '备注' }, { key: 'metadata', label: '扩展数据', type: 'json', defaultValue: {}, span: 2 }] },
      { key: 'list-slots', label: '查看成员', method: 'GET', icon: 'list', path: (record) => `/api/slot-groups/${record.id}/slots`, params: { page: 1, page_size: 100 }, refresh: false },
      { key: 'remove-slot', label: '移除设备', method: 'DELETE', icon: 'trash', variant: 'danger', path: (record, payload) => `/api/slot-groups/${record.id}/slots/${payload?.slot_id}`, fields: [{ key: 'slot_id', label: '设备', type: 'remoteSelect', remote: slotRemoteSelect, required: true, placeholder: '请选择设备' }], confirm: '确认从设备组移除该设备？' },
      { key: 'enable', label: '启用', method: 'POST', icon: 'power', path: (record) => `/api/slot-groups/${record.id}/enable`, variant: 'success' },
      { key: 'disable', label: '禁用', method: 'POST', icon: 'powerOff', path: (record) => `/api/slot-groups/${record.id}/disable`, variant: 'danger', confirm: '确认禁用该设备组？禁用后不能再调整成员。' },
    ],
  },

  proxies: {
    key: 'proxies',
    title: '代理资源',
    endpoint: '/api/resource-center/proxies',
    createEndpoint: '/api/resource-center/proxies/import',
    createLabel: '导入代理',
    columns: [
      { key: 'id', label: 'ID', type: 'id' },
      { key: 'name', label: '名称' },
      { key: 'source_proxy_url', label: 'Socks5 链接', minWidth: 360 },
      { key: 'status', label: '状态', type: 'statusSwitch' },
      { key: 'updated_at', label: '更新时间', type: 'datetime' },
    ],
    filters: [
      { key: 'status', label: '状态', type: 'select', options: enabledStatusOptions },
      { key: 'keyword', label: '关键词', placeholder: '名称 / Host / 用户名 / 备注' },
    ],
    createFields: [
      { key: 'name', label: '代理名称 / 批量前缀', required: true },
      { key: 'proxy_urls', label: 'Socks5 地址', type: 'textarea', required: true, span: 2, placeholder: 'socks5://user:pass@127.0.0.1:1080\nsocks5://user:pass@127.0.0.2:1080' },
      { key: 'remark', label: '备注', span: 2 },
    ],
    updateFields: [
      { key: 'name', label: '代理名称' },
      { key: 'host', label: 'Host', required: true },
      { key: 'port', label: '端口', type: 'number', required: true },
      { key: 'username', label: '用户名', allowEmpty: true },
      { key: 'password', label: '密码', allowEmpty: true },
      { key: 'status', label: '状态', type: 'select', options: enabledStatusOptions },
      { key: 'remark', label: '备注', span: 2, allowEmpty: true },
    ],
    batchActions: [
      { key: 'enable', label: '批量启用', method: 'POST', icon: 'power', path: (record) => `/api/resource-center/proxies/${record.id}/enable`, variant: 'success' },
      { key: 'disable', label: '批量禁用', method: 'POST', icon: 'powerOff', path: (record) => `/api/resource-center/proxies/${record.id}/disable`, variant: 'danger' },
    ],
    deleteLabel: '删除',
    deleteConfirm: '确认删除该代理？删除前请确认它没有关联账号或设备。',
  },

  scripts: {
    key: 'scripts',
    title: '脚本管理',
    endpoint: '/api/scripts',
    createLabel: '新增脚本',
    columns: [
      { key: 'id', label: 'ID', type: 'id', align: 'center' },
      { key: 'script_key', label: '脚本 Key', type: 'tag', minWidth: 180, align: 'center' },
      { key: 'name', label: '名称', align: 'center' },
      {
        key: 'supported_business_platforms',
        label: '业务 App 范围',
        type: 'list',
        width: 160,
        align: 'center',
      },
      { key: 'status', label: '状态', type: 'status', align: 'center' },
      { key: 'updated_at', label: '更新时间', type: 'datetime', align: 'center' },
    ],
    filters: [
      { key: 'status', label: '状态', type: 'select', options: scriptStatusOptions },
      { key: 'runtime_platform', label: '执行平台', type: 'select', options: runtimePlatformOptions },
      {
        key: 'provider',
        label: '供应商',
        type: 'select',
        options: providerOptions,
      },
      { key: 'business_platform', label: '业务平台', type: 'select', options: businessPlatformOptions },
      { key: 'keyword', label: '关键词', placeholder: 'Key / 名称 / 描述' },
    ],
    createFields: [
      { key: 'script_key', label: '脚本 Key', required: true },
      { key: 'name', label: '脚本名称', required: true },
      { key: 'status', label: '状态', type: 'select', options: scriptStatusOptions, defaultValue: 'enabled' },
      {
        key: 'supported_runtime_platforms',
        label: '执行平台范围',
        type: 'select',
        multiple: true,
        options: runtimePlatformOptions,
        defaultValue: ['fingerprint_browser'],
      },
      {
        key: 'supported_providers',
        label: '供应商范围',
        type: 'select',
        multiple: true,
        options: providerOptions,
        defaultValue: ['adspower'],
      },
      {
        key: 'supported_business_platforms',
        label: '业务 App 范围',
        type: 'select',
        multiple: true,
        options: businessPlatformOptions,
        defaultValue: ['threads'],
      },
      { key: 'max_timeout_seconds', label: '最大超时秒', type: 'number', defaultValue: 3600 },
      { key: 'description', label: '描述', type: 'textarea', span: 2 },
      {
        key: 'params',
        label: '脚本参数定义',
        type: 'scriptParams',
        options: scriptParamTypeOptions,
        defaultValue: [],
        span: 2,
      },
    ],
    createBody: (payload) => pickPayload(payload, scriptCreateKeys),
    afterCreate: createScriptParams,
    loadEditRecord: loadScriptForEdit,
    updateBody: (payload) => pickPayload(payload, scriptUpdateKeys),
    afterUpdate: updateScriptParams,
    updateFields: [
      { key: 'name', label: '脚本名称' },
      { key: 'status', label: '状态', type: 'select', options: scriptStatusOptions },
      {
        key: 'supported_runtime_platforms',
        label: '执行平台范围',
        type: 'select',
        multiple: true,
        options: runtimePlatformOptions,
      },
      {
        key: 'supported_providers',
        label: '供应商范围',
        type: 'select',
        multiple: true,
        options: providerOptions,
      },
      {
        key: 'supported_business_platforms',
        label: '业务 App 范围',
        type: 'select',
        multiple: true,
        options: businessPlatformOptions,
      },
      { key: 'max_timeout_seconds', label: '最大超时秒', type: 'number' },
      { key: 'description', label: '描述', type: 'textarea', span: 2 },
      {
        key: 'params',
        label: '脚本参数定义',
        type: 'scriptParams',
        options: scriptParamTypeOptions,
        defaultValue: [],
        span: 2,
      },
    ],
    rowActions: [
      { key: 'enable', label: '启用', method: 'POST', icon: 'power', path: (record) => `/api/scripts/${record.id}/enable`, variant: 'success' },
      { key: 'disable', label: '禁用', method: 'POST', icon: 'powerOff', path: (record) => `/api/scripts/${record.id}/disable`, variant: 'danger', confirm: '确认禁用该脚本？' },
    ],
    deleteLabel: '删除',
    directDelete: true,
    deleteConfirm: '确认删除该脚本？删除会同步清理脚本参数、对应任务模板、任务记录、任务事件和分配记录，请谨慎操作。',
  },

  taskTemplates: {
    key: 'taskTemplates',
    title: '任务模板',
    endpoint: '/api/task-templates',
    createLabel: '新增模板',
    createBody: (payload) => buildTaskTemplateBody(payload),
    loadEditRecord: async (record) => ({ ...record, execution_window: buildExecutionWindow(record) }),
    updateBody: (payload, record) => buildTaskTemplateBody(payload, record),
    columns: [
      { key: 'id', label: 'ID', type: 'id' },
      { key: 'name', label: '名称' },
      { key: 'script_key', label: '脚本', type: 'relation', relation: scriptRemoteSelect },
      { key: 'business_platform', label: '平台' },
      { key: 'status', label: '状态', type: 'status' },
      { key: 'updated_at', label: '更新时间', type: 'datetime' },
    ],
    filters: [
      { key: 'business_platform', label: '业务平台', type: 'select', options: businessPlatformOptions },
      {
        key: 'script_key',
        label: '脚本',
        type: 'remoteSelect',
        remote: scriptRemoteSelect,
        placeholder: '全部脚本',
      },
      { key: 'status', label: '状态', type: 'select', options: templateStatusOptions },
      { key: 'keyword', label: '关键词', placeholder: '名称 / 描述' },
    ],
    createFields: [
      { key: 'name', label: '模板名称', required: true },
      {
        key: 'script_key',
        label: '脚本',
        type: 'remoteSelect',
        required: true,
        remote: scriptRemoteSelect,
        placeholder: '请选择脚本',
      },
      { key: 'business_platform', label: '业务平台', type: 'select', options: businessPlatformOptions, defaultValue: 'threads' },
      { key: 'runtime_platform', label: '执行平台', type: 'select', options: runtimePlatformOptions, defaultValue: 'fingerprint_browser' },
      {
        key: 'provider',
        label: '供应商',
        type: 'select',
        options: providerOptions,
        defaultValue: 'adspower',
      },
      { key: 'account_scope_type', label: '账号范围', type: 'select', options: accountScopeTypeOptions, defaultValue: 'single_account' },
      { key: 'execution_mode', label: '执行模式', type: 'select', options: executionModeOptions, defaultValue: 'immediate' },
      { key: 'execution_window', label: '允许执行时段', type: 'timeRange', defaultValue: [], span: 2, placeholder: '不选择表示不限时段' },
      { key: 'status', label: '状态', type: 'select', options: templateStatusOptions, defaultValue: 'enabled' },
      { key: 'slot_id', label: '默认设备', type: 'remoteSelect', remote: slotRemoteSelect, placeholder: '请选择默认设备' },
      { key: 'slot_group_id', label: '默认设备组', type: 'remoteSelect', remote: slotGroupRemoteSelect, placeholder: '请选择默认设备组' },
      { key: 'account_ids', label: '账号列表', type: 'remoteSelect', remote: accountMultiSelect, defaultValue: [], span: 2, placeholder: '请选择账号' },
      { key: 'account_group_ids', label: '账号组列表', type: 'remoteSelect', remote: accountGroupMultiSelect, defaultValue: [], span: 2, placeholder: '请选择账号组' },
      { key: 'default_params', label: '默认参数', type: 'templateParams', defaultValue: {}, span: 2, dependencyKey: 'script_key' },
      { key: 'description', label: '描述', type: 'textarea', span: 2 },
    ],
    updateFields: [
      { key: 'name', label: '模板名称' },
      {
        key: 'script_key',
        label: '脚本',
        type: 'remoteSelect',
        remote: scriptRemoteSelect,
        placeholder: '请选择脚本',
      },
      { key: 'business_platform', label: '业务平台', type: 'select', options: businessPlatformOptions },
      { key: 'runtime_platform', label: '执行平台', type: 'select', options: runtimePlatformOptions },
      {
        key: 'provider',
        label: '供应商',
        type: 'select',
        options: providerOptions,
      },
      { key: 'account_scope_type', label: '账号范围', type: 'select', options: accountScopeTypeOptions },
      { key: 'execution_mode', label: '执行模式', type: 'select', options: executionModeOptions },
      { key: 'execution_window', label: '允许执行时段', type: 'timeRange', defaultValue: [], span: 2, placeholder: '不选择表示不限时段' },
      { key: 'status', label: '状态', type: 'select', options: templateStatusOptions },
      { key: 'slot_id', label: '默认设备', type: 'remoteSelect', remote: slotRemoteSelect, placeholder: '请选择默认设备' },
      { key: 'slot_group_id', label: '默认设备组', type: 'remoteSelect', remote: slotGroupRemoteSelect, placeholder: '请选择默认设备组' },
      { key: 'account_ids', label: '账号列表', type: 'remoteSelect', remote: accountMultiSelect, span: 2, placeholder: '请选择账号' },
      { key: 'account_group_ids', label: '账号组列表', type: 'remoteSelect', remote: accountGroupMultiSelect, span: 2, placeholder: '请选择账号组' },
      { key: 'default_params', label: '默认参数', type: 'templateParams', span: 2, dependencyKey: 'script_key' },
      { key: 'description', label: '描述', type: 'textarea', span: 2 },
    ],
    rowActions: [
      { key: 'clone', label: '克隆模板', method: 'POST', icon: 'copy', path: (record) => `/api/task-templates/${record.id}/clone`, fields: [{ key: 'name', label: '新模板名称' }] },
      { key: 'enable', label: '启用模板', method: 'POST', icon: 'power', path: (record) => `/api/task-templates/${record.id}/enable`, variant: 'success' },
      { key: 'disable', label: '禁用模板', method: 'POST', icon: 'powerOff', variant: 'danger', path: (record) => `/api/task-templates/${record.id}/disable`, confirm: '确认禁用该任务模板？禁用后不能再基于它创建任务。' },
      {
        key: 'create-task',
        label: '创建任务',
        method: 'POST',
        icon: 'play',
        path: (record) => `/api/task-templates/${record.id}/create-task`,
        fields: [
          { key: 'script_key', label: '脚本', hidden: true, readonly: true },
          { key: 'title', label: '任务标题', defaultValue: (record?: AnyRecord) => (record?.name ? `${record.name}任务` : '') },
          { key: 'account_id', label: '账号', type: 'remoteSelect', remote: accountRemoteSelect, placeholder: '请选择账号' },
          { key: 'slot_id', label: '设备', type: 'remoteSelect', remote: slotRemoteSelect, placeholder: '请选择设备' },
          { key: 'scheduled_at', label: '计划时间', type: 'datetime' },
          { key: 'params', label: '覆盖参数', type: 'templateParams', defaultValue: {}, sourceKey: 'default_params', span: 2, dependencyKey: 'script_key' },
        ],
      },
      {
        key: 'create-tasks',
        label: '批量创建',
        method: 'POST',
        icon: 'play',
        path: (record) => `/api/task-templates/${record.id}/create-tasks`,
        fields: [
          { key: 'script_key', label: '脚本', hidden: true, readonly: true },
          { key: 'title_prefix', label: '标题前缀', defaultValue: (record?: AnyRecord) => record?.name || '' },
          { key: 'account_ids', label: '账号列表', type: 'remoteSelect', remote: accountMultiSelect, sourceKey: 'account_ids', defaultValue: [], span: 2, placeholder: '请选择账号' },
          { key: 'account_group_ids', label: '账号组列表', type: 'remoteSelect', remote: accountGroupMultiSelect, sourceKey: 'account_group_ids', defaultValue: [], span: 2, placeholder: '请选择账号组' },
          { key: 'slot_ids', label: '设备列表', type: 'remoteSelect', remote: slotMultiSelect, sourceKey: 'slot_id', defaultValue: [], span: 2, placeholder: '请选择设备' },
          { key: 'slot_group_id', label: '设备组', type: 'remoteSelect', remote: slotGroupRemoteSelect, sourceKey: 'slot_group_id', placeholder: '请选择设备组' },
          { key: 'scheduled_at', label: '计划时间', type: 'datetime' },
          { key: 'params', label: '覆盖参数', type: 'templateParams', defaultValue: {}, sourceKey: 'default_params', span: 2, dependencyKey: 'script_key' },
        ],
      },
    ],
    deleteLabel: '删除',
    deleteConfirm: '确认删除该任务模板？删除后不可恢复，但已创建任务会保留参数快照。',
  },

  tasks: {
    key: 'tasks',
    title: '任务管理',
    endpoint: '/api/tasks',
    createLabel: '新增任务',
    columns: [
      { key: 'id', label: 'ID', type: 'id' },
      { key: 'title', label: '标题' },
      { key: 'script_key', label: '脚本', type: 'relation', relation: scriptRemoteSelect },
      { key: 'template_id', label: '来源模板', type: 'relation', relation: taskTemplateRemoteSelect },
      { key: 'business_platform', label: '平台' },
      { key: 'status', label: '状态', type: 'status' },
      { key: 'account_id', label: '账号', type: 'relation', relation: accountRemoteSelect },
      { key: 'slot_id', label: '设备', type: 'relation', relation: slotRemoteSelect },
      { key: 'result.description', label: '结果描述' },
      { key: 'error_message', label: '错误信息' },
      { key: 'scheduled_at', label: '计划时间', type: 'datetime' },
      { key: 'finished_at', label: '结束时间', type: 'datetime' },
      { key: 'created_at', label: '创建时间', type: 'datetime' },
    ],
    filters: [
      { key: 'status', label: '状态', type: 'select', options: taskStatusOptions },
      { key: 'business_platform', label: '业务平台', type: 'select', options: businessPlatformOptions },
      {
        key: 'script_key',
        label: '脚本',
        type: 'remoteSelect',
        remote: scriptRemoteSelect,
        placeholder: '全部脚本',
      },
      { key: 'template_id', label: '来源模板', type: 'remoteSelect', remote: taskTemplateRemoteSelect, placeholder: '全部模板' },
      { key: 'account_id', label: '账号', type: 'remoteSelect', remote: accountRemoteSelect, placeholder: '全部账号' },
      { key: 'slot_id', label: '设备', type: 'remoteSelect', remote: slotRemoteSelect, placeholder: '全部设备' },
      { key: 'keyword', label: '关键词', placeholder: '任务 ID / 标题 / 错误信息' },
    ],
    createFields: [
      { key: 'title', label: '任务标题' },
      { key: 'task_type', label: '任务类型', defaultValue: 'manual' },
      {
        key: 'script_key',
        label: '脚本',
        type: 'remoteSelect',
        required: true,
        remote: scriptRemoteSelect,
        placeholder: '请选择脚本',
      },
      { key: 'business_platform', label: '业务平台', type: 'select', options: businessPlatformOptions, defaultValue: 'threads' },
      { key: 'runtime_platform', label: '执行平台', type: 'select', options: runtimePlatformOptions, defaultValue: 'fingerprint_browser' },
      {
        key: 'provider',
        label: '供应商',
        type: 'select',
        options: providerOptions,
        defaultValue: 'adspower',
      },
      { key: 'account_id', label: '账号', type: 'remoteSelect', remote: accountRemoteSelect, placeholder: '请选择账号' },
      { key: 'slot_id', label: '设备', type: 'remoteSelect', remote: slotRemoteSelect, placeholder: '请选择设备' },
      { key: 'scheduled_at', label: '计划时间', type: 'datetime' },
      { key: 'params', label: '任务参数', type: 'templateParams', defaultValue: {}, span: 2, dependencyKey: 'script_key' },
    ],
    updateFields: [],
    inlineActionKeys: ['detail'],
    rowActions: [
      { key: 'detail', label: '任务详情', method: 'GET', icon: 'list', path: (record) => `/api/tasks/${record.id}`, refresh: false },
      { key: 'cancel', label: '取消任务', method: 'POST', icon: 'powerOff', variant: 'danger', path: (record) => `/api/tasks/${record.id}/cancel`, confirm: '确认取消该任务？' },
      { key: 'assignments', label: '分配记录', method: 'GET', icon: 'list', path: (record) => `/api/tasks/${record.id}/assignments`, refresh: false },
      { key: 'events', label: '事件日志', method: 'GET', icon: 'list', path: (record) => `/api/tasks/${record.id}/events`, refresh: false },
    ],
  },

  runtimes: {
    key: 'runtimes',
    title: 'Runtime 在线状态',
    endpoint: '/api/runtimes',
    readOnly: true,
    columns: [
      { key: 'id', label: 'ID', type: 'id' },
      { key: 'runtime_id', label: 'Runtime ID' },
      { key: 'runtime_platform', label: '执行平台' },
      { key: 'provider', label: '供应商' },
      { key: 'status', label: '状态', type: 'status' },
      { key: 'slot_total', label: '设备总数' },
      { key: 'slot_idle', label: '空闲设备' },
      { key: 'slot_running', label: '运行中设备' },
      { key: 'last_heartbeat_at', label: '心跳', type: 'datetime' },
    ],
    filters: [
      { key: 'status', label: '状态', type: 'select', options: runtimeStatusOptions },
      {
        key: 'provider',
        label: '供应商',
        type: 'select',
        options: providerOptions,
      },
      { key: 'runtime_platform', label: '执行平台', type: 'select', options: runtimePlatformOptions },
    ],
    inlineActionKeys: ['detail'],
    rowActions: [
      { key: 'detail', label: '查看详情', method: 'GET', icon: 'list', path: (record) => `/api/runtimes/${record.id}`, refresh: false },
      {
        key: 'slots',
        label: '查看设备',
        method: 'GET',
        icon: 'list',
        path: (record) => `/api/runtimes/${record.id}/slots`,
        refresh: false,
        resultColumns: [
          { key: 'id', label: 'ID', type: 'id', minWidth: 110 },
          { key: 'display_name', label: '名称', minWidth: 160 },
          { key: 'provider_slot_id', label: 'Provider ID', minWidth: 170 },
          { key: 'status', label: '状态', type: 'status', width: 120 },
          { key: 'bound_account_id', label: '账号', type: 'id', minWidth: 120 },
          { key: 'current_task_run_id', label: '当前任务', type: 'id', minWidth: 120 },
          { key: 'last_seen_at', label: '心跳', type: 'datetime', minWidth: 180 },
        ],
      },
    ],
  },
}
