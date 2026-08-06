<script setup lang="ts">
import { CheckCircle2, CircleDollarSign, PlugZap, RefreshCw, Save } from 'lucide-vue-next'
import { ElNotification } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'

import { http } from '@/api/http'
import { invalidateEnabledAiProviderOptions } from '@/api/interactionAi'
import { getSystemDefaults } from '@/api/systemSettings'
import type { AnyRecord } from '@/types/api'
import { formatDate } from '@/utils/format'
import { notifyError } from '@/utils/notify'

type AiProvider = 'gemini' | 'openai' | 'claude'
type AiSource = 'official' | 'relay'

interface ProviderConfig extends AnyRecord {
  id?: string
  provider: AiProvider
  source_type: AiSource
  api_key?: string
  key_configured?: boolean
  usage_api_key?: string
  usage_key_configured?: boolean
  base_url: string
  primary_model: string
  fallback_model: string
  enabled: boolean
  is_default: boolean
  updated_at?: string
}

interface UsageSummary extends AnyRecord {
  metric_type: 'quota' | 'cost' | 'local'
  live_data_available: boolean
  total_granted?: number | null
  total_used?: number | null
  total_available?: number | null
  unlimited_quota?: boolean | null
  currency?: string | null
  today_cost?: number | null
  month_cost?: number | null
  today_request_count: number
  request_count: number
  input_tokens: number
  output_tokens: number
  total_tokens: number
  message: string
  checked_at: string
}

const emit = defineEmits<{ 'config-saved': [] }>()

const providerSpecs = {
  gemini: {
    label: 'Gemini',
    apiKeyLabel: 'Gemini API Key',
    placeholder: '请输入 Gemini API Key',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    primaryModel: 'gemini-3.5-flash',
    fallbackModel: 'gemini-2.5-flash',
    models: [
      { label: 'Gemini 3.5 Flash', value: 'gemini-3.5-flash' },
      { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
    ],
  },
  openai: {
    label: 'GPT / OpenAI',
    apiKeyLabel: 'OpenAI API Key',
    placeholder: '请输入 OpenAI API Key',
    baseUrl: 'https://api.openai.com/v1',
    primaryModel: 'gpt-5.6-luna',
    fallbackModel: 'gpt-5.6-terra',
    models: [
      { label: 'GPT-5.4', value: 'gpt-5.4' },
      { label: 'GPT-5.4 Mini', value: 'gpt-5.4-mini' },
      { label: 'GPT-5.5', value: 'gpt-5.5' },
      { label: 'GPT-5.6 Luna', value: 'gpt-5.6-luna' },
      { label: 'GPT-5.6 Sol', value: 'gpt-5.6-sol' },
      { label: 'GPT-5.6 Terra', value: 'gpt-5.6-terra' },
    ],
  },
  claude: {
    label: 'Claude',
    apiKeyLabel: 'Claude API Key',
    placeholder: '请输入 Anthropic API Key',
    baseUrl: 'https://api.anthropic.com/v1',
    primaryModel: 'claude-sonnet-4-6',
    fallbackModel: 'claude-haiku-4-5',
    models: [
      { label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4-6' },
      { label: 'Claude Haiku 4.5', value: 'claude-haiku-4-5' },
      { label: 'Claude Opus 4.6', value: 'claude-opus-4-6' },
      { label: 'Claude Sonnet 4.5', value: 'claude-sonnet-4-5-20250929' },
      { label: 'Claude Sonnet 5', value: 'claude-sonnet-5' },
      { label: 'Claude 3.7 Sonnet', value: 'claude-3-7-sonnet-20250219' },
      { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20241022' },
      { label: 'Claude 3.5 Haiku', value: 'claude-3-5-haiku-20241022' },
    ],
  },
} as const

const provider = ref<AiProvider>('gemini')
const source = ref<AiSource>('official')
const providerSpec = computed(() => providerSpecs[provider.value])
const endpoint = computed(() => `/api/interaction-center/ai/provider-config/${provider.value}`)
const activeEndpoint = computed(() => `${endpoint.value}/${source.value}`)
const loading = ref(false)
const saving = ref(false)
const testingModel = ref('')
const usageLoading = ref(false)
const initialized = ref(false)
const configs = ref<ProviderConfig[]>([])
const usage = ref<UsageSummary | null>(null)
const keyConfigured = ref(false)
const usageKeyConfigured = ref(false)
const updatedAt = ref('')
const form = reactive({
  api_key: '',
  usage_api_key: '',
  base_url: providerSpecs.gemini.baseUrl as string,
  primary_model: providerSpecs.gemini.primaryModel as string,
  fallback_model: providerSpecs.gemini.fallbackModel as string,
  enabled: false,
  is_default: false,
})

const sourceLabel = computed(() => source.value === 'official' ? '官方 API' : '中转站')
const apiKeyLabel = computed(() => source.value === 'relay' ? '中转站 API Key' : providerSpec.value.apiKeyLabel)
const apiKeyPlaceholder = computed(() => source.value === 'relay' ? '请输入中转站 API Key' : providerSpec.value.placeholder)
const strategyText = computed(() => {
  const primary = providerSpec.value.models.find((item) => item.value === form.primary_model)?.label || form.primary_model
  const fallback = providerSpec.value.models.find((item) => item.value === form.fallback_model)?.label || form.fallback_model
  return `${primary} 主用，${fallback} 自动兜底`
})
const sourceOptions = computed(() => [
  {
    label: configs.value.find((item) => item.source_type === 'official')?.key_configured
      ? '官方 API · 已配置'
      : '官方 API',
    value: 'official',
  },
  {
    label: configs.value.find((item) => item.source_type === 'relay')?.key_configured
      ? '中转站 · 已配置'
      : '中转站',
    value: 'relay',
  },
])
const usageMetrics = computed(() => {
  const data = usage.value
  if (!data) return []
  if (data.metric_type === 'quota' && data.live_data_available) {
    return [
      { label: '可用额度', value: data.unlimited_quota ? '无限' : formatAmount(data.total_available), emphasis: true },
      { label: '已用额度', value: formatAmount(data.total_used) },
      { label: '授予总量', value: formatAmount(data.total_granted) },
      { label: '本月系统调用', value: formatCount(data.request_count) },
    ]
  }
  if (data.metric_type === 'cost' && data.live_data_available) {
    return [
      { label: '今日费用', value: formatCurrency(data.today_cost, data.currency), emphasis: true },
      { label: '本月费用', value: formatCurrency(data.month_cost, data.currency) },
      { label: '本月系统调用', value: formatCount(data.request_count) },
      { label: '本月系统令牌', value: formatCount(data.total_tokens) },
    ]
  }
  return [
    { label: '今日系统调用', value: formatCount(data.today_request_count), emphasis: true },
    { label: '本月系统调用', value: formatCount(data.request_count) },
    { label: '输入令牌', value: formatCount(data.input_tokens) },
    { label: '输出令牌', value: formatCount(data.output_tokens) },
  ]
})

function defaultConfig(activeSource: AiSource): ProviderConfig {
  return {
    provider: provider.value,
    source_type: activeSource,
    api_key: '',
    usage_api_key: '',
    base_url: activeSource === 'official' ? providerSpec.value.baseUrl : '',
    primary_model: providerSpec.value.primaryModel,
    fallback_model: providerSpec.value.fallbackModel,
    enabled: false,
    is_default: false,
  }
}

function applyActiveConfig() {
  const data = configs.value.find((item) => item.source_type === source.value) || defaultConfig(source.value)
  form.api_key = String(data.api_key || '')
  form.usage_api_key = String(data.usage_api_key || '')
  form.base_url = String(data.base_url || (source.value === 'official' ? providerSpec.value.baseUrl : ''))
  form.primary_model = String(data.primary_model || providerSpec.value.primaryModel)
  form.fallback_model = String(data.fallback_model || providerSpec.value.fallbackModel)
  form.enabled = data.enabled === true
  form.is_default = data.is_default === true
  keyConfigured.value = Boolean(form.api_key || data.key_configured)
  usageKeyConfigured.value = Boolean(form.usage_api_key || data.usage_key_configured)
  updatedAt.value = String(data.updated_at || '')
  usage.value = null
}

async function loadConfigs(preferredSource?: AiSource) {
  loading.value = true
  try {
    configs.value = await http.get<ProviderConfig[]>(endpoint.value)
    const defaultSource = configs.value.find((item) => item.is_default)?.source_type
    const nextSource = preferredSource || defaultSource || 'official'
    const sourceChanged = source.value !== nextSource
    source.value = nextSource
    applyActiveConfig()
    if (!sourceChanged) await loadUsage()
  } catch (err) {
    notifyError(err, '加载失败', `加载 ${providerSpec.value.label} 配置失败`)
  } finally {
    loading.value = false
  }
}

async function loadUsage() {
  const active = configs.value.find((item) => item.source_type === source.value)
  if (!active?.id) {
    usage.value = null
    return
  }
  usageLoading.value = true
  try {
    usage.value = await http.get<UsageSummary>(`${activeEndpoint.value}/usage`)
  } catch (err) {
    notifyError(err, '用量查询失败', `${sourceLabel.value} 暂时无法获取用量`)
  } finally {
    usageLoading.value = false
  }
}

async function testConnection(model: string) {
  testingModel.value = model
  try {
    const data = await http.post<AnyRecord>(`${activeEndpoint.value}/test`, {
      api_key: form.api_key.trim() || null,
      base_url: form.base_url.trim() || null,
      model,
    })
    ElNotification.success({
      title: `${model} 连接成功`,
      message: String(data.sample_content || '模型可正常生成文案'),
      duration: 5000,
    })
  } catch (err) {
    notifyError(err, '连接失败', `${model} 暂时不可用`)
  } finally {
    testingModel.value = ''
  }
}

async function saveConfig() {
  if (form.enabled && !form.api_key.trim() && !keyConfigured.value) {
    ElNotification.warning({ title: '请检查配置', message: `启用前需要填写 ${apiKeyLabel.value}` })
    return
  }
  if (source.value === 'relay' && !form.base_url.trim()) {
    ElNotification.warning({ title: '请检查配置', message: '请填写中转站 API 地址' })
    return
  }
  saving.value = true
  try {
    await http.put<ProviderConfig>(activeEndpoint.value, {
      api_key: form.api_key.trim() || null,
      usage_api_key: form.usage_api_key.trim() || null,
      base_url: source.value === 'official' ? providerSpec.value.baseUrl : form.base_url.trim(),
      primary_model: form.primary_model,
      fallback_model: form.fallback_model,
      enabled: form.enabled,
      is_default: form.is_default,
    })
    invalidateEnabledAiProviderOptions()
    emit('config-saved')
    await loadConfigs(source.value)
    ElNotification.success({ title: '保存成功', message: `${providerSpec.value.label} ${sourceLabel.value}配置已更新` })
  } catch (err) {
    notifyError(err, '保存失败', `${providerSpec.value.label} ${sourceLabel.value}配置保存失败`)
  } finally {
    saving.value = false
  }
}

function formatCount(value: number | null | undefined) {
  return Number(value || 0).toLocaleString('zh-CN')
}

function formatAmount(value: number | null | undefined) {
  return Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 4 })
}

function formatCurrency(value: number | null | undefined, currency?: string | null) {
  const code = String(currency || 'USD').toUpperCase()
  return `${code} ${Number(value || 0).toFixed(4)}`
}

onMounted(async () => {
  try {
    const defaults = await getSystemDefaults()
    if (defaults.default_ai_provider && defaults.default_ai_provider in providerSpecs) {
      provider.value = defaults.default_ai_provider as AiProvider
    }
  } catch {
    // 默认配置读取失败时继续使用 Gemini，不影响互动 AI 配置本身。
  }
  initialized.value = true
  await loadConfigs()
})

watch(provider, () => {
  if (initialized.value) void loadConfigs()
})
watch(source, () => {
  if (!initialized.value) return
  applyActiveConfig()
  void loadUsage()
})
</script>

<template>
  <div v-loading="loading" class="config-panel">
    <div class="config-panel__heading">
      <div>
        <h2>互动 AI 模型</h2>
        <p>官方与中转配置可同时启用；默认来源不可用时，服务端会自动切换到另一来源。</p>
      </div>
      <div class="heading-tags">
        <el-tag v-if="form.is_default" type="primary" effect="light">默认来源</el-tag>
        <el-tag :type="form.enabled ? 'success' : 'info'" effect="light">{{ form.enabled ? '已启用' : '已停用' }}</el-tag>
      </div>
    </div>

    <div class="provider-toolbar">
      <el-segmented
        v-model="provider"
        :options="[
          { label: 'Gemini', value: 'gemini' },
          { label: 'GPT / OpenAI', value: 'openai' },
          { label: 'Claude', value: 'claude' },
        ]"
        class="provider-segment"
      />
      <el-segmented v-model="source" :options="sourceOptions" class="source-segment" />
    </div>

    <div class="source-summary">
      <div>
        <strong>{{ providerSpec.label }} · {{ sourceLabel }}</strong>
        <span>{{ source === 'official' ? '直接调用模型官方接口' : '通过兼容中转站调用，并查询当前 Token 额度' }}</span>
      </div>
      <div class="source-controls">
        <span>启用</span>
        <el-switch v-model="form.enabled" />
        <el-divider direction="vertical" />
        <span>默认来源</span>
        <el-switch v-model="form.is_default" :disabled="form.is_default" />
      </div>
    </div>

    <el-form label-position="top" class="config-form">
      <div class="config-grid">
        <el-form-item class="config-grid__full">
          <template #label>
            <div class="secret-label">
              <span>{{ apiKeyLabel }}</span>
              <el-tag v-if="keyConfigured" class="configured-tag" size="small" type="success" effect="light">
                <CheckCircle2 :size="13" />
                <span>已配置</span>
              </el-tag>
            </div>
          </template>
          <el-input
            v-model="form.api_key"
            type="password"
            show-password
            autocomplete="new-password"
            :placeholder="apiKeyPlaceholder"
          />
        </el-form-item>

        <el-form-item label="API 地址" class="config-grid__full">
          <el-input
            v-model="form.base_url"
            :disabled="source === 'official'"
            :placeholder="source === 'official' ? providerSpec.baseUrl : '例如：https://api.example.com'"
          />
        </el-form-item>

        <el-form-item v-if="source === 'official' && provider !== 'gemini'" class="config-grid__full">
          <template #label>
            <div class="secret-label">
              <span>组织用量 Admin Key</span>
              <el-tag v-if="usageKeyConfigured" class="configured-tag" size="small" type="success" effect="light">
                <CheckCircle2 :size="13" />
                <span>已配置</span>
              </el-tag>
              <span class="optional-text">选填，仅用于查询官方费用</span>
            </div>
          </template>
          <el-input
            v-model="form.usage_api_key"
            type="password"
            show-password
            autocomplete="new-password"
            :placeholder="provider === 'openai' ? '请输入 OpenAI Admin API Key' : '请输入 Anthropic Admin API Key'"
          />
        </el-form-item>

        <el-alert
          v-if="source === 'official' && provider === 'gemini'"
          class="config-grid__full"
          type="info"
          :closable="false"
          show-icon
          title="Gemini 官方 API Key 暂无余额查询接口，本页会统计系统实际调用次数与令牌用量。"
        />

        <el-form-item label="主模型">
          <el-select v-model="form.primary_model" class="w-full">
            <el-option v-for="item in providerSpec.models" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
          <el-button text type="primary" :icon="PlugZap" :loading="testingModel === form.primary_model" @click="testConnection(form.primary_model)">
            测试主模型
          </el-button>
        </el-form-item>

        <el-form-item label="兜底模型">
          <el-select v-model="form.fallback_model" class="w-full">
            <el-option v-for="item in providerSpec.models" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
          <el-button text type="primary" :icon="PlugZap" :loading="testingModel === form.fallback_model" @click="testConnection(form.fallback_model)">
            测试兜底模型
          </el-button>
        </el-form-item>
      </div>
    </el-form>

    <div class="strategy-row">
      <span>当前调用策略</span>
      <el-tag type="primary" effect="light">{{ strategyText }}</el-tag>
    </div>

    <div class="usage-section">
      <div class="usage-section__header">
        <div>
          <CircleDollarSign :size="18" />
          <div>
            <strong>用量与额度</strong>
            <span>{{ usage?.message || '保存配置后可查看当前来源的用量信息' }}</span>
          </div>
        </div>
        <el-button :icon="RefreshCw" :loading="usageLoading" :disabled="!updatedAt" @click="loadUsage">刷新用量</el-button>
      </div>
      <div v-if="usageMetrics.length" class="usage-metrics">
        <div v-for="item in usageMetrics" :key="item.label" class="usage-metric">
          <span>{{ item.label }}</span>
          <strong :class="{ 'is-emphasis': item.emphasis }">{{ item.value }}</strong>
        </div>
      </div>
      <el-empty v-else :image-size="54" description="当前来源尚无用量数据" />
    </div>

    <div class="config-panel__footer">
      <span>{{ updatedAt ? `最近更新：${formatDate(updatedAt)}` : `尚未保存 ${providerSpec.label} ${sourceLabel}配置` }}</span>
      <el-button type="primary" :icon="Save" :loading="saving" @click="saveConfig">保存配置</el-button>
    </div>
  </div>
</template>

<style scoped>
.config-panel { min-height: 500px; }
.config-panel__heading,
.config-panel__footer,
.provider-toolbar,
.source-summary,
.source-controls,
.heading-tags,
.secret-label,
.strategy-row,
.usage-section__header,
.usage-section__header > div { display: flex; align-items: center; }
.config-panel__heading { justify-content: space-between; gap: 20px; padding-bottom: 14px; border-bottom: 1px solid #e5ebf1; }
.config-panel__heading h2 { color: #203246; font-size: 16px; font-weight: 700; }
.config-panel__heading p { margin-top: 4px; color: #718096; font-size: 12px; }
.heading-tags { gap: 8px; }
.provider-toolbar { gap: 12px; margin: 18px 0 14px; }
.provider-segment { width: min(420px, 100%); }
.source-segment { width: min(330px, 100%); }
.source-summary {
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 16px;
  padding: 12px 14px;
  border: 1px solid #dce7f0;
  border-radius: 6px;
  background: #f8fbfd;
}
.source-summary > div:first-child { display: grid; gap: 3px; }
.source-summary strong { color: #243b53; font-size: 14px; }
.source-summary span { color: #6b7c8f; font-size: 12px; }
.source-controls { flex: 0 0 auto; gap: 8px; }
.config-form { max-width: 920px; }
.config-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 16px; }
.config-grid__full { grid-column: 1 / -1; }
.secret-label { width: 100%; gap: 8px; }
.optional-text { color: #8b98a7; font-size: 12px; font-weight: 400; }
.configured-tag { flex: 0 0 auto; white-space: nowrap; }
.configured-tag :deep(.el-tag__content) { display: inline-flex; align-items: center; gap: 4px; line-height: 1; white-space: nowrap; }
.configured-tag :deep(svg) { display: block; flex: 0 0 auto; }
.strategy-row { gap: 10px; margin: 2px 0 16px; color: #617386; font-size: 12px; }
.usage-section { margin-bottom: 16px; border: 1px solid #dce5ed; border-radius: 6px; overflow: hidden; }
.usage-section__header { justify-content: space-between; gap: 16px; padding: 11px 14px; border-bottom: 1px solid #e5ebf1; background: #f8fafc; }
.usage-section__header > div { gap: 9px; color: #2c6b91; }
.usage-section__header > div > div { display: grid; gap: 2px; }
.usage-section__header strong { color: #2b3f53; font-size: 13px; }
.usage-section__header span { color: #718096; font-size: 12px; }
.usage-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); background: #fff; }
.usage-metric { display: grid; gap: 5px; padding: 14px 16px; border-right: 1px solid #e8edf2; }
.usage-metric:last-child { border-right: 0; }
.usage-metric span { color: #718096; font-size: 12px; }
.usage-metric strong { color: #243b53; font-size: 18px; font-weight: 650; }
.usage-metric strong.is-emphasis { color: #176b99; }
.usage-section :deep(.el-empty) { padding: 14px 0; }
.config-panel__footer { justify-content: space-between; gap: 16px; padding-top: 14px; border-top: 1px solid #e5ebf1; color: #8793a3; font-size: 12px; }
@media (max-width: 840px) {
  .provider-toolbar { align-items: stretch; flex-direction: column; }
  .source-summary { align-items: flex-start; flex-direction: column; }
  .usage-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .usage-metric:nth-child(2) { border-right: 0; }
  .usage-metric:nth-child(-n + 2) { border-bottom: 1px solid #e8edf2; }
}
@media (max-width: 720px) {
  .config-grid { grid-template-columns: 1fr; }
  .config-grid__full { grid-column: auto; }
  .config-panel__footer { align-items: flex-end; flex-direction: column; }
}
</style>
