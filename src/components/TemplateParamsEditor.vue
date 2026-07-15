<script setup lang="ts">
import { RefreshCw } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import { http } from '@/api/http'
import RemoteSelect from '@/components/RemoteSelect.vue'
import { accountSelectionStrategyOptions, proxyUsageStatusFilterOptions } from '@/config/options'
import type { RemoteSelectConfig } from '@/types/crud'
import { notifyError } from '@/utils/notify'

type ParamOption = Record<string, unknown>

interface ScriptPublic {
  id: string
  script_key: string
}

interface ScriptParam {
  id: string
  param_key: string
  name: string
  param_type: string
  description?: string | null
  required: boolean
  default_value: unknown
  options: ParamOption[]
  sort_order: number
}

const props = defineProps<{
  scriptKey: string
  modelValue: unknown
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, unknown>]
}>()

const loading = ref(false)
const error = ref('')
const params = ref<ScriptParam[]>([])
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
  if (param.param_type === 'number') return 0
  if (param.param_type === 'json') return {}
  if (isResourceParam(param)) return ''
  return ''
}

function normalizeParamType(param: ScriptParam) {
  return String(param.param_type || '').trim()
}

function isResourceParam(param: ScriptParam) {
  return ['proxy', 'res', 'proxy_group', 'account', 'account_group', 'content', 'content_group', 'media_asset', 'execution_slot'].includes(normalizeParamType(param))
}

function isAccountGroupParam(param: ScriptParam) {
  return normalizeParamType(param) === 'account_group'
}

function isProxyGroupParam(param: ScriptParam) {
  return normalizeParamType(param) === 'proxy_group'
}

function accountGroupSelector(param: ScriptParam) {
  const value = values.value[param.param_key]
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    return {
      group_id: String(record.group_id || record.id || record.value || ''),
      selection_strategy: String(record.selection_strategy || record.account_selection_strategy || 'not_logged_in'),
    }
  }
  const groupId = String(value || '')
  return {
    group_id: groupId,
    selection_strategy: groupId ? 'all' : 'not_logged_in',
  }
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
  if (isAccountGroupParam(param)) return accountGroupSelector(param).group_id
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
  if (isAccountGroupParam(param)) {
    const selector = accountGroupSelector(param)
    updateValue(param, { ...selector, group_id: value })
    void loadResourceDisplayLabel(param, value)
    return
  }
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

function updateAccountGroupStrategy(param: ScriptParam, strategy: unknown) {
  const selector = accountGroupSelector(param)
  updateValue(param, { ...selector, selection_strategy: String(strategy || 'not_logged_in') })
}

function updateProxyGroupUsageStatus(param: ScriptParam, status: unknown) {
  const selector = proxyGroupSelector(param)
  updateValue(param, { ...selector, usage_status: String(status || 'unused') })
}

function resourceTypeLabel(param: ScriptParam | null) {
  if (!param) return '资源'
  const type = normalizeParamType(param)
  if (type === 'account') return '账号'
  if (type === 'account_group') return '账号组'
  if (type === 'proxy_group') return '代理组'
  if (type === 'execution_slot') return '设备'
  if (type === 'content') return '内容'
  if (type === 'content_group') return '内容池'
  if (type === 'media_asset') return '媒体资源'
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
    }
  }
  if (type === 'account_group') {
    return {
      endpoint: '/api/account-groups',
      labelKey: 'name',
      valueKey: 'id',
      detailPath: (value: string) => `/api/account-groups/${encodeURIComponent(value)}`,
      secondaryKey: 'business_platform',
      searchParam: 'keyword',
      pageSize: 50,
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
      secondaryKey: 'provider',
      statusKey: 'status',
      searchParam: 'keyword',
      pageSize: 50,
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
      endpoint: '/api/content-center/media-assets',
      labelKeys: ['name', 'source_url', 'storage_uri'],
      valueKey: 'id',
      detailPath: (value: string) => `/api/content-center/media-assets/${encodeURIComponent(value)}`,
      secondaryKeys: ['asset_type', 'status'],
      searchParam: 'keyword',
      params: { status: 'enabled' },
      pageSize: 50,
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
  }
}

const activeResourceSelectConfig = computed(() => resourceSelectConfig(resourcePickerParam.value))

function optionLabel(option: ParamOption) {
  const label = option.label ?? option.name ?? option.value ?? option.key ?? option.id
  return String(label ?? '')
}

function optionValue(option: ParamOption) {
  const value = option.value ?? option.key ?? option.id ?? option.label ?? option.name
  return String(value ?? '')
}

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

function jsonValue(param: ScriptParam) {
  const value = values.value[param.param_key]
  return typeof value === 'string' ? value : JSON.stringify(value ?? {}, null, 2)
}

function updateJsonValue(param: ScriptParam, value: string) {
  try {
    updateValue(param, value ? JSON.parse(value) : {})
  } catch {
    updateValue(param, value)
  }
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

        <el-input
          v-if="param.param_type === 'textarea'"
          :model-value="String(values[param.param_key] ?? '')"
          type="textarea"
          :rows="4"
          resize="vertical"
          @update:model-value="updateValue(param, $event)"
        />
        <el-input-number
          v-else-if="param.param_type === 'number'"
          :model-value="Number(values[param.param_key] ?? 0)"
          class="w-full"
          controls-position="right"
          @update:model-value="updateValue(param, $event)"
        />
        <el-switch
          v-else-if="param.param_type === 'bool'"
          :model-value="Boolean(values[param.param_key])"
          active-text="是"
          inactive-text="否"
          @update:model-value="updateValue(param, $event)"
        />
        <el-select
          v-else-if="param.param_type === 'enum'"
          :model-value="String(values[param.param_key] ?? '')"
          class="w-full"
          clearable
          filterable
          @update:model-value="updateValue(param, $event)"
        >
          <el-option
            v-for="option in param.options || []"
            :key="optionValue(option)"
            :label="optionLabel(option)"
            :value="optionValue(option)"
          />
        </el-select>
        <el-input
          v-else-if="param.param_type === 'json'"
          :model-value="jsonValue(param)"
          type="textarea"
          :rows="5"
          class="font-mono text-xs"
          resize="vertical"
          @update:model-value="updateJsonValue(param, $event)"
        />
        <el-date-picker
          v-else-if="param.param_type === 'datetime'"
          :model-value="String(values[param.param_key] ?? '')"
          class="w-full"
          type="datetime"
          format="YYYY-MM-DD HH:mm:ss"
          value-format="YYYY-MM-DDTHH:mm:ss"
          placeholder="选择日期时间"
          clearable
          @update:model-value="updateValue(param, $event)"
        />
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
            v-if="isAccountGroupParam(param)"
            :model-value="accountGroupSelector(param).selection_strategy"
            class="resource-param-field__strategy"
            placeholder="账号筛选策略"
            @update:model-value="updateAccountGroupStrategy(param, $event)"
          >
            <el-option
              v-for="option in accountSelectionStrategyOptions"
              :key="String(option.value)"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
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
.resource-param-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.resource-param-field__strategy {
  grid-column: 1 / -1;
}

@media (max-width: 640px) {
  .resource-param-field {
    grid-template-columns: 1fr;
  }
}
</style>
