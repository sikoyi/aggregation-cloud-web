import { http } from "@/api/http";
import type { AnyRecord } from "@/types/api";
import type { ResourceConfig } from "@/types/crud";

import {
  accountCountryOptions,
  accountDelimiterOptions,
  businessPlatformOptions,
  contentStatusOptions,
  contentTypeOptions,
  accountScopeTypeOptions,
  executionModeOptions,
  loginStatusOptions,
  mediaAssetStatusOptions,
  mediaAssetTypeOptions,
  providerOptions,
  proxyModeOptions,
  proxyUsageStatusOptions,
  runtimePlatformOptions,
  runtimeStatusOptions,
  scriptParamTypeOptions,
  scriptStatusOptions,
  slotStatusOptions,
  slotTypeOptions,
  templateStatusOptions,
  taskStatusOptions,
  twoFaOptions,
} from "./options";

const scriptRemoteSelect = {
  endpoint: "/api/scripts",
  labelKey: "name",
  valueKey: "script_key",
  detailPath: (value: string) =>
    `/api/scripts/by-key/${encodeURIComponent(value)}`,
  secondaryKey: "script_key",
  searchParam: "keyword",
  params: { status: "enabled" },
  pageSize: 50,
};

// 常见关联资源统一用远程下拉，表单提交仍然使用后端需要的 id/key。
const accountRemoteSelect = {
  endpoint: "/api/accounts",
  labelKeys: [
    "login_username",
    "username",
    "display_name",
    "platform_account_id",
  ],
  valueKey: "id",
  detailPath: (value: string) => `/api/accounts/${encodeURIComponent(value)}`,
  secondaryKeys: ["login_username", "platform_account_id"],
  searchParam: "keyword",
  pageSize: 50,
};

const accountMultiSelect = {
  ...accountRemoteSelect,
  multiple: true,
};

// 后端模型仍然使用 Execution Slot；前端面向运营统一展示为“设备”。
const slotRemoteSelect = {
  endpoint: "/api/execution-slots",
  labelKeys: [
    "display_name",
    "provider_slot_id",
    "provider_slot_no",
  ],
  valueKey: "id",
  detailPath: (value: string) =>
    `/api/execution-slots/${encodeURIComponent(value)}`,
  secondaryKeys: ["provider_slot_id", "status"],
  searchParam: "keyword",
  pageSize: 50,
};

const slotMultiSelect = {
  ...slotRemoteSelect,
  multiple: true,
};

const proxyRemoteSelect = {
  endpoint: "/api/resource-center/proxies",
  labelKeys: ["name", "source_proxy_url", "host"],
  valueKey: "id",
  detailPath: (value: string) =>
    `/api/resource-center/proxies/${encodeURIComponent(value)}`,
  secondaryKeys: ["source_proxy_url", "status"],
  searchParam: "keyword",
  pageSize: 50,
};

const proxyReadonlyRemoteSelect = {
  ...proxyRemoteSelect,
  params: undefined,
};

const mediaAssetRemoteSelect = {
  endpoint: "/api/content-center/media-assets",
  labelKeys: ["name", "source_url", "storage_uri"],
  valueKey: "id",
  detailPath: (value: string) =>
    `/api/content-center/media-assets/${encodeURIComponent(value)}`,
  secondaryKeys: ["asset_type", "status"],
  searchParam: "keyword",
  params: { status: "enabled" },
  pageSize: 50,
};

const mediaAssetMultiSelect = {
  ...mediaAssetRemoteSelect,
  multiple: true,
};

const accountGroupRemoteSelect = {
  endpoint: "/api/account-groups",
  labelKey: "name",
  valueKey: "id",
  detailPath: (value: string) =>
    `/api/account-groups/${encodeURIComponent(value)}`,
  secondaryKey: "business_platform",
  searchParam: "keyword",
  pageSize: 50,
};

const accountGroupMultiSelect = {
  ...accountGroupRemoteSelect,
  multiple: true,
};

const proxyGroupRemoteSelect = {
  endpoint: "/api/resource-center/proxy-groups",
  labelKey: "name",
  valueKey: "id",
  detailPath: (value: string) =>
    `/api/resource-center/proxy-groups/${encodeURIComponent(value)}`,
  secondaryKey: "member_count",
  searchParam: "keyword",
  pageSize: 50,
};

const proxyGroupMultiSelect = {
  ...proxyGroupRemoteSelect,
  multiple: true,
};

const accountGroupForAccountEditRemoteSelect = {
  ...accountGroupRemoteSelect,
  params: (context?: AnyRecord) => ({
    business_platform: context?.business_platform,
  }),
};

const slotGroupRemoteSelect = {
  endpoint: "/api/slot-groups",
  labelKey: "name",
  valueKey: "id",
  detailPath: (value: string) =>
    `/api/slot-groups/${encodeURIComponent(value)}`,
  secondaryKey: "business_platform",
  searchParam: "keyword",
  pageSize: 50,
};

const taskTemplateRemoteSelect = {
  endpoint: "/api/task-templates",
  labelKey: "name",
  valueKey: "id",
  detailPath: (value: string) =>
    `/api/task-templates/${encodeURIComponent(value)}`,
  secondaryKey: "script_key",
  searchParam: "keyword",
  params: { status: "enabled" },
  pageSize: 50,
};

const scriptCreateKeys = [
  "script_key",
  "name",
  "description",
  "supported_runtime_platforms",
  "supported_providers",
  "supported_business_platforms",
  "max_timeout_seconds",
  "status",
];

const scriptUpdateKeys = scriptCreateKeys.filter((key) => key !== "script_key");

function pickPayload(payload: AnyRecord, keys: string[]) {
  return keys.reduce<AnyRecord>((result, key) => {
    if (payload[key] !== undefined) result[key] = payload[key];
    return result;
  }, {});
}

async function createScriptParams(
  createdScript: AnyRecord,
  payload: AnyRecord,
) {
  const items = Array.isArray(payload.params) ? payload.params : [];
  if (!items.length) return undefined;
  return http.put(`/api/scripts/${createdScript.id}/params`, { items });
}

async function loadScriptForEdit(record: AnyRecord) {
  const detail = await http.get<{ script: AnyRecord; params: AnyRecord[] }>(
    `/api/scripts/${record.id}/detail`,
  );
  return { ...detail.script, params: detail.params || [] };
}

async function updateScriptParams(
  updatedScript: AnyRecord,
  payload: AnyRecord,
  record: AnyRecord,
) {
  const items = Array.isArray(payload.params) ? payload.params : [];
  const scriptId = updatedScript.id || record.id;
  return http.put(`/api/scripts/${scriptId}/params`, { items });
}

const taskTemplatePayloadKeys = [
  "name",
  "script_key",
  "business_platform",
  "runtime_platform",
  "provider",
  "execution_count",
  "execution_mode",
  "status",
  "default_params",
  "description",
];

function buildExecutionWindow(record: AnyRecord) {
  return record.execution_window_start && record.execution_window_end
    ? [record.execution_window_start, record.execution_window_end]
    : [];
}

function normalizeDateTimeRange(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(Boolean)
    .map((item) => new Date(String(item)).toISOString());
}

function buildTaskTemplateBody(payload: AnyRecord, record?: AnyRecord) {
  const body = pickPayload(payload, taskTemplatePayloadKeys);
  if (body.execution_mode === "immediate") {
    body.execution_window_start = null;
    body.execution_window_end = null;
  } else {
    const windowValue = normalizeDateTimeRange(payload.execution_window);
    body.execution_window_start = windowValue[0] || null;
    body.execution_window_end = windowValue[1] || null;
  }
  body.execution_timezone = String(
    record?.execution_timezone || payload.execution_timezone || "Asia/Shanghai",
  );
  return body;
}

function buildTaskDispatchBody(payload: AnyRecord) {
  return pickPayload(payload, [
    "template_id",
    "title_prefix",
    "slot_ids",
    "execution_count",
    "params",
    "scheduled_at",
  ]);
}

function formatAccountImportSuccess(data: AnyRecord) {
  const total = Number(data.total_count || 0);
  const created = Number(data.created_count || 0);
  const duplicate = Number(data.duplicate_count || 0);
  const existed = Number(data.existed_count || 0);
  const failed = Number(data.failed_count || 0);
  const grouped = Number(data.grouped_count || 0);
  const groupText = data.group_id ? `，加入分组 ${grouped} 个` : "";
  return `共解析 ${total} 行，成功导入 ${created} 个${groupText}。文本重复 ${duplicate} 个，系统已存在 ${existed} 个，失败 ${failed} 个。`;
}

function formatContentImportSuccess(data: AnyRecord) {
  const total = Number(data.total_count || 0);
  const created = Number(data.created_count || 0);
  const duplicate = Number(data.duplicate_count || 0);
  const existed = Number(data.existed_count || 0);
  const failed = Number(data.failed_count || 0);
  return `共解析 ${total} 条内容，成功导入 ${created} 条；本次重复 ${duplicate} 条，系统已存在 ${existed} 条，失败 ${failed} 条。`;
}

function appendFormValue(formData: FormData, key: string, value: unknown) {
  if (value === undefined || value === null || value === "") return;
  if (value instanceof File) {
    formData.append(key, value);
    return;
  }
  if (Array.isArray(value)) {
    formData.append(key, value.join(","));
    return;
  }
  formData.append(key, String(value));
}

function buildMediaUploadBody(payload: AnyRecord) {
  const formData = new FormData();
  [
    "file",
    "business_platform",
    "name",
    "asset_type",
    "tags",
    "status",
    "remark",
  ].forEach((key) => appendFormValue(formData, key, payload[key]));
  return formData;
}

async function loadAccountForEdit(record: AnyRecord) {
  const account = await http.get<AnyRecord>(`/api/accounts/${record.id}`);
  return { ...record, ...account, account_group_id: account.group_id || "" };
}

async function updateAccountGroups(_updatedAccount: AnyRecord, payload: AnyRecord, record: AnyRecord) {
  if (!Object.prototype.hasOwnProperty.call(payload, "account_group_id")) return undefined;
  return http.put(`/api/accounts/${record.id}/groups`, {
    group_id: payload.account_group_id || null,
  });
}

async function loadProxyForEdit(record: AnyRecord) {
  const proxy = await http.get<AnyRecord>(`/api/resource-center/proxies/${record.id}`);
  return { ...record, ...proxy, group_ids: Array.isArray(proxy.group_ids) ? proxy.group_ids : [] };
}

function buildProxyUpdateBody(payload: AnyRecord) {
  return pickPayload(payload, [
    "name",
    "proxy_mode",
    "host",
    "port",
    "username",
    "password",
    "status",
    "remark",
    "group_ids",
  ]);
}

export const resources: Record<string, ResourceConfig> = {
  accounts: {
    key: "accounts",
    title: "账号管理",
    endpoint: "/api/accounts",
    createEndpoint: "/api/accounts/import",
    createLabel: "导入账号",
    createSuccessTitle: "账号导入完成",
    createSuccessMessage: (data) => formatAccountImportSuccess(data),
    loadEditRecord: loadAccountForEdit,
    updateBody: (payload) =>
      pickPayload(payload, [
        "login_username",
        "username",
        "country",
        "password_secret_ref",
        "twofa_type",
        "totp_secret_ref",
        "display_name",
      ]),
    afterUpdate: updateAccountGroups,
    columns: [
      { key: "id", label: "ID", type: "id" },
      { key: "login_username", label: "登录账号", minWidth: 180 },
      { key: "group_name", label: "所属分组", minWidth: 160 },
      { key: "password_secret_ref", label: "密码", minWidth: 180 },
      { key: "totp_secret_ref", label: "2FA", minWidth: 220 },
      { key: "business_platform", label: "平台" },
      { key: "country", label: "国家", align: "center" },
      { key: "login_status", label: "登录状态", type: "status" },
      {
        key: "bound_slot_id",
        label: "设备",
        type: "relation",
        relation: slotRemoteSelect,
      },
      { key: "updated_at", label: "更新时间", type: "datetime" },
    ],
    filters: [
      {
        key: "business_platform",
        label: "业务平台",
        type: "select",
        options: businessPlatformOptions,
      },
      {
        key: "country",
        label: "国家",
        type: "select",
        options: accountCountryOptions,
      },
      {
        key: "login_status",
        label: "登录状态",
        type: "select",
        options: loginStatusOptions,
      },
      {
        key: "keyword",
        label: "关键词",
        placeholder: "登录账号 / 用户名 / 昵称",
      },
    ],
    createFields: [
      {
        key: "business_platform",
        label: "业务 App",
        type: "select",
        options: businessPlatformOptions,
        defaultValue: "threads",
      },
      {
        key: "country",
        label: "账号国家",
        type: "select",
        options: accountCountryOptions,
        defaultValue: "韩国",
        required: true,
      },
      {
        key: "delimiter",
        label: "分隔符",
        type: "select",
        options: accountDelimiterOptions,
        defaultValue: "---",
        required: true,
      },
      { key: "custom_delimiter", label: "自定义分隔符", placeholder: "可填写空格、space、\\t 或自定义字符" },
      {
        key: "group_id",
        label: "账号分组",
        type: "remoteSelect",
        remote: accountGroupRemoteSelect,
        placeholder: "可选，导入后自动加入分组",
      },
      {
        key: "raw_text",
        label: "账号文本",
        type: "textImport",
        required: true,
        span: 2,
        placeholder: "每行一个账号，默认格式：账号---密码---2FA。后面的国家等字段会被忽略。",
      },
    ],
    updateFields: [
      { key: "login_username", label: "登录账号" },
      {
        key: "account_group_id",
        label: "所属分组",
        type: "remoteSelect",
        remote: accountGroupForAccountEditRemoteSelect,
        allowEmpty: true,
        placeholder: "请选择账号分组",
      },
      { key: "username", label: "公开用户名" },
      {
        key: "country",
        label: "账号国家",
        type: "select",
        options: accountCountryOptions,
      },
      { key: "password_secret_ref", label: "密码" },
      {
        key: "twofa_type",
        label: "2FA 类型",
        type: "select",
        options: twoFaOptions,
      },
      { key: "totp_secret_ref", label: "2FA 密钥 / TOTP" },
      {
        key: "proxy_id",
        label: "代理信息",
        type: "remoteSelect",
        remote: proxyReadonlyRemoteSelect,
        readonly: true,
        placeholder: "暂无代理",
      },
      { key: "display_name", label: "显示名称" },
    ],
    batchActions: [
      {
        key: "batch-add-to-group",
        label: "设置分组",
        method: "POST",
        icon: "users",
        path: (_record, payload) => `/api/account-groups/${payload?.group_id}/accounts`,
        body: (payload, record) => ({
          account_ids: [String(record.id)],
          remark: payload.remark || undefined,
        }),
        fields: [
          {
            key: "group_id",
            label: "账号分组",
            type: "remoteSelect",
            remote: accountGroupRemoteSelect,
            required: true,
            placeholder: "请选择账号分组",
          },
          { key: "remark", label: "备注" },
        ],
      },
    ],
    deleteLabel: "删除",
    directDelete: true,
    deleteConfirm:
      "确认删除该账号？删除后会释放设备绑定、分组成员关系、指标快照和任务记录里的账号引用，请谨慎操作。",
  },

  accountGroups: {
    key: "accountGroups",
    title: "账号分组",
    endpoint: "/api/account-groups",
    createLabel: "新增账号组",
    accountGroupMembers: true,
    columns: [
      { key: "id", label: "ID", type: "id" },
      { key: "name", label: "名称" },
      { key: "business_platform", label: "平台" },
      { key: "member_count", label: "成员数" },
      { key: "updated_at", label: "更新时间", type: "datetime" },
    ],
    filters: [
      {
        key: "business_platform",
        label: "业务平台",
        type: "select",
        options: businessPlatformOptions,
      },
      { key: "keyword", label: "关键词", placeholder: "名称 / 描述" },
    ],
    createFields: [
      {
        key: "business_platform",
        label: "业务平台",
        type: "select",
        options: businessPlatformOptions,
        defaultValue: "threads",
      },
      { key: "name", label: "名称", required: true },
      { key: "description", label: "描述", type: "textarea", span: 2 },
    ],
    updateFields: [
      { key: "name", label: "名称" },
      { key: "description", label: "描述", type: "textarea", span: 2 },
    ],
    deleteLabel: "删除",
    deletePath: (record) => `/api/account-groups/${record.id}?force=true`,
    directDelete: true,
    deleteConfirm:
      "确认删除该账号组？删除后组内成员会自动解绑，分组本身不可恢复，请谨慎操作。",
  },

  slots: {
    key: "slots",
    title: "设备管理",
    endpoint: "/api/execution-slots",
    deleteLabel: "删除",
    directDelete: true,
    deleteConfirm: "确认删除该设备？运行中的设备不能删除，删除后会解绑分组和账号关联。",
    createLabel: "新增设备",
    columns: [
      { key: "id", label: "ID", type: "id" },
      { key: "display_name", label: "名称" },
      { key: "provider_slot_id", label: "Provider ID" },
      { key: "runtime_platform", label: "执行平台" },
      { key: "provider", label: "供应商" },
      { key: "status", label: "状态", type: "status" },
      {
        key: "bound_account_id",
        label: "账号",
        type: "relation",
        relation: accountRemoteSelect,
      },
      {
        key: "proxy_id",
        label: "代理",
        type: "relation",
        relation: proxyRemoteSelect,
      },
      { key: "last_seen_at", label: "心跳", type: "datetime" },
    ],
    filters: [
      {
        key: "provider",
        label: "供应商",
        type: "select",
        options: providerOptions,
      },
      {
        key: "business_platform",
        label: "业务平台",
        type: "select",
        options: businessPlatformOptions,
      },
      {
        key: "status",
        label: "状态",
        type: "select",
        options: slotStatusOptions,
      },
      {
        key: "keyword",
        label: "关键词",
        placeholder: "Profile ID / 编号 / 名称",
      },
    ],
    createFields: [
      {
        key: "runtime_platform",
        label: "执行平台",
        type: "select",
        options: runtimePlatformOptions,
        defaultValue: "fingerprint_browser",
      },
      {
        key: "provider",
        label: "供应商",
        type: "select",
        options: providerOptions,
        defaultValue: "adspower",
      },
      {
        key: "slot_type",
        label: "设备类型",
        type: "select",
        options: slotTypeOptions,
        defaultValue: "fingerprint_profile",
      },
      { key: "provider_slot_id", label: "Provider 设备 ID", required: true },
      { key: "provider_slot_no", label: "Provider 编号" },
      { key: "display_name", label: "显示名称" },
      {
        key: "business_platform",
        label: "业务平台",
        type: "select",
        options: businessPlatformOptions,
        defaultValue: "threads",
      },
    ],
    updateFields: [
      { key: "provider_slot_no", label: "Provider 编号" },
      { key: "display_name", label: "显示名称" },
      {
        key: "business_platform",
        label: "业务平台",
        type: "select",
        options: businessPlatformOptions,
      },
      {
        key: "status",
        label: "状态",
        type: "select",
        options: slotStatusOptions,
      },
    ],
    rowActions: [
      {
        key: "enable",
        label: "启用",
        method: "POST",
        icon: "power",
        path: (record) => `/api/execution-slots/${record.id}/enable`,
        variant: "success",
      },
      {
        key: "disable",
        label: "禁用",
        method: "POST",
        icon: "powerOff",
        path: (record) => `/api/execution-slots/${record.id}/disable`,
        variant: "danger",
        confirm: "确认禁用该设备？",
      },
    ],
  },

  slotGroups: {
    key: "slotGroups",
    title: "设备分组",
    endpoint: "/api/slot-groups",
    slotGroupMembers: true,
    deleteLabel: "删除",
    deletePath: (record) => `/api/slot-groups/${record.id}?force=true`,
    directDelete: true,
    deleteConfirm:
      "确认删除该设备组？删除后组内设备会自动解绑，设备本身不会删除。",
    createLabel: "新增设备组",
    columns: [
      { key: "id", label: "ID", type: "id" },
      { key: "name", label: "名称" },
      { key: "runtime_platform", label: "执行平台" },
      { key: "provider", label: "供应商" },
      { key: "business_platform", label: "平台" },
      { key: "member_count", label: "成员数" },
      { key: "updated_at", label: "更新时间", type: "datetime" },
    ],
    filters: [
      {
        key: "runtime_platform",
        label: "执行平台",
        type: "select",
        options: runtimePlatformOptions,
      },
      {
        key: "provider",
        label: "供应商",
        type: "select",
        options: providerOptions,
      },
      {
        key: "business_platform",
        label: "业务平台",
        type: "select",
        options: businessPlatformOptions,
      },
      { key: "keyword", label: "关键词", placeholder: "名称 / 描述" },
    ],
    createFields: [
      {
        key: "runtime_platform",
        label: "执行平台",
        type: "select",
        options: runtimePlatformOptions,
        defaultValue: "fingerprint_browser",
      },
      {
        key: "provider",
        label: "供应商",
        type: "select",
        options: providerOptions,
        defaultValue: "adspower",
      },
      {
        key: "business_platform",
        label: "业务平台",
        type: "select",
        options: businessPlatformOptions,
        defaultValue: "threads",
      },
      { key: "name", label: "名称", required: true },
      { key: "description", label: "描述", type: "textarea", span: 2 },
    ],
    updateFields: [
      { key: "name", label: "名称" },
      { key: "description", label: "描述", type: "textarea", span: 2 },
    ],
  },

  proxies: {
    key: "proxies",
    title: "代理资源",
    endpoint: "/api/resource-center/proxies",
    createEndpoint: "/api/resource-center/proxies/import",
    createLabel: "导入代理",
    loadEditRecord: loadProxyForEdit,
    updateBody: buildProxyUpdateBody,
    columns: [
      { key: "id", label: "ID", type: "id" },
      { key: "name", label: "名称" },
      { key: "group_names", label: "所属分组", type: "list", minWidth: 180 },
      { key: "proxy_mode", label: "类型", options: proxyModeOptions, align: "center" },
      { key: "source_proxy_url", label: "Socks5 链接", minWidth: 360 },
      {
        key: "status",
        label: "使用状态",
        type: "status",
      },
      { key: "updated_at", label: "更新时间", type: "datetime" },
    ],
    filters: [
      {
        key: "proxy_mode",
        label: "代理类型",
        type: "select",
        options: proxyModeOptions,
      },
      {
        key: "status",
        label: "使用状态",
        type: "select",
        options: proxyUsageStatusOptions,
      },
      {
        key: "keyword",
        label: "关键词",
        placeholder: "名称 / Host / 用户名 / 备注",
      },
    ],
    createFields: [
      { key: "name", label: "代理名称 / 批量前缀", required: true },
      {
        key: "proxy_mode",
        label: "代理类型",
        type: "select",
        options: proxyModeOptions,
        defaultValue: "static",
        required: true,
      },
      {
        key: "proxy_urls",
        label: "Socks5 地址",
        type: "textarea",
        required: true,
        span: 2,
        placeholder:
          "socks5://user:pass@127.0.0.1:1080\nsocks5://user:pass@127.0.0.2:1080",
      },
      { key: "remark", label: "备注", span: 2 },
    ],
    updateFields: [
      { key: "name", label: "代理名称" },
      {
        key: "proxy_mode",
        label: "代理类型",
        type: "select",
        options: proxyModeOptions,
      },
      { key: "host", label: "Host", required: true },
      { key: "port", label: "端口", type: "number", required: true },
      { key: "username", label: "用户名", allowEmpty: true },
      { key: "password", label: "密码", allowEmpty: true },
      {
        key: "status",
        label: "使用状态",
        type: "select",
        options: proxyUsageStatusOptions,
      },
      {
        key: "group_ids",
        label: "所属代理组",
        type: "remoteSelect",
        remote: proxyGroupMultiSelect,
        allowEmpty: true,
        span: 2,
      },
      { key: "remark", label: "备注", span: 2, allowEmpty: true },
    ],
    batchActions: [
      {
        key: "batch-add-group",
        label: "批量加入分组",
        method: "POST",
        icon: "users",
        fields: [
          {
            key: "group_id",
            label: "代理组",
            type: "remoteSelect",
            remote: proxyGroupRemoteSelect,
            required: true,
          },
        ],
        batchPath: (_records, payload) => `/api/resource-center/proxy-groups/${payload?.group_id}/proxies`,
        batchBody: (_payload, records) => ({ proxy_ids: records.map((record) => String(record.id)) }),
        successMessage: (data) =>
          `已加入 ${Number(data.added_count || 0)} 个代理，跳过 ${Number(data.skipped_count || 0)} 个已在分组内的代理`,
      },
    ],
    deleteLabel: "删除",
    deleteConfirm: "确认删除该代理？删除前请确认它没有关联账号或设备。",
  },

  proxyGroups: {
    key: "proxyGroups",
    title: "代理分组",
    endpoint: "/api/resource-center/proxy-groups",
    createLabel: "新增代理组",
    proxyGroupMembers: true,
    columns: [
      { key: "id", label: "ID", type: "id" },
      { key: "name", label: "名称" },
      { key: "member_count", label: "成员数", align: "center" },
      { key: "updated_at", label: "更新时间", type: "datetime" },
    ],
    filters: [
      { key: "keyword", label: "关键词", placeholder: "名称 / 描述" },
    ],
    createFields: [
      { key: "name", label: "名称", required: true },
      { key: "description", label: "描述", type: "textarea", span: 2 },
    ],
    updateFields: [
      { key: "name", label: "名称" },
      { key: "description", label: "描述", type: "textarea", span: 2 },
    ],
    deleteLabel: "删除",
    deletePath: (record) => `/api/resource-center/proxy-groups/${record.id}?force=true`,
    directDelete: true,
    deleteConfirm:
      "确认删除该代理组？删除后组内成员会自动解绑，分组本身不可恢复，请谨慎操作。",
  },

  contents: {
    key: "contents",
    title: "内容库",
    endpoint: "/api/content-center/contents",
    createLabel: "新增内容",
    headerActions: [
      {
        key: "import",
        label: "批量导入内容",
        method: "POST",
        icon: "upload",
        path: () => "/api/content-center/contents/import",
        successTitle: "内容导入完成",
        successMessage: (data) => formatContentImportSuccess(data),
        fields: [
          {
            key: "business_platform",
            label: "业务 App",
            type: "select",
            options: businessPlatformOptions,
            defaultValue: "threads",
          },
          {
            key: "content_type",
            label: "内容类型",
            type: "select",
            options: contentTypeOptions,
            defaultValue: "text",
          },
          {
            key: "status",
            label: "状态",
            type: "select",
            options: contentStatusOptions,
            defaultValue: "draft",
          },
          {
            key: "split_mode",
            label: "拆分方式",
            type: "select",
            options: [
              { label: "每行一条", value: "line" },
              { label: "空行分隔", value: "blank_line" },
            ],
            defaultValue: "line",
          },
          {
            key: "duplicate_policy",
            label: "重复处理",
            type: "select",
            options: [
              { label: "跳过重复内容", value: "skip" },
              { label: "允许重复导入", value: "allow" },
            ],
            defaultValue: "skip",
          },
          { key: "title_prefix", label: "标题前缀", placeholder: "可选，例如 Threads内容" },
          { key: "tags", label: "标签", type: "tags", placeholder: "多个标签用逗号或换行分隔" },
          {
            key: "raw_text",
            label: "内容文本",
            type: "textImport",
            required: true,
            span: 2,
            placeholder: "默认每行导入为一条内容；如果内容本身有换行，可以选择空行分隔。",
          },
          { key: "remark", label: "备注", type: "textarea", span: 2 },
        ],
      },
    ],
    columns: [
      { key: "id", label: "ID", type: "id", align: "center" },
      { key: "title", label: "内容标题", minWidth: 240 },
      { key: "business_platform", label: "业务 App", align: "center" },
      { key: "content_type", label: "内容类型", options: contentTypeOptions, align: "center" },
      { key: "status", label: "状态", type: "status", align: "center" },
      { key: "updated_at", label: "更新时间", type: "datetime", minWidth: 170, align: "center" },
    ],
    filters: [
      {
        key: "business_platform",
        label: "业务 App",
        type: "select",
        options: businessPlatformOptions,
      },
      {
        key: "content_type",
        label: "内容类型",
        type: "select",
        options: contentTypeOptions,
      },
      {
        key: "status",
        label: "状态",
        type: "select",
        options: contentStatusOptions,
      },
      { key: "tags", label: "标签", placeholder: "多个标签用逗号分隔" },
      { key: "keyword", label: "关键词", placeholder: "标题 / 正文 / 备注" },
    ],
    createFields: [
      {
        key: "business_platform",
        label: "业务 App",
        type: "select",
        options: businessPlatformOptions,
        defaultValue: "threads",
      },
      { key: "title", label: "内容标题", required: true },
      {
        key: "content_type",
        label: "内容类型",
        type: "select",
        options: contentTypeOptions,
        defaultValue: "text",
      },
      {
        key: "status",
        label: "状态",
        type: "select",
        options: contentStatusOptions,
        defaultValue: "draft",
      },
      {
        key: "material_asset_ids",
        label: "关联素材",
        type: "remoteSelect",
        remote: mediaAssetMultiSelect,
        span: 2,
        allowEmpty: true,
        placeholder: "可选择一个或多个素材",
      },
      {
        key: "text_body",
        label: "内容正文",
        type: "textarea",
        span: 2,
        placeholder: "填写要发布的正文。没有正文时需要至少选择一个素材。",
      },
      { key: "tags", label: "标签", type: "tags", placeholder: "多个标签用逗号或换行分隔" },
      { key: "remark", label: "备注", type: "textarea", span: 2 },
    ],
    updateFields: [
      {
        key: "business_platform",
        label: "业务 App",
        type: "select",
        options: businessPlatformOptions,
      },
      { key: "title", label: "内容标题" },
      {
        key: "content_type",
        label: "内容类型",
        type: "select",
        options: contentTypeOptions,
      },
      {
        key: "status",
        label: "状态",
        type: "select",
        options: contentStatusOptions,
      },
      {
        key: "material_asset_ids",
        label: "关联素材",
        type: "remoteSelect",
        remote: mediaAssetMultiSelect,
        span: 2,
        allowEmpty: true,
        placeholder: "可选择一个或多个素材",
      },
      { key: "text_body", label: "内容正文", type: "textarea", span: 2, allowEmpty: true },
      { key: "tags", label: "标签", type: "tags", placeholder: "多个标签用逗号或换行分隔" },
      { key: "remark", label: "备注", type: "textarea", span: 2, allowEmpty: true },
    ],
    deleteLabel: "删除",
    directDelete: true,
    deleteConfirm:
      "确认删除该内容？删除后任务模板和已创建任务里只会保留历史参数快照，请谨慎操作。",
  },

  mediaAssets: {
    key: "mediaAssets",
    title: "素材库",
    endpoint: "/api/content-center/media-assets",
    createEndpoint: "/api/content-center/media-assets/upload",
    createLabel: "上传素材",
    createBody: (payload) => buildMediaUploadBody(payload),
    columns: [
      { key: "id", label: "ID", type: "id", align: "center" },
      { key: "name", label: "素材名称", minWidth: 220 },
      { key: "business_platform", label: "业务 App", align: "center" },
      { key: "asset_type", label: "素材类型", options: mediaAssetTypeOptions, align: "center" },
      { key: "source_url", label: "素材预览", type: "assetPreview", options: mediaAssetTypeOptions, width: 180, align: "center" },
      { key: "status", label: "状态", type: "status", align: "center" },
      { key: "updated_at", label: "更新时间", type: "datetime", minWidth: 170, align: "center" },
    ],
    filters: [
      {
        key: "business_platform",
        label: "业务 App",
        type: "select",
        options: businessPlatformOptions,
      },
      {
        key: "asset_type",
        label: "素材类型",
        type: "select",
        options: mediaAssetTypeOptions,
      },
      {
        key: "status",
        label: "状态",
        type: "select",
        options: mediaAssetStatusOptions,
      },
      { key: "tags", label: "标签", placeholder: "多个标签用逗号分隔" },
      { key: "keyword", label: "关键词", placeholder: "名称 / 地址 / 备注" },
    ],
    createFields: [
      {
        key: "file",
        label: "素材文件",
        type: "file",
        required: true,
        placeholder: "请选择图片、视频或文件",
      },
      {
        key: "business_platform",
        label: "业务 App",
        type: "select",
        options: businessPlatformOptions,
        defaultValue: "threads",
      },
      { key: "name", label: "素材名称", placeholder: "不填时使用文件名" },
      {
        key: "asset_type",
        label: "素材类型",
        type: "select",
        options: mediaAssetTypeOptions,
        placeholder: "不选时自动识别",
      },
      {
        key: "status",
        label: "状态",
        type: "select",
        options: mediaAssetStatusOptions,
        defaultValue: "enabled",
      },
      { key: "tags", label: "标签", type: "tags", placeholder: "多个标签用逗号或换行分隔" },
      { key: "remark", label: "备注", type: "textarea", span: 2 },
    ],
    updateFields: [
      {
        key: "business_platform",
        label: "业务 App",
        type: "select",
        options: businessPlatformOptions,
      },
      { key: "name", label: "素材名称" },
      {
        key: "asset_type",
        label: "素材类型",
        type: "select",
        options: mediaAssetTypeOptions,
      },
      {
        key: "status",
        label: "状态",
        type: "select",
        options: mediaAssetStatusOptions,
      },
      { key: "tags", label: "标签", type: "tags", placeholder: "多个标签用逗号或换行分隔" },
      { key: "remark", label: "备注", type: "textarea", span: 2, allowEmpty: true },
    ],
    rowActions: [
      {
        key: "download",
        label: "下载",
        icon: "download",
        clientAction: "download",
        urlKey: "source_url",
        filenameKey: "name",
        refresh: false,
      },
    ],
    inlineActionKeys: ["download"],
    deleteLabel: "删除",
    directDelete: true,
    deleteConfirm: "确认删除该素材？仍被内容引用的素材后端会阻止删除。",
  },

  scripts: {
    key: "scripts",
    title: "脚本管理",
    endpoint: "/api/scripts",
    createLabel: "新增脚本",
    columns: [
      { key: "id", label: "ID", type: "id", width: 80, align: "center" },
      { key: "script_key", label: "脚本 Key", type: "tag", width: 200, align: "center" },
      { key: "name", label: "名称", minWidth: 250, align: "center" },
      {
        key: "supported_business_platforms",
        label: "业务 App 范围",
        type: "list",
        width: 160,
        align: "center",
      },
      { key: "status", label: "状态", type: "status", width: 80, align: "center" },
      { key: "updated_at", label: "更新时间", type: "datetime", width: 180, align: "center" },
    ],
    filters: [
      {
        key: "status",
        label: "状态",
        type: "select",
        options: scriptStatusOptions,
      },
      {
        key: "runtime_platform",
        label: "执行平台",
        type: "select",
        options: runtimePlatformOptions,
      },
      {
        key: "provider",
        label: "供应商",
        type: "select",
        options: providerOptions,
      },
      {
        key: "business_platform",
        label: "业务平台",
        type: "select",
        options: businessPlatformOptions,
      },
      { key: "keyword", label: "关键词", placeholder: "Key / 名称 / 描述" },
    ],
    createFields: [
      { key: "script_key", label: "脚本 Key", required: true },
      { key: "name", label: "脚本名称", required: true },
      {
        key: "status",
        label: "状态",
        type: "select",
        options: scriptStatusOptions,
        defaultValue: "enabled",
      },
      {
        key: "supported_runtime_platforms",
        label: "执行平台范围",
        type: "select",
        multiple: true,
        options: runtimePlatformOptions,
        defaultValue: ["fingerprint_browser"],
      },
      {
        key: "supported_providers",
        label: "供应商范围",
        type: "select",
        multiple: true,
        options: providerOptions,
        defaultValue: ["adspower"],
      },
      {
        key: "supported_business_platforms",
        label: "业务 App 范围",
        type: "select",
        multiple: true,
        options: businessPlatformOptions,
        defaultValue: ["threads"],
      },
      {
        key: "max_timeout_seconds",
        label: "最大超时秒",
        type: "number",
        defaultValue: 3600,
      },
      { key: "description", label: "描述", type: "textarea", span: 2 },
      {
        key: "params",
        label: "脚本参数定义",
        type: "scriptParams",
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
      { key: "name", label: "脚本名称" },
      {
        key: "status",
        label: "状态",
        type: "select",
        options: scriptStatusOptions,
      },
      {
        key: "supported_runtime_platforms",
        label: "执行平台范围",
        type: "select",
        multiple: true,
        options: runtimePlatformOptions,
      },
      {
        key: "supported_providers",
        label: "供应商范围",
        type: "select",
        multiple: true,
        options: providerOptions,
      },
      {
        key: "supported_business_platforms",
        label: "业务 App 范围",
        type: "select",
        multiple: true,
        options: businessPlatformOptions,
      },
      { key: "max_timeout_seconds", label: "最大超时秒", type: "number" },
      { key: "description", label: "描述", type: "textarea", span: 2 },
      {
        key: "params",
        label: "脚本参数定义",
        type: "scriptParams",
        options: scriptParamTypeOptions,
        defaultValue: [],
        span: 2,
      },
    ],
    rowActions: [
      {
        key: "enable",
        label: "启用",
        method: "POST",
        icon: "power",
        path: (record) => `/api/scripts/${record.id}/enable`,
        variant: "success",
      },
      {
        key: "disable",
        label: "禁用",
        method: "POST",
        icon: "powerOff",
        path: (record) => `/api/scripts/${record.id}/disable`,
        variant: "danger",
        confirm: "确认禁用该脚本？",
      },
    ],
    deleteLabel: "删除",
    directDelete: true,
    deleteConfirm:
      "确认删除该脚本？删除会同步清理脚本参数、对应任务模板、任务记录、任务事件和分配记录，请谨慎操作。",
  },

  taskTemplates: {
    key: "taskTemplates",
    title: "任务模板",
    endpoint: "/api/task-templates",
    createLabel: "新增模板",
    inlineActionKeys: ["clone"],
    directDelete: true,
    createBody: (payload) => buildTaskTemplateBody(payload),
    loadEditRecord: async (record) => ({
      ...record,
      execution_window: buildExecutionWindow(record),
    }),
    updateBody: (payload, record) => buildTaskTemplateBody(payload, record),
    columns: [
      { key: "id", label: "ID", type: "id" },
      { key: "name", label: "名称" },
      {
        key: "script_key",
        label: "脚本",
        type: "relation",
        relation: scriptRemoteSelect,
      },
      { key: "business_platform", label: "平台" },
      { key: "status", label: "状态", type: "status" },
      { key: "updated_at", label: "更新时间", type: "datetime" },
    ],
    filters: [
      {
        key: "business_platform",
        label: "业务平台",
        type: "select",
        options: businessPlatformOptions,
      },
      {
        key: "script_key",
        label: "脚本",
        type: "remoteSelect",
        remote: scriptRemoteSelect,
        placeholder: "全部脚本",
      },
      {
        key: "status",
        label: "状态",
        type: "select",
        options: templateStatusOptions,
      },
      { key: "keyword", label: "关键词", placeholder: "名称 / 描述" },
    ],
    createFields: [
      { key: "name", label: "模板名称", required: true },
      {
        key: "script_key",
        label: "脚本",
        type: "remoteSelect",
        required: true,
        remote: scriptRemoteSelect,
        placeholder: "请选择脚本",
      },
      {
        key: "business_platform",
        label: "业务平台",
        type: "select",
        options: businessPlatformOptions,
        scriptScopeKey: "supported_business_platforms",
        defaultValue: "threads",
      },
      {
        key: "runtime_platform",
        label: "执行平台",
        type: "select",
        options: runtimePlatformOptions,
        scriptScopeKey: "supported_runtime_platforms",
        defaultValue: "fingerprint_browser",
      },
      {
        key: "provider",
        label: "供应商",
        type: "select",
        options: providerOptions,
        scriptScopeKey: "supported_providers",
        defaultValue: "adspower",
      },
      {
        key: "account_scope_type",
        hidden: true,
        label: "账号范围",
        type: "select",
        options: accountScopeTypeOptions,
        defaultValue: "single_account",
      },
      {
        key: "execution_count",
        label: "每台设备执行次数",
        type: "number",
        defaultValue: 1,
      },
      {
        key: "execution_mode",
        label: "执行模式",
        type: "select",
        options: executionModeOptions,
        defaultValue: "immediate",
      },
      {
        key: "execution_window",
        label: "允许执行时段",
        type: "datetimeRange",
        defaultValue: [],
        span: 2,
        disabledWhen: { key: "execution_mode", value: "immediate" },
        placeholder: "请选择允许执行的开始和结束日期时间",
      },
      {
        key: "status",
        label: "状态",
        type: "select",
        options: templateStatusOptions,
        defaultValue: "enabled",
      },
      {
        key: "slot_id",
        hidden: true,
        label: "默认设备",
        type: "remoteSelect",
        remote: slotRemoteSelect,
        placeholder: "请选择默认设备",
      },
      {
        key: "slot_group_id",
        hidden: true,
        label: "默认设备组",
        type: "remoteSelect",
        remote: slotGroupRemoteSelect,
        placeholder: "请选择默认设备组",
      },
      {
        key: "account_ids",
        hidden: true,
        label: "账号列表",
        type: "remoteSelect",
        remote: accountMultiSelect,
        defaultValue: [],
        span: 2,
        placeholder: "请选择账号",
      },
      {
        key: "account_group_ids",
        hidden: true,
        label: "账号组列表",
        type: "remoteSelect",
        remote: accountGroupMultiSelect,
        defaultValue: [],
        span: 2,
        placeholder: "请选择账号组",
      },
      {
        key: "default_params",
        label: "默认参数",
        type: "templateParams",
        defaultValue: {},
        span: 2,
        dependencyKey: "script_key",
      },
      { key: "description", label: "描述", type: "textarea", span: 2 },
    ],
    updateFields: [
      { key: "name", label: "模板名称" },
      {
        key: "script_key",
        label: "脚本",
        type: "remoteSelect",
        remote: scriptRemoteSelect,
        placeholder: "请选择脚本",
      },
      {
        key: "business_platform",
        label: "业务平台",
        type: "select",
        options: businessPlatformOptions,
        scriptScopeKey: "supported_business_platforms",
      },
      {
        key: "runtime_platform",
        label: "执行平台",
        type: "select",
        options: runtimePlatformOptions,
        scriptScopeKey: "supported_runtime_platforms",
      },
      {
        key: "provider",
        label: "供应商",
        type: "select",
        options: providerOptions,
        scriptScopeKey: "supported_providers",
      },
      {
        key: "account_scope_type",
        hidden: true,
        label: "账号范围",
        type: "select",
        options: accountScopeTypeOptions,
      },
      {
        key: "execution_count",
        label: "每台设备执行次数",
        type: "number",
      },
      {
        key: "execution_mode",
        label: "执行模式",
        type: "select",
        options: executionModeOptions,
      },
      {
        key: "execution_window",
        label: "允许执行时段",
        type: "datetimeRange",
        defaultValue: [],
        span: 2,
        disabledWhen: { key: "execution_mode", value: "immediate" },
        placeholder: "请选择允许执行的开始和结束日期时间",
      },
      {
        key: "status",
        label: "状态",
        type: "select",
        options: templateStatusOptions,
      },
      {
        key: "slot_id",
        hidden: true,
        label: "默认设备",
        type: "remoteSelect",
        remote: slotRemoteSelect,
        placeholder: "请选择默认设备",
      },
      {
        key: "slot_group_id",
        hidden: true,
        label: "默认设备组",
        type: "remoteSelect",
        remote: slotGroupRemoteSelect,
        placeholder: "请选择默认设备组",
      },
      {
        key: "account_ids",
        hidden: true,
        label: "账号列表",
        type: "remoteSelect",
        remote: accountMultiSelect,
        span: 2,
        placeholder: "请选择账号",
      },
      {
        key: "account_group_ids",
        hidden: true,
        label: "账号组列表",
        type: "remoteSelect",
        remote: accountGroupMultiSelect,
        span: 2,
        placeholder: "请选择账号组",
      },
      {
        key: "default_params",
        label: "默认参数",
        type: "templateParams",
        span: 2,
        dependencyKey: "script_key",
      },
      { key: "description", label: "描述", type: "textarea", span: 2 },
    ],
    rowActions: [
      {
        key: "clone",
        label: "克隆模板",
        method: "POST",
        icon: "copy",
        path: (record) => `/api/task-templates/${record.id}/clone`,
        fields: [{ key: "name", label: "新模板名称" }],
      },
      {
        key: "enable",
        label: "启用模板",
        method: "POST",
        icon: "power",
        path: (record) => `/api/task-templates/${record.id}/enable`,
        variant: "success",
      },
      {
        key: "disable",
        label: "禁用模板",
        method: "POST",
        icon: "powerOff",
        variant: "danger",
        path: (record) => `/api/task-templates/${record.id}/disable`,
        confirm: "确认禁用该任务模板？禁用后不能再基于它创建任务。",
      },
    ],
    deleteLabel: "删除",
    deleteConfirm:
      "确认删除该任务模板？删除后不可恢复，但已创建任务会保留参数快照。",
  },

  tasks: {
    key: "tasks",
    title: "任务记录",
    endpoint: "/api/tasks",
    createEndpoint: "/api/tasks/from-template",
    createLabel: "下发任务",
    createBody: (payload) => buildTaskDispatchBody(payload),
    columns: [
      { key: "id", label: "ID", type: "id" },
      { key: "title", label: "任务名称" },
      {
        key: "script_key",
        label: "脚本",
        type: "relation",
        relation: scriptRemoteSelect,
      },
      { key: "business_platform", label: "平台" },
      { key: "status", label: "状态", type: "status" },
      { key: "child_succeeded", label: "成功", align: "center" },
      { key: "child_failed", label: "失败", align: "center" },
      { key: "child_canceled", label: "取消", align: "center" },
      { key: "scheduled_at", label: "计划时间", type: "datetime" },
      { key: "finished_at", label: "结束时间", type: "datetime" },
      { key: "created_at", label: "创建时间", type: "datetime" },
    ],
    filters: [
      {
        key: "status",
        label: "状态",
        type: "select",
        options: taskStatusOptions,
      },
      {
        key: "business_platform",
        label: "业务平台",
        type: "select",
        options: businessPlatformOptions,
      },
      {
        key: "script_key",
        label: "脚本",
        type: "remoteSelect",
        remote: scriptRemoteSelect,
        placeholder: "全部脚本",
      },
      {
        key: "template_id",
        label: "来源模板",
        type: "remoteSelect",
        remote: taskTemplateRemoteSelect,
        placeholder: "全部模板",
      },
      {
        key: "keyword",
        label: "关键词",
        placeholder: "任务 ID / 标题 / 错误信息",
      },
    ],
    createFields: [
      {
        key: "template_id",
        label: "任务模板",
        type: "templateSelect",
        required: true,
        remote: taskTemplateRemoteSelect,
        placeholder: "请选择任务模板",
      },
      { key: "title_prefix", label: "任务名称", placeholder: "为空时使用模板名称" },
      {
        key: "script_key",
        label: "脚本",
        type: "remoteSelect",
        remote: scriptRemoteSelect,
        readonly: true,
        placeholder: "选择模板后自动带出",
      },
      {
        key: "business_platform",
        label: "业务 App",
        type: "select",
        options: businessPlatformOptions,
        readonly: true,
      },
      {
        key: "runtime_platform",
        label: "执行平台",
        type: "select",
        options: runtimePlatformOptions,
        readonly: true,
      },
      {
        key: "provider",
        label: "供应商",
        type: "select",
        options: providerOptions,
        readonly: true,
      },
      {
        key: "execution_mode",
        label: "执行模式",
        type: "select",
        options: executionModeOptions,
        readonly: true,
      },
      {
        key: "execution_count",
        label: "每台设备执行次数",
        type: "number",
        required: true,
        defaultValue: 1,
      },
      { key: "scheduled_at", label: "计划时间（计划模式必填）", type: "datetime" },
      {
        key: "slot_ids",
        label: "设备组 / 设备",
        type: "slotTree",
        required: true,
        defaultValue: [],
      },
      {
        key: "params",
        label: "覆盖参数",
        type: "templateParams",
        defaultValue: {},
        dependencyKey: "script_key",
      },
    ],
    updateFields: [],
    deleteLabel: "删除记录",
    deleteConfirm:
      "确认删除这条任务记录？删除后会同步删除它的设备执行子记录、分配记录和事件日志，此操作不可恢复，请谨慎操作。",
    inlineActionKeys: ["detail", "retry"],
    rowActions: [
      {
        key: "detail",
        label: "任务详情",
        method: "GET",
        icon: "list",
        path: (record) => `/api/tasks/${record.id}`,
        refresh: false,
      },
      {
        key: "cancel",
        label: "取消任务",
        method: "POST",
        icon: "powerOff",
        variant: "danger",
        path: (record) => `/api/tasks/${record.id}/cancel`,
        confirm: "确认取消该任务？系统只会取消尚未开始的设备执行记录，已经下发或正在运行的记录不会被干涉。",
      },
      {
        key: "retry",
        label: "重试任务",
        method: "POST",
        icon: "rotate",
        path: (record) => `/api/tasks/${record.id}/retry`,
        confirm: "确认基于该任务的失败、过期、断连或取消记录创建重试任务吗？",
      },
    ],
  },

  operationLogs: {
    key: "operationLogs",
    title: "操作日志",
    endpoint: "/api/operation-logs",
    readOnly: true,
    columns: [
      { key: "id", label: "ID", type: "id", align: "center" },
      { key: "operator_name", label: "操作人", align: "center" },
      { key: "action", label: "操作动作", type: "tag", align: "center" },
      { key: "resource_type", label: "资源类型", align: "center" },
      { key: "resource_id", label: "资源 ID", type: "id", align: "center" },
      { key: "resource_name", label: "资源名称", align: "center" },
      { key: "description", label: "说明", minWidth: 220 },
      { key: "created_at", label: "操作时间", type: "datetime", align: "center", minWidth: 170 },
    ],
    filters: [
      { key: "action", label: "操作动作", placeholder: "例如 task.retry" },
      { key: "resource_type", label: "资源类型", placeholder: "例如 task" },
      { key: "keyword", label: "关键字", placeholder: "操作人 / 资源 / 说明" },
    ],
  },

  runtimes: {
    key: "runtimes",
    title: "Runtime 在线状态",
    endpoint: "/api/runtimes",
    readOnly: true,
    columns: [
      { key: "id", label: "ID", type: "id" },
      { key: "runtime_id", label: "Runtime ID" },
      { key: "runtime_platform", label: "执行平台" },
      { key: "provider", label: "供应商" },
      { key: "status", label: "状态", type: "status" },
      { key: "slot_total", label: "设备总数" },
      { key: "slot_idle", label: "空闲设备" },
      { key: "slot_running", label: "运行中设备" },
      { key: "last_heartbeat_at", label: "心跳", type: "datetime" },
    ],
    filters: [
      {
        key: "status",
        label: "状态",
        type: "select",
        options: runtimeStatusOptions,
      },
      {
        key: "provider",
        label: "供应商",
        type: "select",
        options: providerOptions,
      },
      {
        key: "runtime_platform",
        label: "执行平台",
        type: "select",
        options: runtimePlatformOptions,
      },
    ],
    inlineActionKeys: ["detail"],
    rowActions: [
      {
        key: "detail",
        label: "查看详情",
        method: "GET",
        icon: "list",
        path: (record) => `/api/runtimes/${record.id}`,
        refresh: false,
      },
      {
        key: "slots",
        label: "查看设备",
        method: "GET",
        icon: "list",
        path: (record) => `/api/runtimes/${record.id}/slots`,
        refresh: false,
        resultColumns: [
          { key: "id", label: "ID", type: "id", minWidth: 110 },
          { key: "display_name", label: "名称", minWidth: 160 },
          { key: "provider_slot_id", label: "Provider ID", minWidth: 170 },
          { key: "status", label: "状态", type: "status", width: 120 },
          { key: "bound_account_id", label: "账号", type: "id", minWidth: 120 },
          {
            key: "current_task_run_id",
            label: "当前任务",
            type: "id",
            minWidth: 120,
          },
          {
            key: "last_seen_at",
            label: "心跳",
            type: "datetime",
            minWidth: 180,
          },
        ],
      },
    ],
  },
};
