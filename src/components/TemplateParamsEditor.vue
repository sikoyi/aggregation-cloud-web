<script setup lang="ts">
import { RefreshCw } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import { http } from '@/api/http'
import RemoteSelect from '@/components/RemoteSelect.vue'
import {
  loginStatusOptions,
  proxyUsageStatusFilterOptions,
  registrationCountryOptions,
  registrationProviderOptions,
} from '@/config/options'
import type { PageResult } from '@/types/api'
import type { RemoteSelectConfig } from '@/types/crud'
import { notifyError } from '@/utils/notify'

interface ScriptPublic {
  id: string
  script_key: string
}

interface AccountTagOption {
  id: string
  name: string
  member_count?: number
}

interface ScriptParam {
  id: string
  param_key: string
  name: string
  param_type: string
  description?: string | null
  required: boolean
  default_value: unknown
  options: Record<string, unknown>[]
  resource_selector?: Record<string, unknown>
  sort_order: number
}

const props = defineProps<{
  scriptKey: string
  modelValue: unknown
  context?: Record<string, unknown>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, unknown>]
}>()

const loading = ref(false)
const error = ref('')
const params = ref<ScriptParam[]>([])
const accountTags = ref<AccountTagOption[]>([])
const loadedScriptKey = ref('')
const resourcePickerVisible = ref(false)
const resourcePickerValue = ref('')
const resourcePickerParam = ref<ScriptParam | null>(null)
const resourceLabelCache = ref<Record<string, string>>({})
let requestSeq = 0

const values = computed<Record<string, unknown>>(() => {
  return props.modelValue && typeof props.modelValue === 'object' && !Array.isArray(props.modelValue)
    ? (props.modelValue as Record<string, unknown>)
    : {}
})

function defaultForParam(param: ScriptParam) {
  if (param.default_value !== undefined && param.default_value !== null) return param.default_value
  if (param.param_type === 'bool') return false
  if (isAccountTagParam(param)) return { tag_id: '', login_statuses: [] }
  if (isResourceParam(param)) return ''
  return ''
}

function normalizeParamType(param: ScriptParam) {
  return String(param.param_type || '').trim()
}

function isAccountTagParam(param: ScriptParam) {
  return normalizeParamType(param) === 'account_tag'
}

function accountTagSelector(param: ScriptParam) {
  const value = values.value[param.param_key]
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    return {
      tag_id: String(record.tag_id || ''),
      login_statuses: Array.isArray(record.login_statuses)
        ? record.login_statuses.map(String).filter(Boolean)
        : [],
    }
  }
  return { tag_id: '', login_statuses: [] as string[] }
}

function updateAccountTagId(param: ScriptParam, tagId: unknown) {
  updateValue(param, { ...accountTagSelector(param), tag_id: String(tagId || '') })
}

function updateAccountLoginStatuses(param: ScriptParam, statuses: unknown) {
  updateValue(param, {
    ...accountTagSelector(param),
    login_statuses: Array.isArray(statuses) ? statuses.map(String).filter(Boolean) : [],
  })
}
function isResourceParam(param: ScriptParam) {
  return ['proxy', 'res', 'proxy_group', 'account', 'content', 'content_group', 'media_asset', 'media_asset_group', 'execution_slot', 'registration_resource'].includes(normalizeParamType(param))
}

function isProxyGroupParam(param: ScriptParam) {
  return normalizeParamType(param) === 'proxy_group'
}

function proxyGroupSelector(param: ScriptParam) {
  const value = values.value[param.param_key]
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    return {
      group_id: String(record.group_id || record.id || record.value || ''),
      usage_status: String(record.usage_status || record.proxy_status || record.status || 'unused'),
    }
  }
  const groupId = String(value || '')
  return {
    group_id: groupId,
    usage_status: groupId ? 'all' : 'unused',
  }
}

function resourceFieldValue(param: ScriptParam) {
  if (isProxyGroupParam(param)) return proxyGroupSelector(param).group_id
  return String(values.value[param.param_key] || '')
}

function resourceCacheKey(param: ScriptParam, value: string) {
  return `${normalizeParamType(param)}:${value}`
}

function resourceDisplayValue(param: ScriptParam) {
  const value = resourceFieldValue(param)
  if (!value) return ''
  return resourceLabelCache.value[resourceCacheKey(param, value)] || value
}

function remoteFieldValue(record: Record<string, unknown>, keys: string[]) {
  const key = keys.find((item) => record[item] !== undefined && record[item] !== null && record[item] !== '')
  return key ? String(record[key]) : ''
}

function resourceRecordLabel(record: Record<string, unknown>, config: RemoteSelectConfig) {
  const labelKeys = config.labelKeys || (config.labelKey ? [config.labelKey] : [])
  return remoteFieldValue(record, [...labelKeys, config.valueKey])
}

async function loadResourceDisplayLabel(param: ScriptParam, explicitValue?: string) {
  const value = explicitValue ?? resourceFieldValue(param)
  if (!value) return
  const config = resourceSelectConfig(param)
  if (!config?.detailPath) return

  const key = resourceCacheKey(param, value)
  if (resourceLabelCache.value[key]) return
  try {
    const record = await http.get<Record<string, unknown>>(config.detailPath(value))
    const label = resourceRecordLabel(record, config)
    if (label) {
      resourceLabelCache.value = { ...resourceLabelCache.value, [key]: label }
    }
  } catch {
    // 资源可能已被删除；保留 ID 作为兜底，避免表单无法识别当前值。
  }
}

function hydrateResourceDisplayLabels() {
  sortedParams(params.value)
    .filter(isResourceParam)
    .forEach((param) => {
      void loadResourceDisplayLabel(param)
    })
}

function updateResourceFieldValue(param: ScriptParam, value: string) {
  if (isProxyGroupParam(param)) {
    const selector = proxyGroupSelector(param)
    updateValue(param, { ...selector, group_id: value })
    void loadResourceDisplayLabel(param, value)
    return
  }
  updateValue(param, value)
  void loadResourceDisplayLabel(param, value)
}

function clearResourceField(param: ScriptParam) {
  updateResourceFieldValue(param, '')
}

function updateProxyGroupUsageStatus(param: ScriptParam, status: unknown) {
  const selector = proxyGroupSelector(param)
  updateValue(param, { ...selector, usage_status: String(status || 'unused') })
}

function resourceTypeLabel(param: ScriptParam | null) {
  if (!param) return '资源'
  const type = normalizeParamType(param)
  if (type === 'account') return '账号'
  if (type === 'proxy_group') return '代理组'
  if (type === 'execution_slot') return '设备'
  if (type === 'content') return '内容'
  if (type === 'content_group') return '内容池'
  if (type === 'media_asset') return '素材'
  if (type === 'media_asset_group') return '素材组'
  if (type === 'registration_resource') return '注册资源批次'
  return '代理'
}

function resourceSelectConfig(param: ScriptParam | null): RemoteSelectConfig | null {
  if (!param) return null
  const type = normalizeParamType(param)
  if (type === 'account') {
    return {
      endpoint: '/api/accounts',
      labelKeys: ['login_username', 'username', 'display_name', 'platform_account_id'],
      valueKey: 'id',
      detailPath: (value: string) => `/api/accounts/${encodeURIComponent(value)}`,
      secondaryKey: 'country',
      statusKey: 'login_status',
      searchParam: 'keyword',
      pageSize: 50,
      group: {
        endpoint: '/api/slot-groups',
        labelKey: 'name',
        valueKey: 'id',
        groupParam: 'slot_group_id',
        ungroupedParam: 'slot_group_ungrouped',
        ungroupedLabel: '未分组账号',
        params: {
          business_platform: props.context?.business_platform || undefined,
          runtime_platform: props.context?.runtime_platform || undefined,
          provider: props.context?.provider || undefined,
        },
      },
    }
  }
  if (type === 'proxy_group') {
    return {
      endpoint: '/api/resource-center/proxy-groups',
      labelKey: 'name',
      valueKey: 'id',
      detailPath: (value: string) => `/api/resource-center/proxy-groups/${encodeURIComponent(value)}`,
      secondaryKey: 'member_count',
      searchParam: 'keyword',
      pageSize: 50,
    }
  }
  if (type === 'execution_slot') {
    return {
      endpoint: '/api/execution-slots',
      labelKeys: ['display_name', 'provider_slot_id', 'provider_slot_no'],
      valueKey: 'id',
      detailPath: (value: string) => `/api/execution-slots/${encodeURIComponent(value)}`,
      secondaryKeys: ['provider_slot_id', 'provider'],
      statusKey: 'status',
      searchParam: 'keyword',
      pageSize: 50,
      group: {
        endpoint: '/api/slot-groups',
        labelKey: 'name',
        valueKey: 'id',
        groupParam: 'group_id',
        ungroupedParam: 'ungrouped',
        ungroupedLabel: '未分组设备',
        params: {
          runtime_platform: props.context?.runtime_platform || undefined,
          provider: props.context?.provider || undefined,
        },
      },
    }
  }
  if (type === 'content') {
    return {
      endpoint: '/api/content-center/contents',
      labelKeys: ['title', 'id'],
      valueKey: 'id',
      detailPath: (value: string) => `/api/content-center/contents/${encodeURIComponent(value)}`,
      secondaryKeys: ['content_type', 'status'],
      searchParam: 'keyword',
      params: { status: 'unused' },
      pageSize: 50,
      group: {
        endpoint: '/api/content-center/content-groups',
        labelKey: 'name',
        valueKey: 'id',
        groupParam: 'group_id',
        ungroupedParam: 'ungrouped',
        ungroupedLabel: '未分组内容',
        params: {
          business_platform: props.context?.business_platform || undefined,
        },
      },
    }
  }
  if (type === 'content_group') {
    return {
      endpoint: '/api/content-center/content-groups',
      labelKey: 'name',
      valueKey: 'id',
      detailPath: (value: string) => `/api/content-center/content-groups/${encodeURIComponent(value)}`,
      secondaryKey: 'unused_count',
      searchParam: 'keyword',
      pageSize: 50,
    }
  }
  if (type === 'media_asset') {
    return {
      endpoint: '/api/resource-center/media-assets',
      labelKeys: ['name', 'source_url', 'storage_uri'],
      valueKey: 'id',
      detailPath: (value: string) => `/api/resource-center/media-assets/${encodeURIComponent(value)}`,
      secondaryKeys: ['asset_type', 'status'],
      searchParam: 'keyword',
      params: { status: 'enabled' },
      pageSize: 50,
      group: {
        endpoint: '/api/resource-center/media-asset-groups',
        labelKey: 'name',
        valueKey: 'id',
        groupParam: 'group_id',
        ungroupedParam: 'ungrouped',
        ungroupedLabel: '未分组素材',
        params: {
          business_platform: props.context?.business_platform || undefined,
        },
      },
    }
  }
  if (type === 'media_asset_group') {
    return {
      endpoint: '/api/resource-center/media-asset-groups',
      labelKey: 'name',
      valueKey: 'id',
      detailPath: (value: string) => `/api/resource-center/media-asset-groups/${encodeURIComponent(value)}`,
      secondaryKeys: ['business_platform', 'member_count'],
      searchParam: 'keyword',
      pageSize: 50,
    }
  }
  if (type === 'registration_resource') {
    const templateId = String(param.resource_selector?.template_id || '')
    return {
      endpoint: '/api/resource-center/registration-resources/batches',
      labelKeys: ['name', 'source_filename'],
      valueKey: 'id',
      detailPath: (value: string) => `/api/resource-center/registration-resources/batches/${encodeURIComponent(value)}`,
      secondaryKeys: ['available_count', 'total_count'],
      searchParam: 'keyword',
      params: {
        template_id: templateId || undefined,
        availability: 'available',
      },
      pageSize: 50,
      emptyText: '暂无可用注册资源，请先到资源中心导入',
    }
  }
  return {
    endpoint: '/api/resource-center/proxies',
    labelKeys: ['name', 'source_proxy_url', 'host'],
    valueKey: 'id',
    detailPath: (value: string) => `/api/resource-center/proxies/${encodeURIComponent(value)}`,
    secondaryKeys: ['source_proxy_url', 'status'],
    searchParam: 'keyword',
    pageSize: 50,
    group: {
      endpoint: '/api/resource-center/proxy-groups',
      labelKey: 'name',
      valueKey: 'id',
      groupParam: 'group_id',
      ungroupedParam: 'ungrouped',
      ungroupedLabel: '未分组代理',
    },
  }
}

const activeResourceSelectConfig = computed(() => resourceSelectConfig(resourcePickerParam.value))

function sortedParams(items: ScriptParam[]) {
  return [...items].sort((left, right) => (left.sort_order || 0) - (right.sort_order || 0))
}

function mergeDefaults(items: ScriptParam[]) {
  const next: Record<string, unknown> = {}
  sortedParams(items).forEach((param) => {
    next[param.param_key] =
      values.value[param.param_key] !== undefined ? values.value[param.param_key] : defaultForParam(param)
  })
  emit('update:modelValue', next)
}

async function loadAccountTags() {
  const items: AccountTagOption[] = []
  let page = 1
  let total = 0
  do {
    const data = await http.get<PageResult<AccountTagOption>>('/api/account-tags', {
      page,
      page_size: 100,
    })
    items.push(...data.items)
    total = data.total
    page += 1
    if (!data.items.length) break
  } while (items.length < total)
  accountTags.value = items
}

async function loadParams(scriptKey: string) {
  const key = scriptKey.trim()
  params.value = []
  loadedScriptKey.value = ''
  error.value = ''
  if (!key) return

  const seq = ++requestSeq
  loading.value = true
  try {
    const script = await http.get<ScriptPublic>(`/api/scripts/by-key/${encodeURIComponent(key)}`)
    const items = await http.get<ScriptParam[]>(`/api/scripts/${script.id}/params`)
    if (seq !== requestSeq) return
    params.value = sortedParams(items)
    if (items.some(isAccountTagParam)) await loadAccountTags()
    if (seq !== requestSeq) return
    loadedScriptKey.value = key
    mergeDefaults(items)
  } catch (err) {
    if (seq !== requestSeq) return
    error.value = notifyError(err, '加载失败', '加载脚本参数失败')
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

function updateValue(param: ScriptParam, value: unknown) {
  emit('update:modelValue', { ...values.value, [param.param_key]: value })
}

function openResourcePicker(param: ScriptParam) {
  resourcePickerParam.value = param
  resourcePickerValue.value = resourceFieldValue(param)
  resourcePickerVisible.value = true
}

function confirmResourcePicker() {
  if (!resourcePickerParam.value) return
  updateResourceFieldValue(resourcePickerParam.value, resourcePickerValue.value)
  resourcePickerVisible.value = false
}

watch(
  () => props.scriptKey,
  (scriptKey) => {
    loadParams(scriptKey)
  },
  { immediate: true },
)

watch(
  [() => props.modelValue, () => params.value],
  () => {
    hydrateResourceDisplayLabels()
  },
  { deep: true },
)
</script>

<template>
  <div class="template-param-editor w-full space-y-3">
    <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <span class="text-xs text-slate-500">根据脚本参数定义生成模板默认参数；保存后会写入 default_params。</span>
      <el-button :icon="RefreshCw" :loading="loading" :disabled="!scriptKey" @click="loadParams(scriptKey)">
        重新加载
      </el-button>
    </div>

    <el-alert v-if="!scriptKey" title="请先填写脚本 Key" type="info" show-icon :closable="false" />
    <el-empty v-else-if="!loading && loadedScriptKey && !params.length" description="该脚本暂无参数定义" :image-size="72" />

    <div v-if="params.length" class="grid grid-cols-1 gap-3 md:grid-cols-2">
      <el-card v-for="param in params" :key="param.id || param.param_key" shadow="never" class="template-param-card">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="truncate text-sm font-semibold text-ink">
                {{ param.name }}
                <span v-if="param.required" class="text-red-500">*</span>
              </div>
              <div class="truncate font-mono text-xs text-slate-500">{{ param.param_key }}</div>
            </div>
            <el-tag size="small" effect="plain">{{ param.param_type }}</el-tag>
          </div>
        </template>

        <el-switch
          v-if="param.param_type === 'bool'"
          :model-value="Boolean(values[param.param_key])"
          active-text="是"
          inactive-text="否"
          @update:model-value="updateValue(param, $event)"
        />
        <el-select
          v-else-if="param.param_type === 'country'"
          :model-value="String(values[param.param_key] ?? '')"
          class="w-full"
          filterable
          clearable
          placeholder="搜索并选择国家/地区"
          @update:model-value="updateValue(param, $event)"
        >
          <el-option
            v-for="option in registrationCountryOptions"
            :key="String(option.value)"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
        <el-select
          v-else-if="param.param_type === 'registration_provider'"
          :model-value="String(values[param.param_key] ?? '')"
          class="w-full"
          filterable
          clearable
          placeholder="请选择接码平台"
          @update:model-value="updateValue(param, $event)"
        >
          <el-option
            v-for="option in registrationProviderOptions"
            :key="String(option.value)"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
        <div v-else-if="isAccountTagParam(param)" class="account-tag-param-field">
          <el-select
            :model-value="accountTagSelector(param).tag_id"
            class="w-full"
            filterable
            clearable
            placeholder="请选择账号标签或未设置标签"
            @update:model-value="updateAccountTagId(param, $event)"
          >
            <el-option label="未设置标签" value="__untagged__" />
            <el-option
              v-for="tag in accountTags"
              :key="tag.id"
              :label="`${tag.name}（${tag.member_count || 0}）`"
              :value="tag.id"
            />
          </el-select>
          <el-select
            :model-value="accountTagSelector(param).login_statuses"
            class="w-full"
            multiple
            collapse-tags
            collapse-tags-tooltip
            clearable
            placeholder="全部登录状态"
            @update:model-value="updateAccountLoginStatuses(param, $event)"
          >
            <el-option
              v-for="option in loginStatusOptions"
              :key="String(option.value)"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </div>
        <div v-else-if="isResourceParam(param)" class="resource-param-field">
          <el-input
            :model-value="resourceDisplayValue(param)"
            readonly
            clearable
            :placeholder="`请选择${resourceTypeLabel(param)}，下发时服务端会解析成资源信息`"
            @clear="clearResourceField(param)"
          />
          <el-button type="primary" @click="openResourcePicker(param)">
            选择{{ resourceTypeLabel(param) }}
          </el-button>
          <el-select
            v-if="isProxyGroupParam(param)"
            :model-value="proxyGroupSelector(param).usage_status"
            class="resource-param-field__strategy"
            placeholder="代理使用状态"
            @update:model-value="updateProxyGroupUsageStatus(param, $event)"
          >
            <el-option
              v-for="option in proxyUsageStatusFilterOptions"
              :key="String(option.value)"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </div>
        <el-input
          v-else
          :model-value="String(values[param.param_key] ?? '')"
          type="text"
          clearable
          @update:model-value="updateValue(param, $event)"
        />

        <div v-if="param.description" class="mt-2 text-xs leading-5 text-slate-500">
          {{ param.description }}
        </div>
      </el-card>
    </div>

    <el-dialog
      v-model="resourcePickerVisible"
      :title="`选择${resourceTypeLabel(resourcePickerParam)}`"
      width="560px"
      append-to-body
      destroy-on-close
    >
      <div class="space-y-3">
        <RemoteSelect
          v-if="activeResourceSelectConfig"
          v-model="resourcePickerValue"
          :config="activeResourceSelectConfig"
          :context="context"
          :placeholder="`搜索并选择${resourceTypeLabel(resourcePickerParam)}`"
        />
      </div>

      <template #footer>
        <el-button @click="resourcePickerVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmResourcePicker">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.account-tag-param-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
}

.resource-param-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.resource-param-field__strategy {
  grid-column: 1 / -1;
}

@media (max-width: 640px) {
  .account-tag-param-field,
  .resource-param-field {
    grid-template-columns: 1fr;
  }
}
</style>
