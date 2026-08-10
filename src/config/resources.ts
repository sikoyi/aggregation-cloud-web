import { http } from "@/api/http";
import type { AnyRecord } from "@/types/api";
import { normalizeThreadsPostUrl } from "@/utils/platformUrls";
import type { FieldConfig, ResourceConfig } from "@/types/crud";

import {
  accountCountryOptions,
  accountDelimiterOptions,
  businessPlatformOptions,
  contentStatusFilterOptions,
  contentStatusOptions,
  contentTypeOptions,
  commentStatusOptions,
  accountScopeTypeOptions,
  executionModeOptions,
  interactionActionStatusOptions,
  interactionActionTypeOptions,
  interactionSessionStatusOptions,
  loginStatusOptions,
  mediaAssetStatusOptions,
  mediaAssetTypeOptions,
  providerOptions,
  publishedContentStatusOptions,
  publishedContentTypeOptions,
  proxyModeOptions,
  proxyProtocolOptions,
  proxyUsageStatusOptions,
  runtimePlatformOptions,
  runtimeStatusOptions,
  scriptParamTypeOptions,
  scriptPurposeOptions,
  scriptStatusOptions,
  slotStatusOptions,
  slotTypeOptions,
  templateStatusOptions,
  taskStatusOptions,
  twoFaOptions,
} from "./options";

function includesScopeValue(values: unknown, value: unknown) {
  if (!value) return true;
  return Array.isArray(values) && values.map(String).includes(String(value));
}

function scriptMatchesContext(script: AnyRecord, context?: AnyRecord) {
  if (script.status && script.status !== "enabled") return false;
  return (
    includesScopeValue(script.supported_business_platforms, context?.business_platform)
    && includesScopeValue(script.supported_runtime_platforms, context?.runtime_platform)
    && includesScopeValue(script.supported_providers, context?.provider)
  );
}

function targetContentMatchesContext(content: AnyRecord, context?: AnyRecord) {
  if (!context?.main_account_id) return false;
  if (context.business_platform && content.business_platform !== context.business_platform) return false;
  return String(content.author_account_id || "") === String(context.main_account_id);
}

function runtimePlatformLabel(value: unknown) {
  const platform = String(value || "");
  return runtimePlatformOptions.find((option) => option.value === platform)?.label || platform;
}

function scriptRuntimePlatformLabel(script: AnyRecord) {
  const values = Array.isArray(script.supported_runtime_platforms)
    ? script.supported_runtime_platforms.map(String)
    : [];
  return values
    .map((value) => runtimePlatformLabel(value))
    .join("、");
}

const scriptRemoteSelect = {
  endpoint: "/api/scripts",
  labelKey: "name",
  valueKey: "script_key",
  detailPath: (value: string) =>
    `/api/scripts/by-key/${encodeURIComponent(value)}`,
  secondaryFormatter: scriptRuntimePlatformLabel,
  searchParam: "keyword",
  params: (context?: AnyRecord) => ({
    status: "enabled",
    business_platform: context?.business_platform || undefined,
    runtime_platform: context?.runtime_platform || undefined,
    provider: context?.provider || undefined,
  }),
  pageSize: 50,
  clearWhenMissing: true,
  matchesContext: scriptMatchesContext,
  emptyText: "当前业务 App / 执行平台 / 供应商下暂无可用脚本，请先在脚本管理中确认脚本支持范围",
};

const taskTemplateScriptRemoteSelect = {
  ...scriptRemoteSelect,
  // 模板必须先选脚本，再由脚本支持范围约束平台和供应商，不能反向使用系统默认值过滤脚本。
  params: () => ({
    status: "enabled",
    template_eligible: true,
  }),
  matchesContext: (script: AnyRecord) => (
    ["general_task", "account_registration"].includes(String(script.purpose))
    && scriptMatchesContext(script)
  ),
  emptyText: "暂无可用于任务模板的普通任务或账号注册脚本",
};

const slotResourceGrouping = {
  endpoint: "/api/slot-groups",
  labelKey: "name",
  valueKey: "id",
  groupParam: "group_id",
  ungroupedParam: "ungrouped",
  ungroupedLabel: "未分组设备",
  params: (context?: AnyRecord) => ({
    runtime_platform: context?.runtime_platform || undefined,
    provider: context?.provider || undefined,
  }),
};

const accountResourceGrouping = {
  ...slotResourceGrouping,
  groupParam: "slot_group_id",
  ungroupedParam: "slot_group_ungrouped",
  ungroupedLabel: "未分组账号",
};

const proxyResourceGrouping = {
  endpoint: "/api/resource-center/proxy-groups",
  labelKey: "name",
  valueKey: "id",
  groupParam: "group_id",
  ungroupedParam: "ungrouped",
  ungroupedLabel: "未分组代理",
};

const mediaAssetResourceGrouping = {
  endpoint: "/api/resource-center/media-asset-groups",
  labelKey: "name",
  valueKey: "id",
  groupParam: "group_id",
  ungroupedParam: "ungrouped",
  ungroupedLabel: "未分组素材",
  params: (context?: AnyRecord) => ({
    business_platform: context?.business_platform || undefined,
  }),
};

const contentResourceGrouping = {
  endpoint: "/api/content-center/content-groups",
  labelKey: "name",
  valueKey: "id",
  groupParam: "group_id",
  ungroupedParam: "ungrouped",
  ungroupedLabel: "未分组内容",
  params: (context?: AnyRecord) => ({
    business_platform: context?.business_platform || undefined,
  }),
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
  group: accountResourceGrouping,
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
  group: slotResourceGrouping,
};

const slotMultiSelect = {
  ...slotRemoteSelect,
  multiple: true,
};

const runtimeSlotSyncRemoteSelect = {
  endpoint: "/api/runtimes",
  labelKeys: ["runtime_id", "ip"],
  valueKey: "id",
  detailPath: (value: string) => `/api/runtimes/${encodeURIComponent(value)}`,
  secondaryKeys: ["provider", "runtime_platform", "ip"],
  statusKey: "status",
  searchParam: "keyword",
  params: { runtime_platform: "fingerprint_browser" },
  pageSize: 100,
  multiple: true,
  optionDisabled: (runtime: AnyRecord) => (
    runtime.status !== "online" || runtime.runtime_platform !== "fingerprint_browser"
  ),
  emptyText: "暂无在线指纹浏览器 Runtime，请先启动脚本端并完成连接",
};

const onlineFingerprintRuntimeRemoteSelect = {
  endpoint: "/api/runtimes",
  labelKeys: ["runtime_id", "ip"],
  valueKey: "id",
  detailPath: (value: string) => `/api/runtimes/${encodeURIComponent(value)}`,
  secondaryKeys: ["provider", "slot_running", "max_concurrent_slots"],
  pageSize: 100,
  clearWhenMissing: true,
  params: (context?: AnyRecord) => ({
    status: "online",
    runtime_platform: "fingerprint_browser",
    provider: context?.provider || undefined,
  }),
  matchesContext: (runtime: AnyRecord, context?: AnyRecord) => (
    runtime.status === "online"
    && runtime.runtime_platform === "fingerprint_browser"
    && (!context?.provider || runtime.provider === context.provider)
  ),
  emptyText: "当前供应商暂无在线 Runtime，请先启动对应脚本端",
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
  group: proxyResourceGrouping,
};

const proxyReadonlyRemoteSelect = {
  ...proxyRemoteSelect,
  params: undefined,
};

const mediaAssetRemoteSelect = {
  endpoint: "/api/resource-center/media-assets",
  labelKeys: ["name", "source_url", "storage_uri"],
  valueKey: "id",
  detailPath: (value: string) =>
    `/api/resource-center/media-assets/${encodeURIComponent(value)}`,
  secondaryKeys: ["asset_type", "status"],
  searchParam: "keyword",
  params: { status: "enabled" },
  pageSize: 50,
  group: mediaAssetResourceGrouping,
};

const mediaAssetMultiSelect = {
  ...mediaAssetRemoteSelect,
  multiple: true,
};
const commentImageMultiSelect = {
  ...mediaAssetMultiSelect,
  params: (context?: AnyRecord) => ({
    status: "enabled",
    asset_type: "image",
    business_platform: context?.business_platform || undefined,
  }),
  matchesContext: (asset: AnyRecord, context?: AnyRecord) => (
    asset.asset_type === "image"
    && asset.status === "enabled"
    && (!context?.business_platform || asset.business_platform === context.business_platform)
  ),
  emptyText: "当前业务 App 下暂无可用图片，请先在素材库上传",
};


const mediaAssetGroupRemoteSelect = {
  endpoint: "/api/resource-center/media-asset-groups",
  labelKey: "name",
  valueKey: "id",
  detailPath: (value: string) =>
    `/api/resource-center/media-asset-groups/${encodeURIComponent(value)}`,
  secondaryKeys: ["business_platform", "member_count"],
  searchParam: "keyword",
  pageSize: 50,
};

const contentGroupRemoteSelect = {
  endpoint: "/api/content-center/content-groups",
  labelKey: "name",
  valueKey: "id",
  detailPath: (value: string) =>
    `/api/content-center/content-groups/${encodeURIComponent(value)}`,
  secondaryKey: "unused_count",
  searchParam: "keyword",
  params: (context?: AnyRecord) => ({
    business_platform: context?.business_platform || undefined,
  }),
  pageSize: 50,
};

const dynamicProxyRemoteSelect = {
  ...proxyRemoteSelect,
  params: { proxy_mode: "dynamic" },
  matchesContext: (proxy: AnyRecord) => proxy.proxy_mode === "dynamic",
  emptyText: "暂无动态代理，请先在代理资源中导入并标记为动态代理",
};

const contentGroupMultiSelect = {
  ...contentGroupRemoteSelect,
  multiple: true,
};

const contentRemoteSelect = {
  endpoint: "/api/content-center/contents",
  labelKeys: ["title", "text_body"],
  valueKey: "id",
  detailPath: (value: string) =>
    `/api/content-center/contents/${encodeURIComponent(value)}`,
  secondaryKeys: ["content_type", "status"],
  searchParam: "keyword",
  params: (context?: AnyRecord) => ({
    business_platform: context?.business_platform || undefined,
    status: context?.content_status && context.content_status !== "all"
      ? context.content_status
      : undefined,
  }),
  pageSize: 50,
  group: contentResourceGrouping,
};

const publishedContentRemoteSelect = {
  endpoint: "/api/interaction-center/published-contents",
  labelKeys: ["title", "platform_content_id", "content_url"],
  valueKey: "id",
  detailPath: (value: string) =>
    `/api/interaction-center/published-contents/${encodeURIComponent(value)}`,
  secondaryKeys: ["business_platform", "status"],
  searchParam: "keyword",
  pageSize: 50,
};

const interactionTargetContentRemoteSelect = {
  ...publishedContentRemoteSelect,
  params: (context?: AnyRecord) => ({
    business_platform: context?.business_platform || undefined,
    author_account_id: context?.main_account_id || undefined,
    status: "normal",
  }),
  clearWhenMissing: true,
  matchesContext: targetContentMatchesContext,
  emptyText: (context?: AnyRecord) =>
    context?.main_account_id
      ? "当前主号暂无可选择的已发布内容"
      : "请先选择主号，再选择目标内容",
};

function buildInteractionSessionBody(payload: AnyRecord) {
  const {
    ai_provider,
    ai_language,
    ai_tone,
    ai_max_length,
    content_mode,
    custom_contents_text,
    target_source_type,
    square_target_account_ids,
    ...sessionPayload
  } = payload;
  const interactionMode = String(sessionPayload.interaction_mode || "conversation");
  const sourceType = String(target_source_type || "system_content");
  const targetContentId = String(sessionPayload.target_content_id || "").trim();
  let targetContentUrl = String(sessionPayload.target_content_url || "").trim();
  const contentMode = String(content_mode || "ai");
  const aiProvider = String(ai_provider || "").trim();
  const customContents = String(custom_contents_text || "")
    .split(/\r?\n\s*\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  const squareTargetAccountIds = Array.isArray(square_target_account_ids)
    ? [...new Set(square_target_account_ids.map((value) => String(value).trim()).filter(Boolean))]
    : [];
  if (interactionMode === "square_numeric" && !squareTargetAccountIds.length) {
    throw new Error("请至少选择一个已开启监听的目标账号");
  }
  if (interactionMode === "conversation" && sourceType === "direct_url" && !targetContentUrl) {
    throw new Error("请填写目标帖子链接");
  }
  if (interactionMode === "conversation" && sourceType === "system_content" && !targetContentId) {
    throw new Error("请选择目标内容");
  }
  if (interactionMode === "conversation" && sourceType === "direct_url" && String(sessionPayload.business_platform || "") === "threads") {
    targetContentUrl = normalizeThreadsPostUrl(targetContentUrl);
  }
  if (interactionMode === "conversation" && contentMode === "ai" && !aiProvider) {
    throw new Error("暂无已启用的互动 AI，请先到系统配置中启用");
  }
  if (contentMode === "custom" && !customContents.length) {
    throw new Error("请至少填写一条自定义评论内容");
  }
  const delayMinMinutes = Number(sessionPayload.step_delay_min_minutes ?? 1);
  const delayMaxMinutes = Number(sessionPayload.step_delay_max_minutes ?? 2);
  const browseDurationMinutes = Number(sessionPayload.browse_duration_minutes ?? 10);
  if (delayMinMinutes > delayMaxMinutes) {
    throw new Error("最短延迟不能大于最长延迟");
  }
  return {
    ...sessionPayload,
    interaction_mode: interactionMode,
    main_account_id: interactionMode === "square_numeric"
      ? null
      : String(sessionPayload.main_account_id || "").trim(),
    target_account_ids: interactionMode === "square_numeric" ? squareTargetAccountIds : [],
    step_count: interactionMode === "square_numeric" ? 1 : Number(sessionPayload.step_count || 1),
    step_delay_min_minutes: delayMinMinutes,
    step_delay_max_minutes: delayMaxMinutes,
    browse_duration_minutes: browseDurationMinutes,
    target_content_id: interactionMode === "conversation" && sourceType === "system_content" ? targetContentId : null,
    target_content_url: interactionMode === "conversation" && sourceType === "direct_url" ? targetContentUrl : null,
    content_mode: interactionMode === "square_numeric" ? "ai" : contentMode,
    custom_contents: interactionMode === "conversation" && contentMode === "custom" ? customContents : [],
    ...(interactionMode === "conversation"
      ? {
          ai_config: {
            provider: aiProvider || "gemini",
            language: String(ai_language || "auto"),
            tone: String(ai_tone || "natural"),
            max_length: Number(ai_max_length || 120),
          },
        }
      : {}),
  };
}

const accountTagRemoteSelect = {
  endpoint: "/api/account-tags",
  labelKey: "name",
  valueKey: "id",
  detailPath: (value: string) =>
    `/api/account-tags/${encodeURIComponent(value)}`,
  secondaryKey: "member_count",
  searchParam: "keyword",
  pageSize: 50,
};

const accountTagMultiSelect = {
  ...accountTagRemoteSelect,
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

const slotGroupRemoteSelect = {
  endpoint: "/api/slot-groups",
  labelKey: "name",
  valueKey: "id",
  detailPath: (value: string) =>
    `/api/slot-groups/${encodeURIComponent(value)}`,
  secondaryKey: "provider",
  searchParam: "keyword",
  pageSize: 50,
};

const slotGroupForSlotEditRemoteSelect = {
  ...slotGroupRemoteSelect,
  params: (context?: AnyRecord) => ({
    runtime_platform: context?.runtime_platform,
    provider: context?.provider,
  }),
};

const taskTemplateRemoteSelect = {
  endpoint: "/api/task-templates",
  labelKey: "name",
  valueKey: "id",
  detailPath: (value: string) =>
    `/api/task-templates/${encodeURIComponent(value)}`,
  secondaryFormatter: (template: AnyRecord) => runtimePlatformLabel(template.runtime_platform),
  searchParam: "keyword",
  params: { status: "enabled" },
  pageSize: 50,
};

const dispatchTaskTemplateRemoteSelect = {
  ...taskTemplateRemoteSelect,
  params: (context?: AnyRecord) => ({
    status: "enabled",
    runtime_platform: context?.runtime_platform || undefined,
  }),
  loadWhen: (context?: AnyRecord) => Boolean(context?.runtime_platform),
  clearWhenMissing: true,
  matchesContext: (template: AnyRecord, context?: AnyRecord) =>
    !context?.runtime_platform || String(template.runtime_platform) === String(context.runtime_platform),
  emptyText: (context?: AnyRecord) =>
    context?.runtime_platform ? "当前执行平台暂无可用任务模板" : "请先选择执行平台",
};

const scriptCreateKeys = [
  "script_key",
  "name",
  "description",
  "purpose",
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

function buildScriptBody(payload: AnyRecord, keys: string[]) {
  const body = pickPayload(payload, keys);
  const runtimePlatform = String(payload.supported_runtime_platforms || "").trim();
  body.supported_runtime_platforms = runtimePlatform ? [runtimePlatform] : [];
  return body;
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
  const runtimePlatform = Array.isArray(detail.script.supported_runtime_platforms)
    ? String(detail.script.supported_runtime_platforms[0] || "")
    : String(detail.script.supported_runtime_platforms || "");
  return {
    ...detail.script,
    supported_runtime_platforms: runtimePlatform,
    params: detail.params || [],
  };
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

const publishedContentSourceOptions = [
  { label: "指定内容", value: "content" },
  { label: "内容池随机", value: "content_group" },
  { label: "未分组内容随机", value: "ungrouped" },
];

function buildTaskTemplateBody(payload: AnyRecord) {
  return pickPayload(payload, taskTemplatePayloadKeys);
}

function buildTaskDispatchBody(payload: AnyRecord) {
  return pickPayload(payload, [
    "template_id",
    "title_prefix",
    "slot_ids",
    "registration_target_mode",
    "concurrent_registration_count",
    "execution_count",
    "execution_mode",
    "params",
    "scheduled_at",
  ]);
}

function buildPublishedContentDispatchBody(payload: AnyRecord) {
  const body = pickPayload(payload, [
    "business_platform",
    "runtime_platform",
    "provider",
    "slot_ids",
    "content_source_type",
    "content_status",
    "content_id",
    "content_group_id",
    "comment_content",
    "comment_media_asset_ids",
    "dispatch_delay_min_minutes",
    "dispatch_delay_max_minutes",
    "scheduled_at",
  ]);
  const commentContent = typeof payload.comment_content === "string"
    ? payload.comment_content
    : "";
  body.comment_content = commentContent.trim() ? commentContent : null;
  body.comment_media_asset_ids = Array.isArray(payload.comment_media_asset_ids)
    ? payload.comment_media_asset_ids.map(String).filter(Boolean)
    : [];
  const delayMinMinutes = Number(payload.dispatch_delay_min_minutes ?? 1);
  const delayMaxMinutes = Number(payload.dispatch_delay_max_minutes ?? 2);
  if (delayMinMinutes > delayMaxMinutes) {
    throw new Error("最短延迟不能大于最长延迟");
  }
  body.dispatch_delay_min_minutes = delayMinMinutes;
  body.dispatch_delay_max_minutes = delayMaxMinutes;
  if (body.content_status === "all") {
    body.content_status = null;
  }
  if (body.content_source_type === "content") {
    body.content_group_id = null;
  } else if (body.content_source_type === "content_group") {
    body.content_id = null;
  } else if (body.content_source_type === "ungrouped") {
    body.content_id = null;
    body.content_group_id = null;
  }
  return body;
}

function formatPublishedContentDispatchSuccess(data: AnyRecord) {
  const total = Number(data.total || 0);
  const task = data.task && typeof data.task === "object" ? data.task as AnyRecord : {};
  const taskId = task.id ? `，父任务 ID：${task.id}` : "";
  return `已下发 ${total} 台设备的发布任务${taskId}`;
}

function formatAccountImportSuccess(data: AnyRecord) {
  const total = Number(data.total_count || 0);
  const created = Number(data.created_count || 0);
  const duplicate = Number(data.duplicate_count || 0);
  const existed = Number(data.existed_count || 0);
  const failed = Number(data.failed_count || 0);
  const tagged = Number(data.tagged_count || 0);
  const tagText = Array.isArray(data.tag_ids) && data.tag_ids.length ? `，添加标签 ${tagged} 个` : "";
  const queued = Number(data.onboarding_queued_count || 0);
  const onboardingText = data.onboarding_status === "queued"
    ? ` 已创建 ${queued} 条环境创建及上号任务，父任务 ID：${data.onboarding_task_id}。`
    : data.onboarding_message ? ` ${data.onboarding_message}。` : "";
  const skipped = Array.isArray(data.skipped) ? data.skipped as AnyRecord[] : [];
  const failureDetails = skipped
    .filter((item) => item.reason_type === "failed")
    .slice(0, 5)
    .map((item) => `第 ${item.line_number} 行：${item.reason}`);
  const hiddenFailureCount = Math.max(failed - failureDetails.length, 0);
  const failureText = failureDetails.length
    ? ` 失败原因：${failureDetails.join("；")}${hiddenFailureCount ? `；另有 ${hiddenFailureCount} 条` : ""}。`
    : "";
  return `共解析 ${total} 行，成功导入 ${created} 个${tagText}。文本重复 ${duplicate} 个，系统已存在 ${existed} 个，失败 ${failed} 个。${onboardingText}${failureText}`;
}

function accountImportNotificationType(data: AnyRecord): "success" | "warning" | "error" {
  const created = Number(data.created_count || 0);
  const failed = Number(data.failed_count || 0);
  const skipped = Number(data.skipped_count || 0);
  if (created === 0 && failed > 0) return "error";
  if (failed > 0 || skipped > 0) return "warning";
  return "success";
}

function buildAccountImportPayload(payload: AnyRecord) {
  const body = pickPayload(payload, [
    "business_platform",
    "country",
    "tag_ids",
    "raw_text",
    "delimiter",
    "custom_delimiter",
    "post_import_action",
    "provider",
    "target_runtime_instance_id",
    "environment_name_prefix",
    "proxy_allocation_mode",
    "proxy_group_id",
    "dynamic_proxy_id",
  ]);
  if (body.post_import_action !== "create_environment_and_login") {
    delete body.provider;
    delete body.target_runtime_instance_id;
    delete body.environment_name_prefix;
    delete body.proxy_allocation_mode;
    delete body.proxy_group_id;
    delete body.dynamic_proxy_id;
  } else {
    if (body.proxy_allocation_mode !== "static_group") delete body.proxy_group_id;
    if (body.proxy_allocation_mode !== "dynamic_template") delete body.dynamic_proxy_id;
  }
  return body;
}

const accountOnboardingFields: FieldConfig[] = [
  {
    key: "provider",
    label: "设备供应商",
    type: "select",
    options: providerOptions,
    required: true,
    placeholder: "请选择设备供应商",
  },
  {
    key: "target_runtime_instance_id",
    label: "目标 Runtime",
    type: "remoteSelect",
    remote: onlineFingerprintRuntimeRemoteSelect,
    required: true,
    placeholder: "选择负责创建环境的在线 Runtime",
  },
  {
    key: "environment_name_prefix",
    label: "环境名称前缀",
    required: true,
    span: 2,
    placeholder: "例如 韩国重试，将生成 韩国重试-001、002……",
  },
  {
    key: "proxy_allocation_mode",
    label: "上号代理方式",
    type: "segmented",
    options: [
      { label: "不使用代理", value: "none" },
      { label: "静态代理池", value: "static_group" },
      { label: "动态代理模板", value: "dynamic_template" },
    ],
    defaultValue: "none",
    span: 2,
    required: true,
  },
  {
    key: "proxy_group_id",
    label: "静态代理组",
    type: "remoteSelect",
    remote: proxyGroupRemoteSelect,
    visibleWhen: { key: "proxy_allocation_mode", value: "static_group" },
    requiredWhen: { key: "proxy_allocation_mode", value: "static_group" },
    span: 2,
  },
  {
    key: "dynamic_proxy_id",
    label: "动态代理模板",
    type: "remoteSelect",
    remote: dynamicProxyRemoteSelect,
    visibleWhen: { key: "proxy_allocation_mode", value: "dynamic_template" },
    requiredWhen: { key: "proxy_allocation_mode", value: "dynamic_template" },
    span: 2,
  },
];

function buildAccountOnboardingBody(payload: AnyRecord, records: AnyRecord[]) {
  return {
    account_ids: records.map((record) => String(record.id)),
    business_platform: String(records[0]?.business_platform || ""),
    provider: payload.provider,
    target_runtime_instance_id: payload.target_runtime_instance_id,
    environment_name_prefix: payload.environment_name_prefix,
    proxy_allocation_mode: payload.proxy_allocation_mode,
    proxy_group_id: payload.proxy_allocation_mode === "static_group" ? payload.proxy_group_id : undefined,
    dynamic_proxy_id: payload.proxy_allocation_mode === "dynamic_template" ? payload.dynamic_proxy_id : undefined,
  };
}

function canOnboardAccount(record: AnyRecord) {
  return record.login_status === "not_logged_in"
    && !String(record.bound_slot_id || "").trim()
    && !String(record.bound_slot_provider_id || "").trim();
}

function canRetryRuntimeSync(record: AnyRecord) {
  return ["failed", "expired"].includes(String(record.sync_status || record.tag_sync_status || ""))
    && Boolean(record.control_command_id || record.tag_control_command_id);
}

function formatContentImportSuccess(data: AnyRecord) {
  const total = Number(data.total_count || 0);
  const created = Number(data.created_count || 0);
  const duplicate = Number(data.duplicate_count || 0);
  const existed = Number(data.existed_count || 0);
  const failed = Number(data.failed_count || 0);
  const grouped = Number(data.grouped_count || 0);
  const groupText = data.group_id ? `，加入内容池 ${grouped} 条` : "";
  return `共解析 ${total} 条内容，成功导入 ${created} 条${groupText}；本次重复 ${duplicate} 条，系统已存在 ${existed} 条，失败 ${failed} 条。`;
}

async function loadAccountForEdit(record: AnyRecord) {
  const account = await http.get<AnyRecord>(`/api/accounts/${record.id}`);
  return {
    ...record,
    ...account,
    tag_ids: Array.isArray(account.tag_ids) ? account.tag_ids : [],
  };
}

async function updateAccountTags(_updatedAccount: AnyRecord, payload: AnyRecord, record: AnyRecord) {
  if (!Object.prototype.hasOwnProperty.call(payload, "tag_ids")) return undefined;
  return http.put(`/api/accounts/${record.id}/tags`, {
    tag_ids: Array.isArray(payload.tag_ids) ? payload.tag_ids : [],
  });
}

async function loadProxyForEdit(record: AnyRecord) {
  const proxy = await http.get<AnyRecord>(`/api/resource-center/proxies/${record.id}`);
  return { ...record, ...proxy, group_ids: Array.isArray(proxy.group_ids) ? proxy.group_ids : [] };
}

async function loadSlotForEdit(record: AnyRecord) {
  const slot = await http.get<AnyRecord>(`/api/execution-slots/${record.id}`);
  return { ...record, ...slot, slot_group_id: slot.group_id || "" };
}

async function updateSlotGroup(_updatedSlot: AnyRecord, payload: AnyRecord, record: AnyRecord) {
  if (!Object.prototype.hasOwnProperty.call(payload, "slot_group_id")) return undefined;
  const nextGroupId = String(payload.slot_group_id || "");
  const currentGroupId = String(record.group_id || "");
  if (nextGroupId === currentGroupId) return undefined;
  if (nextGroupId) {
    return http.post(`/api/slot-groups/${encodeURIComponent(nextGroupId)}/slots`, {
      slot_id: String(record.id),
    });
  }
  if (currentGroupId) {
    return http.delete(
      `/api/slot-groups/${encodeURIComponent(currentGroupId)}/slots/${encodeURIComponent(String(record.id))}`,
    );
  }
  return undefined;
}

async function loadContentForEdit(record: AnyRecord) {
  const content = await http.get<AnyRecord>(`/api/content-center/contents/${record.id}`);
  return {
    ...record,
    ...content,
    content_group_ids: Array.isArray(content.content_group_ids) ? content.content_group_ids : [],
  };
}

async function updateContentGroups(_updatedContent: AnyRecord, payload: AnyRecord, record: AnyRecord) {
  if (!Object.prototype.hasOwnProperty.call(payload, "content_group_ids")) return undefined;
  return http.put(`/api/content-center/contents/${record.id}/groups`, {
    content_group_ids: Array.isArray(payload.content_group_ids) ? payload.content_group_ids : [],
  });
}

function buildProxyUpdateBody(payload: AnyRecord) {
  return pickPayload(payload, [
    "name",
    "proxy_type",
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
    createNotificationType: (data) => accountImportNotificationType(data),
    keepCreateOpenWhen: (data) => Number(data.created_count || 0) === 0 && Number(data.failed_count || 0) > 0,
    createBody: (payload) => buildAccountImportPayload(payload),
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
    afterUpdate: updateAccountTags,
    columns: [
      { key: "id", label: "ID", type: "id", width: 68, align: "center" },
      { key: "login_username", label: "账号信息", type: "accountIdentity", minWidth: 180 },
      { key: "tag_names", label: "账号标签", type: "accountTags", minWidth: 170 },
      { key: "bound_slot_group_name", label: "设备分组", type: "accountDeviceGroup", minWidth: 130 },
      { key: "password_secret_ref", label: "登录凭证", type: "accountCredentials", minWidth: 235 },
      { key: "business_platform", label: "平台 / 国家", type: "accountPlatform", minWidth: 125 },
      { key: "login_status", label: "登录状态", type: "status", width: 170, align: "center" },
      {
        key: "bound_slot_provider_id",
        label: "设备环境",
        type: "accountEnvironment",
        minWidth: 205,
      },
      {
        key: "account_package_download_url",
        label: "备份地址",
        type: "accountBackup",
        minWidth: 240,
      },
      { key: "updated_at", label: "更新时间", type: "datetime", width: 155, align: "center" },
    ],
    filters: [
      {
        key: "account_id",
        label: "账号 ID",
        placeholder: "请输入账号 ID",
      },
      {
        key: "login_username",
        label: "登录账号",
        placeholder: "请输入登录账号",
      },
      {
        key: "slot_group_id",
        label: "设备分组",
        type: "remoteSelect",
        remote: slotGroupRemoteSelect,
        placeholder: "全部设备分组",
      },
      {
        key: "tag_id",
        label: "账号标签",
        type: "remoteSelect",
        remote: accountTagRemoteSelect,
        placeholder: "全部标签",
      },
      {
        key: "bound_slot_name",
        label: "设备名称",
        placeholder: "请输入设备名称",
      },
      {
        key: "provider_slot_id",
        label: "设备 ID",
        placeholder: "请输入设备 ID",
      },
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
        key: "runtime_platform",
        label: "所在执行平台",
        type: "select",
        options: runtimePlatformOptions,
      },
      {
        key: "provider",
        label: "设备供应商",
        type: "select",
        options: providerOptions,
      },
      {
        key: "keyword",
        label: "用户信息",
        placeholder: "公开用户名 / 昵称",
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
        key: "tag_ids",
        label: "账号标签",
        type: "remoteSelect",
        remote: accountTagMultiSelect,
        placeholder: "可选，导入后自动添加标签",
      },
      {
        key: "post_import_action",
        label: "导入后动作",
        type: "segmented",
        options: [
          { label: "仅导入账号", value: "import_only" },
          { label: "创建环境并上号", value: "create_environment_and_login" },
        ],
        defaultValue: "import_only",
        span: 2,
        required: true,
      },
      {
        key: "provider",
        label: "设备供应商",
        type: "select",
        options: providerOptions,
        visibleWhen: { key: "post_import_action", value: "create_environment_and_login" },
        requiredWhen: { key: "post_import_action", value: "create_environment_and_login" },
        placeholder: "请选择设备供应商",
      },
      {
        key: "target_runtime_instance_id",
        label: "目标 Runtime",
        type: "remoteSelect",
        remote: onlineFingerprintRuntimeRemoteSelect,
        visibleWhen: { key: "post_import_action", value: "create_environment_and_login" },
        requiredWhen: { key: "post_import_action", value: "create_environment_and_login" },
        placeholder: "选择负责创建环境的在线 Runtime",
      },
      {
        key: "environment_name_prefix",
        label: "环境名称前缀",
        visibleWhen: { key: "post_import_action", value: "create_environment_and_login" },
        requiredWhen: { key: "post_import_action", value: "create_environment_and_login" },
        span: 2,
        placeholder: "例如 韩国7-16-90，将生成 韩国7-16-90-001、002……",
      },
      {
        key: "proxy_allocation_mode",
        label: "上号代理方式",
        type: "segmented",
        options: [
          { label: "不使用代理", value: "none" },
          { label: "静态代理池", value: "static_group" },
          { label: "动态代理模板", value: "dynamic_template" },
        ],
        defaultValue: "none",
        visibleWhen: { key: "post_import_action", value: "create_environment_and_login" },
        span: 2,
        required: true,
      },
      {
        key: "proxy_group_id",
        label: "静态代理组",
        type: "remoteSelect",
        remote: proxyGroupRemoteSelect,
        visibleWhen: { key: "proxy_allocation_mode", value: "static_group" },
        visibleWhenAll: [
          { key: "post_import_action", value: "create_environment_and_login" },
        ],
        requiredWhen: { key: "proxy_allocation_mode", value: "static_group" },
        span: 2,
        placeholder: "一账号分配一个组内未使用的静态代理",
      },
      {
        key: "dynamic_proxy_id",
        label: "动态代理模板",
        type: "remoteSelect",
        remote: dynamicProxyRemoteSelect,
        visibleWhen: { key: "proxy_allocation_mode", value: "dynamic_template" },
        visibleWhenAll: [
          { key: "post_import_action", value: "create_environment_and_login" },
        ],
        requiredWhen: { key: "proxy_allocation_mode", value: "dynamic_template" },
        span: 2,
        placeholder: "每个账号会根据模板生成独立动态会话",
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
        key: "tag_ids",
        label: "账号标签",
        type: "remoteSelect",
        remote: accountTagMultiSelect,
        allowEmpty: true,
        placeholder: "请选择一个或多个账号标签",
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
      {
        key: "bound_slot_runtime_platform",
        label: "所在执行平台",
        type: "select",
        options: runtimePlatformOptions,
        readonly: true,
      },
      {
        key: "bound_slot_provider",
        label: "设备供应商",
        type: "select",
        options: providerOptions,
        readonly: true,
      },
      { key: "display_name", label: "显示名称" },
    ],
    rowActions: [
      {
        key: "account-onboarding",
        label: "上号",
        visible: canOnboardAccount,
        method: "POST",
        icon: "play",
        path: () => "/api/accounts/onboarding",
        body: (payload, record) => buildAccountOnboardingBody(payload, [record]),
        successTitle: "上号任务已创建",
        successMessage: (data) => `已创建上号任务，父任务 ID：${data.onboarding_task_id}`,
        fields: accountOnboardingFields,
      },
    ],
    inlineActionKeys: ["account-onboarding"],
    batchActions: [
      {
        key: "batch-account-onboarding",
        label: "重新上号",
        method: "POST",
        icon: "rotate",
        batchPath: () => "/api/accounts/onboarding",
        batchBody: (payload, records) => buildAccountOnboardingBody(payload, records),
        successTitle: "重新上号任务已创建",
        successMessage: (data) =>
          `已为 ${Number(data.onboarding_queued_count || 0)} 个账号创建上号任务，父任务 ID：${data.onboarding_task_id}`,
        fields: accountOnboardingFields,
      },
      {
        key: "batch-set-tags",
        label: "设置标签",
        method: "PUT",
        icon: "users",
        path: (record) => `/api/accounts/${record.id}/tags`,
        body: (payload) => ({
          tag_ids: Array.isArray(payload.tag_ids) ? payload.tag_ids : [],
        }),
        fields: [
          {
            key: "tag_ids",
            label: "账号标签",
            type: "remoteSelect",
            remote: {
              ...accountTagMultiSelect,
              create: {
                endpoint: "/api/account-tags",
                body: (name: string) => ({ name }),
                successTitle: "账号标签已创建",
              },
            },
            allowEmpty: true,
            placeholder: "选择已有标签，或输入名称后按回车新建",
          },
        ],
      },
    ],
    deleteLabel: "删除",
    directDelete: true,
    deleteConfirm:
      "确认删除该账号？该账号的发布内容、评论、指标快照、监听记录会一并删除，同时释放设备、标签和任务引用，此操作不可恢复，请谨慎操作。",
  },

  accountTags: {
    key: "accountTags",
    title: "账号标签",
    endpoint: "/api/account-tags",
    createLabel: "新增标签",
    accountTagMembers: true,
    columns: [
      { key: "id", label: "ID", type: "id" },
      { key: "name", label: "名称" },
      { key: "member_count", label: "关联账号数" },
      { key: "updated_at", label: "更新时间", type: "datetime" },
    ],
    filters: [{ key: "keyword", label: "关键词", placeholder: "名称 / 说明" }],
    createFields: [
      { key: "name", label: "名称", required: true },
      { key: "description", label: "说明", type: "textarea", span: 2 },
    ],
    updateFields: [
      { key: "name", label: "名称" },
      { key: "description", label: "说明", type: "textarea", span: 2 },
    ],
    deleteLabel: "删除",
    directDelete: true,
    deleteConfirm:
      "确认删除该账号标签？删除后会自动解除与账号的关联，标签本身不可恢复，请谨慎操作。",
  },

  slots: {
    key: "slots",
    title: "设备管理",
    endpoint: "/api/execution-slots",
    deleteLabel: "删除",
    directDelete: true,
    deleteConfirm:
      "确认删除该设备？存在在线 Runtime 时会先删除供应商环境；关联 Runtime 均离线时会直接清理系统设备记录。绑定账号会保留并自动解绑，运行中的设备不能删除。",
    createLabel: "新增设备",
    loadEditRecord: loadSlotForEdit,
    updateBody: (payload) =>
      pickPayload(payload, ["provider_slot_no", "display_name"]),
    afterUpdate: updateSlotGroup,
    headerActions: [
      {
        key: "request-runtime-slot-sync",
        label: "主动同步",
        submitLabel: "执行",
        method: "POST",
        icon: "rotate",
        path: () => "/api/runtimes/request-slot-sync",
        refresh: false,
        successTitle: "主动同步请求已发送",
        successMessage: (data) => {
          const notified = Number(data.notified_count || 0);
          const unavailable = Number(data.unavailable_count || 0);
          const failed = Number(data.failed_count || 0);
          return unavailable || failed
            ? `已通知 ${notified} 个 Runtime，${unavailable + failed} 个未通知`
            : `已通知 ${notified} 个 Runtime 上传完整设备快照`;
        },
        fields: [
          {
            key: "runtime_instance_ids",
            label: "Runtime",
            type: "remoteSelect",
            remote: runtimeSlotSyncRemoteSelect,
            required: true,
            span: 2,
            defaultValue: [],
            placeholder: "搜索并选择在线指纹浏览器 Runtime",
          },
        ],
      },
    ],
    columns: [
      { key: "provider_slot_id", label: "设备信息", type: "deviceIdentity", minWidth: 220 },
      { key: "group_name", label: "所属分组", type: "deviceGroup", minWidth: 125 },
      { key: "runtime_platform", label: "运行环境", type: "devicePlatform", minWidth: 155 },
      { key: "status", label: "状态", type: "deviceState", width: 150, align: "center" },
      { key: "bound_account_id", label: "账号信息", type: "deviceAccount", minWidth: 210 },
      { key: "proxy_id", label: "代理资源", type: "deviceProxy", minWidth: 180 },
      { key: "last_seen_at", label: "最近活动", type: "deviceActivity", width: 190, align: "center" },
    ],
    filters: [
      {
        key: "provider_slot_id",
        label: "设备 ID",
        placeholder: "请输入 Provider ID",
      },
      {
        key: "display_name",
        label: "设备名称",
        placeholder: "请输入设备名称",
      },
      {
        key: "group_id",
        label: "所属分组",
        type: "remoteSelect",
        remote: slotGroupRemoteSelect,
        placeholder: "全部分组",
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
        key: "status",
        label: "状态",
        type: "select",
        options: slotStatusOptions,
      },
      {
        key: "account_login_status",
        label: "账号登录状态",
        type: "select",
        options: loginStatusOptions,
      },
      {
        key: "business_platform",
        label: "业务 App",
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
        key: "bound_account_id",
        label: "绑定账号",
        type: "remoteSelect",
        remote: accountRemoteSelect,
        placeholder: "全部账号",
      },
      {
        key: "proxy_id",
        label: "代理资源",
        type: "remoteSelect",
        remote: proxyRemoteSelect,
        placeholder: "全部代理",
      },
      {
        key: "keyword",
        label: "综合搜索",
        placeholder: "编号 / 账号 / 分组",
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
      { key: "provider_slot_id", label: "设备 ID", required: true, placeholder: "请输入供应商侧 Provider ID" },
      { key: "provider_slot_no", label: "Provider 编号" },
      { key: "display_name", label: "显示名称" },
    ],
    updateFields: [
      { key: "provider_slot_id", label: "设备 ID（Provider ID）", readonly: true },
      { key: "display_name", label: "设备名称", placeholder: "请输入运营识别名称" },
      { key: "provider_slot_no", label: "Provider 编号" },
      {
        key: "slot_group_id",
        label: "所属分组",
        type: "remoteSelect",
        remote: slotGroupForSlotEditRemoteSelect,
        allowEmpty: true,
        placeholder: "未分组",
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
        label: "设备供应商",
        type: "select",
        options: providerOptions,
        readonly: true,
      },
      {
        key: "slot_type",
        label: "设备类型",
        type: "select",
        options: slotTypeOptions,
        readonly: true,
      },
      {
        key: "status",
        label: "运行状态",
        type: "select",
        options: slotStatusOptions,
        readonly: true,
      },
      {
        key: "login_status",
        label: "账号登录状态",
        type: "select",
        options: loginStatusOptions,
        readonly: true,
      },
      {
        key: "bound_account_id",
        label: "当前账号",
        type: "remoteSelect",
        remote: accountRemoteSelect,
        readonly: true,
        placeholder: "未绑定账号",
      },
      {
        key: "proxy_id",
        label: "当前代理",
        type: "remoteSelect",
        remote: proxyReadonlyRemoteSelect,
        readonly: true,
        placeholder: "未配置代理",
      },
      { key: "current_task_run_id", label: "当前任务 ID", readonly: true },
      { key: "last_seen_at", label: "最近心跳", type: "datetime", readonly: true },
      { key: "last_login_check_at", label: "最近登录检测", type: "datetime", readonly: true },
      { key: "created_at", label: "创建时间", type: "datetime", readonly: true },
      { key: "updated_at", label: "更新时间", type: "datetime", readonly: true },
    ],
    rowActions: [
      {
        key: "retry-sync",
        label: "重试同步",
        visible: canRetryRuntimeSync,
        method: "POST",
        icon: "rotate",
        path: (record) =>
          `/api/runtime-controls/${encodeURIComponent(String(record.control_command_id))}/retry`,
        successTitle: "设备同步已重新排队",
      },
    ],
    batchActions: [
      {
        key: "batch-set-group",
        label: "批量分组",
        method: "POST",
        icon: "users",
        fields: [
          {
            key: "group_id",
            label: "设备组",
            type: "remoteSelect",
            remote: slotGroupForSlotEditRemoteSelect,
            required: true,
            placeholder: "请选择目标设备组",
          },
        ],
        batchPath: (_records, payload) =>
          `/api/slot-groups/${encodeURIComponent(String(payload?.group_id))}/slots/batch`,
        batchBody: (_payload, records) => ({
          slot_ids: records.map((record) => String(record.id)),
        }),
        successTitle: "设备分组完成",
        successMessage: (data) =>
          `已分组 ${Number(data.added_count || 0)} 台设备，跳过 ${Number(data.skipped_count || 0)} 台已在组内设备`,
      },
      {
        key: "__delete",
        label: "批量删除",
        method: "POST",
        icon: "trash",
        variant: "danger",
        batchPath: () => "/api/execution-slots/batch-delete",
        batchBody: (_payload, records) => ({
          slot_ids: records.map((record) => String(record.id)),
        }),
        successMessage: (data) => {
          const deleted = Number(data.deleted_count || 0);
          const queued = Number(data.command_queued_count || 0);
          const skipped = Number(data.skipped_running_count || 0);
          const notFound = Number(data.not_found_count || 0);
          const parts = [`已删除 ${deleted} 台离线设备`];
          if (queued) parts.push(`已提交 ${queued} 台在线设备删除命令`);
          if (skipped) parts.push(`跳过 ${skipped} 台运行中设备`);
          if (notFound) parts.push(`${notFound} 台设备已不存在`);
          return parts.join("，");
        },
      },
    ],
    inlineActionKeys: ["retry-sync"],
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
      { key: "runtime_platform", label: "执行平台", options: runtimePlatformOptions },
      { key: "provider", label: "供应商" },
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
      { key: "name", label: "代理信息", type: "proxyIdentity", minWidth: 145 },
      { key: "group_names", label: "所属分组", type: "proxyGroup", minWidth: 90 },
      { key: "source_proxy_url", label: "代理元数据", type: "proxyEndpoint", minWidth: 282 },
      { key: "proxy_type", label: "代理属性", type: "proxyProfile", width: 136, align: "center" },
      { key: "status", label: "使用状态", type: "status", width: 85, align: "center" },
    ],
    filters: [
      {
        key: "proxy_type",
        label: "代理协议",
        type: "select",
        options: proxyProtocolOptions,
      },
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
        key: "group_id",
        label: "所属分组",
        type: "remoteSelect",
        remote: proxyGroupRemoteSelect,
        placeholder: "全部代理组",
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
        key: "group_ids",
        label: "导入到代理组",
        type: "remoteSelect",
        remote: proxyGroupMultiSelect,
        allowEmpty: true,
        span: 2,
        placeholder: "可选择一个或多个代理组",
      },
      {
        key: "proxy_urls",
        label: "代理地址",
        type: "textarea",
        required: true,
        span: 2,
        placeholder:
          "socks5://user:pass@127.0.0.1:1080\nhttp://user:pass@127.0.0.2:8080\nhttps://user:pass@127.0.0.3:8080",
      },
      { key: "remark", label: "备注", span: 2 },
    ],
    updateFields: [
      { key: "name", label: "代理名称" },
      {
        key: "proxy_type",
        label: "代理协议",
        type: "select",
        options: proxyProtocolOptions,
      },
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
    rowActions: [
      {
        key: "check",
        label: "检测",
        method: "POST",
        path: (record) => `/api/resource-center/proxies/${record.id}/check`,
        icon: "rotate",
        refresh: false,
        showResult: true,
      },
    ],
    inlineActionKeys: ["check"],
    batchActions: [
      {
        key: "batch-check",
        label: "批量检测",
        method: "POST",
        icon: "rotate",
        batchPath: () => "/api/resource-center/proxies/check/batch",
        batchBody: (_payload, records) => ({ proxy_ids: records.map((record) => String(record.id)) }),
        refresh: false,
        showResult: true,
        resultColumns: [
          { key: "proxy.name", label: "代理名称", minWidth: 150 },
          { key: "proxy.source_proxy_url", label: "代理链接", minWidth: 260 },
          { key: "status", label: "检测状态", type: "status", width: 110, align: "center" },
          { key: "latency_ms", label: "延迟", width: 90, align: "center" },
          { key: "exit_ip", label: "出口 IP", minWidth: 130, align: "center" },
          { key: "country", label: "国家/地区", minWidth: 110, align: "center" },
          { key: "city", label: "城市", minWidth: 110, align: "center" },
          { key: "isp", label: "ISP", minWidth: 150 },
          { key: "error_message", label: "错误信息", minWidth: 180 },
        ],
      },
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

  contentGroups: {
    key: "contentGroups",
    title: "内容池",
    endpoint: "/api/content-center/content-groups",
    createLabel: "新增内容池",
    contentGroupMembers: true,
    columns: [
      { key: "id", label: "ID", type: "id", align: "center" },
      { key: "name", label: "名称", minWidth: 220 },
      { key: "business_platform", label: "业务 App", align: "center" },
      { key: "member_count", label: "内容数量", align: "center" },
      { key: "unused_count", label: "未使用", align: "center" },
      { key: "updated_at", label: "更新时间", type: "datetime", minWidth: 170, align: "center" },
    ],
    filters: [
      {
        key: "business_platform",
        label: "业务 App",
        type: "select",
        options: businessPlatformOptions,
      },
      { key: "keyword", label: "关键词", placeholder: "名称 / 备注" },
    ],
    createFields: [
      {
        key: "business_platform",
        label: "业务 App",
        type: "select",
        options: businessPlatformOptions,
        defaultValue: "threads",
        required: true,
      },
      { key: "name", label: "名称", required: true },
      { key: "description", label: "备注", type: "textarea", span: 2 },
    ],
    updateFields: [
      {
        key: "business_platform",
        label: "业务 App",
        type: "select",
        options: businessPlatformOptions,
      },
      { key: "name", label: "名称" },
      { key: "description", label: "备注", type: "textarea", span: 2 },
    ],
    deleteLabel: "删除",
    deletePath: (record) => `/api/content-center/content-groups/${record.id}?force=true`,
    directDelete: true,
    deleteConfirm:
      "确认删除该内容池？删除后组内内容只会解除关系，内容本身不会被删除。",
  },

  contents: {
    key: "contents",
    title: "内容库",
    endpoint: "/api/content-center/contents",
    createLabel: "新增内容",
    loadEditRecord: loadContentForEdit,
    updateBody: (payload) =>
      pickPayload(payload, [
        "business_platform",
        "title",
        "content_type",
        "text_body",
        "material_asset_ids",
        "tags",
        "status",
      ]),
    afterUpdate: updateContentGroups,
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
            defaultValue: "unused",
          },
          {
            key: "content_group_id",
            label: "内容池",
            type: "remoteSelect",
            remote: contentGroupRemoteSelect,
            placeholder: "可选，导入后自动加入内容池",
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
        ],
      },
    ],
    columns: [
      { key: "id", label: "ID", type: "id", align: "center" },
      { key: "title", label: "内容标题", minWidth: 240 },
      { key: "content_group_names", label: "所属内容池", type: "list", minWidth: 180 },
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
      { key: "keyword", label: "关键词", placeholder: "标题 / 正文 / 标签" },
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
        defaultValue: "unused",
      },
      {
        key: "content_group_id",
        label: "内容池",
        type: "remoteSelect",
        remote: contentGroupRemoteSelect,
        placeholder: "可选，创建后自动加入内容池",
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
        key: "content_group_ids",
        label: "所属内容池",
        type: "remoteSelect",
        remote: contentGroupMultiSelect,
        span: 2,
        allowEmpty: true,
        placeholder: "可选择一个或多个内容池",
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
    ],
    batchActions: [
      {
        key: "batch-add-to-content-group",
        label: "加入内容池",
        method: "POST",
        icon: "users",
        fields: [
          {
            key: "group_id",
            label: "内容池",
            type: "remoteSelect",
            remote: contentGroupRemoteSelect,
            required: true,
            placeholder: "请选择内容池",
          },
        ],
        batchPath: (_records, payload) => `/api/content-center/content-groups/${payload?.group_id}/contents`,
        batchBody: (_payload, records) => ({ content_ids: records.map((record) => String(record.id)) }),
        successMessage: (data) =>
          `已加入 ${Number(data.added_count || 0)} 条内容，跳过 ${Number(data.skipped_count || 0)} 条已在池内的内容`,
      },
    ],
    deleteLabel: "删除",
    directDelete: true,
    deleteConfirm:
      "确认删除该内容？删除后任务模板和已创建任务里只会保留历史参数快照，请谨慎操作。",
  },

  mediaAssets: {
    key: "mediaAssets",
    title: "素材库",
    endpoint: "/api/resource-center/media-assets",
    createEndpoint: "/api/resource-center/media-assets/upload",
    createLabel: "上传素材",
    mediaAssetBatchUpload: true,
    columns: [
      { key: "id", label: "ID", type: "id", align: "center" },
      { key: "name", label: "素材名称", minWidth: 220 },
      { key: "group_names", label: "所属素材组", type: "list", minWidth: 180, align: "center" },
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
    batchActions: [
      {
        key: "batch-add-group",
        label: "批量加入素材组",
        method: "POST",
        icon: "users",
        fields: [
          {
            key: "group_id",
            label: "素材组",
            type: "remoteSelect",
            remote: mediaAssetGroupRemoteSelect,
            required: true,
          },
        ],
        batchPath: (_records, payload) => `/api/resource-center/media-asset-groups/${payload?.group_id}/assets`,
        batchBody: (_payload, records) => ({ asset_ids: records.map((record) => String(record.id)) }),
        successMessage: (data) =>
          `已加入 ${Number(data.added_count || 0)} 个素材，跳过 ${Number(data.skipped_count || 0)} 个已在组内的素材`,
      },
    ],
    deleteLabel: "删除",
    directDelete: true,
    deleteConfirm: "确认删除该素材？仍被内容引用的素材后端会阻止删除。",
  },

  mediaAssetGroups: {
    key: "mediaAssetGroups",
    title: "素材分组",
    endpoint: "/api/resource-center/media-asset-groups",
    createLabel: "新增素材组",
    mediaAssetGroupMembers: true,
    columns: [
      { key: "id", label: "ID", type: "id", align: "center" },
      { key: "name", label: "名称", minWidth: 220 },
      { key: "business_platform", label: "业务 App", align: "center" },
      { key: "member_count", label: "素材数量", align: "center" },
      { key: "updated_at", label: "更新时间", type: "datetime", minWidth: 170, align: "center" },
    ],
    filters: [
      {
        key: "business_platform",
        label: "业务 App",
        type: "select",
        options: businessPlatformOptions,
      },
      { key: "keyword", label: "关键词", placeholder: "名称 / 描述" },
    ],
    createFields: [
      {
        key: "business_platform",
        label: "业务 App",
        type: "select",
        options: businessPlatformOptions,
        defaultValue: "threads",
        required: true,
      },
      { key: "name", label: "名称", required: true },
      { key: "description", label: "描述", type: "textarea", span: 2 },
    ],
    updateFields: [
      {
        key: "business_platform",
        label: "业务 App",
        type: "select",
        options: businessPlatformOptions,
      },
      { key: "name", label: "名称" },
      { key: "description", label: "描述", type: "textarea", span: 2 },
    ],
    deleteLabel: "删除",
    deletePath: (record) => `/api/resource-center/media-asset-groups/${record.id}?force=true`,
    directDelete: true,
    deleteConfirm: "确认删除该素材组？删除后组内素材会自动解绑，素材文件本身不会被删除。",
  },

  interactionSessions: {
    key: "interactionSessions",
    title: "互动会话",
    endpoint: "/api/interaction-center/sessions",
    createLabel: "新建互动会话",
    createBody: (payload) => buildInteractionSessionBody(payload),
    columns: [
      { key: "id", label: "ID", type: "id", width: 80, align: "center" },
      { key: "title", label: "会话名称", minWidth: 220 },
      { key: "interaction_mode", label: "互动场景", type: "status", options: [{ label: "链接内容互动", value: "conversation" }, { label: "广场内容互动", value: "square_numeric" }], minWidth: 130, align: "center" },
      { key: "target_content_title", label: "目标内容", minWidth: 220 },
      {
        key: "content_mode",
        label: "文案来源",
        type: "status",
        options: [
          { label: "AI 生成", value: "ai" },
          { label: "自定义内容", value: "custom" },
        ],
        width: 120,
        align: "center",
      },
      { key: "main_account_name", label: "主号 / 目标作者", minWidth: 180, align: "center" },
      { key: "comment_account_count", label: "评论账号", width: 100, align: "center" },
      { key: "progress_text", label: "进度", width: 100, align: "center" },
      { key: "status", label: "状态", type: "status", options: interactionSessionStatusOptions, width: 120, align: "center" },
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
        key: "status",
        label: "状态",
        type: "select",
        options: interactionSessionStatusOptions,
      },
      {
        key: "main_account_id",
        label: "主号",
        type: "remoteSelect",
        remote: accountRemoteSelect,
      },
      { key: "keyword", label: "关键词", placeholder: "会话名称 / 目标帖子 / ID" },
    ],
    createFields: [
      { key: "title", label: "会话名称", required: true },
      {
        key: "interaction_mode",
        label: "互动场景",
        type: "segmented",
        defaultValue: "conversation",
        required: true,
        span: 2,
        options: [
          { label: "链接内容互动", value: "conversation" },
          { label: "广场内容互动", value: "square_numeric" },
        ],
      },
      {
        key: "business_platform",
        label: "业务 App",
        type: "select",
        options: businessPlatformOptions,
        defaultValue: "threads",
        required: true,
      },
      {
        key: "main_account_id",
        label: "主号设备",
        type: "accountTree",
        multiple: false,
        accountTreeGroupByDevice: true,

        visibleWhen: { key: "interaction_mode", value: "conversation" },
        requiredWhen: { key: "interaction_mode", value: "conversation" },
        span: 2,
      },
      {
        key: "square_target_account_ids",
        label: "目标监听账号",
        type: "accountTree",
        multiple: true,
        accountTreeGroupByDevice: true,
        accountTreeMonitoringOnly: true,

        visibleWhen: { key: "interaction_mode", value: "square_numeric" },
        requiredWhen: { key: "interaction_mode", value: "square_numeric" },
        span: 2,
        placeholder: "仅展示正常监听中的 Threads 账号",
      },
      {
        key: "comment_account_ids",
        label: "评论设备",
        type: "accountTree",
        multiple: true,
        accountTreeGroupByDevice: true,

        required: true,
        span: 2,
      },
      {
        key: "step_count",
        label: "互动轮次",
        type: "number",
        defaultValue: 1,
        min: 1,
        max: 20,
        step: 1,
        required: true,
        visibleWhen: { key: "interaction_mode", value: "conversation" },
        placeholder: "默认 1 轮，增加轮次后按主号和评论号交替回复",
      },
      {
        key: "step_delay_min_minutes",
        endKey: "step_delay_max_minutes",
        label: "延迟下发时间（分钟）",
        type: "numberRange",
        defaultValue: 1,
        endDefaultValue: 2,
        min: 0,
        max: 1440,
        step: 1,
        required: true,
        startPlaceholder: "最小延迟",
        endPlaceholder: "最大延迟",
      },
      {
        key: "follow_probability",
        label: "随机关注概率（%）",
        type: "number",
        defaultValue: 0,
        min: 0,
        max: 100,
        step: 5,
        required: true,
        visibleWhen: { key: "interaction_mode", value: "square_numeric" },
        placeholder: "0 表示不关注，100 表示每次命中目标作者都关注",
      },
      {
        key: "like_probability",
        label: "随机点赞概率（%）",
        type: "number",
        defaultValue: 0,
        min: 0,
        max: 100,
        step: 5,
        required: true,
        placeholder: "0 表示不点赞，100 表示每次都点赞",
      },
      {
        key: "browse_duration_minutes",
        label: "浏览时间（分钟）",
        type: "number",
        defaultValue: 10,
        min: 1,
        max: 1440,
        step: 1,
        required: true,
        visibleWhen: { key: "interaction_mode", value: "square_numeric" },
        placeholder: "脚本在广场持续浏览和匹配目标帖子的时间",
      },
      {
        key: "runtime_platform",
        label: "执行平台",
        type: "select",
        options: runtimePlatformOptions,
        defaultValue: "fingerprint_browser",
        required: true,
      },
      {
        key: "provider",
        label: "供应商",
        type: "select",
        options: providerOptions,
        defaultValue: "morelogin",
        required: true,
      },
      {
        key: "target_source_type",
        label: "目标选择方式",
        type: "segmented",
        defaultValue: "system_content",
        required: true,
        visibleWhen: { key: "interaction_mode", value: "conversation" },
        span: 2,
        options: [
          { label: "系统已发布内容", value: "system_content" },
          { label: "直接填写帖子链接", value: "direct_url" },
        ],
      },
      {
        key: "target_content_id",
        label: "目标内容",
        type: "remoteSelect",
        remote: interactionTargetContentRemoteSelect,
        visibleWhenAll: [
          { key: "interaction_mode", value: "conversation" },
          { key: "target_source_type", value: "system_content" },
        ],
        requiredWhen: { key: "target_source_type", value: "system_content" },
        span: 2,
        placeholder: "从主号已发布内容中选择目标帖子",
      },
      {
        key: "target_content_url",
        label: "目标帖子链接",
        visibleWhenAll: [
          { key: "interaction_mode", value: "conversation" },
          { key: "target_source_type", value: "direct_url" },
        ],
        requiredWhen: { key: "target_source_type", value: "direct_url" },
        span: 2,
        placeholder: "例如：https://www.threads.com/@用户名/post/帖子ID",
      },
      {
        key: "content_mode",
        label: "文案来源",
        type: "segmented",
        defaultValue: "ai",
        required: true,
        visibleWhen: { key: "interaction_mode", value: "conversation" },
        span: 2,
        options: [
          { label: "AI 生成", value: "ai" },
          { label: "自定义内容", value: "custom" },
        ],
      },
      {
        key: "custom_contents_text",
        label: "自定义评论内容",
        type: "textarea",
        visibleWhenAll: [
          { key: "interaction_mode", value: "conversation" },
          { key: "content_mode", value: "custom" },
        ],
        requiredWhen: { key: "content_mode", value: "custom" },
        span: 2,
        placeholder: "每段一条文案，文案之间空一行。系统按评论账号和互动轮次依次分配，数量不足时循环使用。",
      },
      {
        key: "ai_provider",
        label: "AI 供应商",
        type: "select",
        defaultValue: "",
        visibleWhenAll: [
          { key: "interaction_mode", value: "conversation" },
          { key: "content_mode", value: "ai" },
        ],
        requiredWhen: { key: "content_mode", value: "ai" },
        options: [],
        placeholder: "仅展示系统配置中已启用的 AI",
      },
      {
        key: "ai_language",
        label: "生成语言",
        type: "select",
        defaultValue: "auto",
        visibleWhenAll: [
          { key: "interaction_mode", value: "conversation" },
          { key: "content_mode", value: "ai" },
        ],
        options: [
          { label: "跟随帖子与对话", value: "auto" },
          { label: "英文", value: "en" },
          { label: "韩文", value: "ko" },
        ],
      },
      {
        key: "ai_tone",
        label: "文案语气",
        type: "select",
        defaultValue: "natural",
        visibleWhenAll: [
          { key: "interaction_mode", value: "conversation" },
          { key: "content_mode", value: "ai" },
        ],
        options: [
          { label: "自然交流", value: "natural" },
          { label: "友好亲切", value: "friendly" },
          { label: "好奇提问", value: "curious" },
          { label: "支持认同", value: "supportive" },
          { label: "观点讨论", value: "discussion" },
          { label: "韩国财经互动（固定韩文）", value: "korean_finance" },
        ],
      },
      {
        key: "ai_max_length",
        label: "单条最大长度",
        type: "number",
        defaultValue: 120,
        visibleWhenAll: [
          { key: "interaction_mode", value: "conversation" },
          { key: "content_mode", value: "ai" },
        ],
        min: 20,
        max: 500,
        step: 10,
        required: true,
      },
    ],
    inlineActionKeys: ["detail", "cancel", "retry"],
    rowActions: [
      {
        key: "detail",
        label: "查看详情",
        method: "GET",
        icon: "list",
        path: (record) => `/api/interaction-center/sessions/${record.id}`,
        refresh: false,
      },
      {
        key: "cancel",
        label: "取消会话",
        method: "POST",
        icon: "powerOff",
        variant: "danger",
        path: (record) => `/api/interaction-center/sessions/${record.id}/cancel`,
        visible: (record) => ["queued", "running"].includes(String(record.status || "")),
        confirm: "确认取消该互动会话？尚未开始的操作会被取消，已经下发或正在运行的操作会继续完成，但不会再执行后续轮次。",
        successTitle: "互动会话已取消",
        successMessage: (data) => {
          const canceled = Number(data.canceled_steps || 0);
          const active = Number(data.active_steps || 0);
          return active
            ? `已停止 ${canceled} 个未开始操作，${active} 个运行中操作完成后将停止。`
            : `已停止 ${canceled} 个未开始操作。`;
        },
      },
      {
        key: "retry",
        label: "重试失败操作",
        method: "POST",
        icon: "rotate",
        path: (record) => `/api/interaction-center/sessions/${record.id}/retry`,
        visible: (record) => (
          ["all_failed", "failed"].includes(String(record.status || ""))
          || (String(record.status || "") === "completed" && Number(record.step_failed || 0) > 0)
        ),
        confirm: "确认重试该会话中失败、超时或断连的操作吗？已成功的操作不会重复执行。",
        successTitle: "失败操作已重新提交",
        successMessage: (data) => `已重新提交 ${Number(data.retry_total || 0)} 个失败操作，系统将继续执行原互动会话。`,
      },
    ],
    readOnly: false,
  },

  publishedContents: {
    key: "publishedContents",
    title: "发布内容",
    endpoint: "/api/interaction-center/published-contents",
    createEndpoint: "/api/interaction-center/published-contents/dispatch",
    createLabel: "下发发布任务",
    createBody: (payload) => buildPublishedContentDispatchBody(payload),
    createSuccessTitle: "发布任务已下发",
    createSuccessMessage: (data) => formatPublishedContentDispatchSuccess(data),
    columns: [
      { key: "id", label: "ID", type: "id", width: 80, align: "center" },
      { key: "title", label: "标题", minWidth: 220 },
      { key: "author_account_name", label: "发布账号", minWidth: 160, align: "center" },
      { key: "business_platform", label: "业务 App", align: "center" },
      { key: "content_type", label: "内容类型", options: publishedContentTypeOptions, align: "center" },
      { key: "platform_content_id", label: "平台内容 ID", minWidth: 160, align: "center" },
      { key: "comment_count", label: "评论", width: 90, align: "center" },
      { key: "like_count", label: "点赞", width: 90, align: "center" },
      { key: "share_count", label: "分享", width: 90, align: "center" },
      { key: "view_count", label: "浏览", width: 90, align: "center" },
      { key: "status", label: "状态", type: "status", options: publishedContentStatusOptions, align: "center" },
      { key: "last_collected_at", label: "最近采集", type: "datetime", minWidth: 170, align: "center" },
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
        options: publishedContentTypeOptions,
      },
      {
        key: "status",
        label: "状态",
        type: "select",
        options: publishedContentStatusOptions,
      },
      {
        key: "author_account_id",
        label: "发布账号",
        type: "remoteSelect",
        remote: accountRemoteSelect,
      },
      { key: "keyword", label: "关键字", placeholder: "标题 / 正文 / 链接 / 平台内容 ID" },
    ],
    createFields: [
      {
        key: "business_platform",
        label: "业务 App",
        type: "select",
        options: businessPlatformOptions,
        defaultValue: "threads",
        required: true,
      },
      {
        key: "runtime_platform",
        label: "执行平台",
        type: "select",
        options: runtimePlatformOptions,
        defaultValue: "fingerprint_browser",
        required: true,
      },
      {
        key: "provider",
        label: "供应商",
        type: "select",
        options: providerOptions,
        defaultValue: "adspower",
        required: true,
      },
      {
        key: "slot_ids",
        label: "发布设备",
        type: "slotTree",
        required: true,
        slotTreeAccountPresence: "bound",
        slotTreeProviderFilter: true,
        slotTreeFillHeight: true,
        span: 2,
      },
      {
        key: "content_source_type",
        label: "内容来源",
        type: "select",
        options: publishedContentSourceOptions,
        defaultValue: "content_group",
        required: true,
      },
      {
        key: "content_status",
        label: "内容使用状态",
        type: "select",
        options: contentStatusFilterOptions,
        defaultValue: "unused",
        allowEmpty: true,
      },
      {
        key: "content_group_id",
        label: "内容池",
        type: "remoteSelect",
        remote: contentGroupRemoteSelect,
        disabledWhen: { key: "content_source_type", value: ["content", "ungrouped"] },
        requiredWhen: { key: "content_source_type", value: "content_group" },
        allowEmpty: true,
        placeholder: "按账号数量从内容池中随机取用",
      },
      {
        key: "content_id",
        label: "指定内容",
        type: "contentPreviewPicker",
        remote: contentRemoteSelect,
        disabledWhen: { key: "content_source_type", value: ["content_group", "ungrouped"] },
        requiredWhen: { key: "content_source_type", value: "content" },
        allowEmpty: true,
        span: 2,
        placeholder: "按使用状态筛选并选择内容",
      },
      {
        key: "comment_content",
        label: "评论内容",
        type: "textarea",
        span: 2,
        allowEmpty: true,
        placeholder: "可选；填写后随发布任务下发给脚本",
      },
      {
        key: "comment_media_asset_ids",
        label: "评论图片",
        type: "imagePreviewPicker",
        remote: commentImageMultiSelect,
        span: 2,
        allowEmpty: true,
        placeholder: "可选；支持从素材库选择多张图片",
      },
      {
        key: "dispatch_delay_min_minutes",
        endKey: "dispatch_delay_max_minutes",
        label: "延迟下发时间（分钟）",
        type: "numberRange",
        defaultValue: 1,
        endDefaultValue: 2,
        min: 0,
        max: 1440,
        step: 1,
        required: true,
        startPlaceholder: "最小延迟",
        endPlaceholder: "最大延迟",
      },
      { key: "scheduled_at", label: "计划时间", type: "datetime", allowEmpty: true, placeholder: "不填则立即下发" },
    ],
    updateFields: [
      {
        key: "content_type",
        label: "内容类型",
        type: "select",
        options: publishedContentTypeOptions,
      },
      {
        key: "status",
        label: "状态",
        type: "select",
        options: publishedContentStatusOptions,
      },
      { key: "title", label: "标题", allowEmpty: true },
      { key: "platform_content_id", label: "平台内容 ID", allowEmpty: true },
      { key: "content_url", label: "内容链接", allowEmpty: true },
      {
        key: "author_account_id",
        label: "发布账号",
        type: "remoteSelect",
        remote: accountRemoteSelect,
        allowEmpty: true,
      },
      { key: "source_task_run_id", label: "来源任务 ID", allowEmpty: true },
      { key: "published_at", label: "发布时间", type: "datetime", allowEmpty: true },
      { key: "media_urls", label: "媒体链接", type: "tags", span: 2, allowEmpty: true },
      { key: "text_content", label: "正文内容", type: "textarea", span: 2, allowEmpty: true },
    ],
    inlineActionKeys: ["detail"],
    rowActions: [
      {
        key: "detail",
        label: "查看详情",
        method: "GET",
        icon: "list",
        path: (record) => `/api/interaction-center/published-contents/${record.id}`,
        refresh: false,
      },
    ],
    deleteLabel: "删除",
    directDelete: true,
    deleteConfirm: "确认删除该发布内容？评论、指标快照和互动动作记录会一起删除。",
  },

  contentComments: {
    key: "contentComments",
    title: "评论记录",
    endpoint: "/api/interaction-center/comments",
    readOnly: true,
    columns: [
      { key: "id", label: "ID", type: "id", width: 80, align: "center" },
      { key: "published_content_id", label: "发布内容", type: "relation", relation: publishedContentRemoteSelect, minWidth: 160, align: "center" },
      { key: "platform_comment_id", label: "平台评论 ID", minWidth: 160, align: "center" },
      { key: "parent_comment_id", label: "父评论", type: "id", minWidth: 120, align: "center" },
      { key: "author_name", label: "评论账号", minWidth: 160, align: "center" },
      { key: "content", label: "评论内容", minWidth: 280 },
      { key: "like_count", label: "点赞", width: 90, align: "center" },
      { key: "reply_count", label: "回复", width: 90, align: "center" },
      { key: "depth", label: "层级", width: 80, align: "center" },
      { key: "status", label: "状态", type: "status", options: commentStatusOptions, width: 100, align: "center" },
      { key: "commented_at", label: "评论时间", type: "datetime", minWidth: 170, align: "center" },
    ],
    filters: [
      {
        key: "published_content_id",
        label: "发布内容",
        type: "remoteSelect",
        remote: publishedContentRemoteSelect,
      },
      {
        key: "status",
        label: "状态",
        type: "select",
        options: commentStatusOptions,
      },
      { key: "keyword", label: "关键字", placeholder: "评论内容 / 作者 / 平台评论 ID" },
    ],
  },

  interactionActions: {
    key: "interactionActions",
    title: "互动动作",
    endpoint: "/api/interaction-center/actions",
    readOnly: true,
    columns: [
      { key: "id", label: "ID", type: "id", width: 80, align: "center" },
      { key: "published_content_id", label: "发布内容", type: "relation", relation: publishedContentRemoteSelect, minWidth: 160, align: "center" },
      { key: "action_type", label: "动作", type: "status", options: interactionActionTypeOptions, align: "center" },
      { key: "comment_id", label: "目标评论", type: "id", minWidth: 120, align: "center" },
      { key: "operator_username", label: "执行账号", minWidth: 150, align: "center" },
      { key: "content", label: "内容", minWidth: 240 },
      { key: "status", label: "状态", type: "status", options: interactionActionStatusOptions, align: "center" },
      { key: "error_message", label: "错误信息", minWidth: 220 },
      { key: "executed_at", label: "执行时间", type: "datetime", minWidth: 170, align: "center" },
    ],
    filters: [
      {
        key: "published_content_id",
        label: "发布内容",
        type: "remoteSelect",
        remote: publishedContentRemoteSelect,
      },
      {
        key: "action_type",
        label: "动作",
        type: "select",
        options: interactionActionTypeOptions,
      },
      {
        key: "status",
        label: "状态",
        type: "select",
        options: interactionActionStatusOptions,
      },
      { key: "keyword", label: "关键字", placeholder: "账号 / 内容 / 错误信息" },
    ],
  },

  scripts: {
    key: "scripts",
    title: "脚本管理",
    endpoint: "/api/scripts",
    createLabel: "新增脚本",
    columns: [
      { key: "id", label: "脚本 ID", type: "id", width: 60, align: "center" },
      { key: "name", label: "脚本信息", type: "scriptIdentity", minWidth: 180 },
      { key: "purpose", label: "适配范围", type: "scriptScope", minWidth: 255 },
      { key: "max_timeout_seconds", label: "运行限制", type: "scriptTimeout", width: 90, align: "center" },
      { key: "status", label: "状态", type: "status", width: 80, align: "center" },
      { key: "updated_at", label: "更新时间", type: "scriptTimeline", width: 143, align: "center" },
    ],
    filters: [
      {
        key: "status",
        label: "状态",
        type: "select",
        options: scriptStatusOptions,
      },
      {
        key: "purpose",
        label: "适配用途",
        type: "select",
        options: scriptPurposeOptions,
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
        key: "purpose",
        label: "适配用途",
        type: "select",
        options: scriptPurposeOptions,
        defaultValue: "general_task",
        required: true,
      },
      {
        key: "status",
        label: "状态",
        type: "select",
        options: scriptStatusOptions,
        defaultValue: "enabled",
      },
      {
        key: "supported_runtime_platforms",
        label: "执行平台",
        type: "select",
        options: runtimePlatformOptions,
        defaultValue: "fingerprint_browser",
        required: true,
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
    createBody: (payload) => buildScriptBody(payload, scriptCreateKeys),
    afterCreate: createScriptParams,
    loadEditRecord: loadScriptForEdit,
    updateBody: (payload) => buildScriptBody(payload, scriptUpdateKeys),
    afterUpdate: updateScriptParams,
    updateFields: [
      { key: "name", label: "脚本名称" },
      {
        key: "purpose",
        label: "适配用途",
        type: "select",
        options: scriptPurposeOptions,
      },
      {
        key: "status",
        label: "状态",
        type: "select",
        options: scriptStatusOptions,
      },
      {
        key: "supported_runtime_platforms",
        label: "执行平台",
        type: "select",
        options: runtimePlatformOptions,
        required: true,
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
    updateBody: (payload) => buildTaskTemplateBody(payload),
    columns: [
      { key: "id", label: "模板 ID", type: "id", width: 55, align: "center" },
      { key: "name", label: "模板信息", type: "templateIdentity", minWidth: 145 },
      {
        key: "script_key",
        label: "关联脚本",
        type: "relation",
        relation: scriptRemoteSelect,
        minWidth: 160,
      },
      { key: "business_platform", label: "执行配置", type: "templateConfig", minWidth: 200 },
      { key: "status", label: "状态", type: "status", width: 80, align: "center" },
      { key: "updated_at", label: "更新时间", type: "templateTimeline", width: 142, align: "center" },
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
        remote: taskTemplateScriptRemoteSelect,
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
        remote: taskTemplateScriptRemoteSelect,
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
        remote: taskTemplateScriptRemoteSelect,
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
    operationWidth: 140,
    columns: [
      { key: "id", label: "任务 ID", type: "id", width: 68, align: "center" },
      { key: "title", label: "任务信息", type: "taskIdentity", minWidth: 135 },
      { key: "business_platform", label: "运行环境", type: "taskPlatform", minWidth: 105 },
      { key: "status", label: "状态", type: "status", width: 105, align: "center" },
      { key: "child_succeeded", label: "执行结果", type: "taskResult", width: 220, align: "center" },
      { key: "created_at", label: "任务时间", type: "taskTimeline", minWidth: 125 },
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
        key: "runtime_platform",
        label: "执行平台",
        type: "select",
        options: runtimePlatformOptions,
        required: true,
        placeholder: "请先选择执行平台",
      },
      {
        key: "template_id",
        label: "任务模板",
        type: "templateSelect",
        required: true,
        remote: dispatchTaskTemplateRemoteSelect,
        placeholder: "请选择任务模板",
        disabledWhen: { key: "runtime_platform", value: "" },
      },
      {
        key: "script_purpose",
        label: "脚本用途",
        hidden: true,
        defaultValue: "general_task",
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
        required: true,
      },
      {
        key: "execution_count",
        label: "每个目标执行次数",
        type: "number",
        required: true,
        defaultValue: 1,
      },
      {
        key: "scheduled_at",
        label: "计划时间",
        type: "datetime",
        allowEmpty: true,
        requiredWhen: { key: "execution_mode", value: "scheduled" },
        disabledWhen: { key: "execution_mode", value: "immediate" },
        placeholder: "计划执行时必填",
      },
      {
        key: "registration_target_mode",
        label: "注册方式",
        type: "segmented",
        options: [
          { label: "使用已有窗口", value: "existing_slots" },
          { label: "创建新窗口", value: "create_windows" },
        ],
        defaultValue: "existing_slots",
        required: true,
        visibleWhen: { key: "script_purpose", value: "account_registration" },
      },
      {
        key: "concurrent_registration_count",
        label: "同时注册数量",
        type: "number",
        min: 1,
        max: 1000,
        defaultValue: 1,
        requiredWhen: { key: "registration_target_mode", value: "create_windows" },
        visibleWhenAll: [
          { key: "script_purpose", value: "account_registration" },
          { key: "registration_target_mode", value: "create_windows" },
        ],
      },
      {
        key: "slot_ids",
        label: "设备组 / 设备",
        type: "slotTree",
        slotTreeAccountPresenceFilter: true,
        requiredWhen: { key: "registration_target_mode", value: "existing_slots" },
        visibleWhen: { key: "registration_target_mode", value: "existing_slots" },
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
      { key: "runtime_platform", label: "执行平台", options: runtimePlatformOptions },
      { key: "provider", label: "供应商" },
      { key: "status", label: "状态", type: "status" },
      { key: "max_concurrent_slots", label: "并发上限" },
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
          { key: "provider_slot_id", label: "设备 ID", minWidth: 170 },
          { key: "display_name", label: "名称", minWidth: 160 },
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
