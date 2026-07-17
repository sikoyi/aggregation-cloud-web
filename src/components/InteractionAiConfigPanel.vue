<script setup lang="ts">
import { CheckCircle2, PlugZap, Save } from 'lucide-vue-next'
import { ElNotification } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'

import { http } from '@/api/http'
import { invalidateEnabledAiProviderOptions } from '@/api/interactionAi'
import { getSystemDefaults } from '@/api/systemSettings'
import type { AnyRecord } from '@/types/api'
import { formatDate } from '@/utils/format'
import { notifyError } from '@/utils/notify'

type AiProvider = 'gemini' | 'openai' | 'claude'

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
    apiKeyLabel: 'GPT / OpenAI API Key',
    placeholder: '请输入 OpenAI 或兼容中转站 API Key',
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
    placeholder: '请输入 Anthropic 或兼容中转站 API Key',
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
const providerSpec = computed(() => providerSpecs[provider.value])
const endpoint = computed(() => `/api/interaction-center/ai/provider-config/${provider.value}`)
const loading = ref(false)
const saving = ref(false)
const testingModel = ref('')
const keyConfigured = ref(false)
const updatedAt = ref('')
const initialized = ref(false)
const form = reactive({
  api_key: '',
  base_url: providerSpecs.gemini.baseUrl as string,
  primary_model: providerSpecs.gemini.primaryModel as string,
  fallback_model: providerSpecs.gemini.fallbackModel as string,
  enabled: true,
})
const strategyText = computed(() => {
  const primary = providerSpec.value.models.find((item) => item.value === form.primary_model)?.label || form.primary_model
  const fallback = providerSpec.value.models.find((item) => item.value === form.fallback_model)?.label || form.fallback_model
  return `${primary} 主用，${fallback} 自动兜底`
})

function applyDefaults() {
  const spec = providerSpec.value
  form.api_key = ''
  form.base_url = spec.baseUrl
  form.primary_model = spec.primaryModel
  form.fallback_model = spec.fallbackModel
  form.enabled = true
  keyConfigured.value = false
  updatedAt.value = ''
}

async function loadConfig() {
  applyDefaults()
  loading.value = true
  try {
    const data = await http.get<AnyRecord>(endpoint.value)
    form.api_key = String(data.api_key || '')
    form.base_url = String(data.base_url || providerSpec.value.baseUrl)
    form.primary_model = String(data.primary_model || providerSpec.value.primaryModel)
    form.fallback_model = String(data.fallback_model || providerSpec.value.fallbackModel)
    form.enabled = data.enabled !== false
    keyConfigured.value = Boolean(form.api_key || data.key_configured)
    updatedAt.value = String(data.updated_at || '')
  } catch (err) {
    notifyError(err, '加载失败', `加载 ${providerSpec.value.label} 配置失败`)
  } finally {
    loading.value = false
  }
}

async function testConnection(model: string) {
  testingModel.value = model
  try {
    const data = await http.post<AnyRecord>(`${endpoint.value}/test`, {
      api_key: form.api_key.trim() || null,
      base_url: form.base_url.trim(),
      model,
    })
    ElNotification.success({ title: `${model} 连接成功`, message: String(data.sample_content || '模型可正常生成文案'), duration: 5000 })
  } catch (err) {
    notifyError(err, '连接失败', `${model} 暂时不可用`)
  } finally {
    testingModel.value = ''
  }
}

async function saveConfig() {
  if (form.enabled && !form.api_key.trim() && !keyConfigured.value) {
    ElNotification.warning({ title: '请检查配置', message: `启用互动 AI 前需要填写 ${providerSpec.value.apiKeyLabel}` })
    return
  }
  saving.value = true
  try {
    const data = await http.put<AnyRecord>(endpoint.value, {
      api_key: form.api_key.trim() || null,
      base_url: form.base_url.trim(),
      primary_model: form.primary_model,
      fallback_model: form.fallback_model,
      enabled: form.enabled,
    })
    form.api_key = String(data.api_key || form.api_key)
    keyConfigured.value = Boolean(form.api_key || data.key_configured)
    updatedAt.value = String(data.updated_at || '')
    invalidateEnabledAiProviderOptions()
    emit('config-saved')
    ElNotification.success({ title: '保存成功', message: `${providerSpec.value.label} 配置已更新` })
  } catch (err) {
    notifyError(err, '保存失败', `${providerSpec.value.label} 配置保存失败`)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    const defaults = await getSystemDefaults()
    if (defaults.default_ai_provider in providerSpecs) {
      provider.value = defaults.default_ai_provider as AiProvider
    }
  } catch {
    // 默认配置加载失败时继续使用 Gemini，不影响模型配置本身。
  }
  initialized.value = true
  await loadConfig()
})
watch(provider, () => {
  if (initialized.value) void loadConfig()
})
</script>

<template>
  <div v-loading="loading" class="config-panel">
    <div class="config-panel__heading">
      <div>
        <h2>互动 AI 模型</h2>
        <p>服务端生成首次评论和后续多轮回复文案，脚本只负责执行并上报结果。</p>
      </div>
      <el-tag :type="form.enabled ? 'success' : 'info'" effect="light">{{ form.enabled ? '已启用' : '已停用' }}</el-tag>
    </div>

    <el-segmented
      v-model="provider"
      :options="[
        { label: 'Gemini', value: 'gemini' },
        { label: 'GPT / OpenAI', value: 'openai' },
        { label: 'Claude', value: 'claude' },
      ]"
      class="provider-segment"
    />

    <el-form label-position="top" class="config-form">
      <div class="config-grid">
        <el-form-item label="启用状态">
          <div class="enabled-field"><el-switch v-model="form.enabled" /><span>{{ form.enabled ? '已启用互动文案生成' : '已停用该模型供应商' }}</span></div>
        </el-form-item>
        <el-form-item label="调用策略"><el-tag type="primary" effect="light">{{ strategyText }}</el-tag></el-form-item>
        <el-form-item class="config-grid__full">
          <template #label>
            <div class="secret-label">
              <span>{{ providerSpec.apiKeyLabel }}</span>
              <el-tag v-if="keyConfigured" class="configured-tag" size="small" type="success" effect="light">
                <CheckCircle2 :size="13" />
                <span>已配置</span>
              </el-tag>
            </div>
          </template>
          <el-input v-model="form.api_key" type="password" show-password autocomplete="new-password" :placeholder="providerSpec.placeholder" />
        </el-form-item>
        <el-form-item label="API 地址" class="config-grid__full"><el-input v-model="form.base_url" :placeholder="providerSpec.baseUrl" /></el-form-item>
        <el-form-item label="主模型">
          <el-select v-model="form.primary_model" class="w-full">
            <el-option v-for="item in providerSpec.models" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
          <el-button text type="primary" :icon="PlugZap" :loading="testingModel === form.primary_model" @click="testConnection(form.primary_model)">测试主模型</el-button>
        </el-form-item>
        <el-form-item label="兜底模型">
          <el-select v-model="form.fallback_model" class="w-full">
            <el-option v-for="item in providerSpec.models" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
          <el-button text type="primary" :icon="PlugZap" :loading="testingModel === form.fallback_model" @click="testConnection(form.fallback_model)">测试兜底模型</el-button>
        </el-form-item>
      </div>
    </el-form>

    <div class="config-panel__footer">
      <span>{{ updatedAt ? `最近更新：${formatDate(updatedAt)}` : `尚未保存 ${providerSpec.label} 配置` }}</span>
      <el-button type="primary" :icon="Save" :loading="saving" @click="saveConfig">保存配置</el-button>
    </div>
  </div>
</template>

<style scoped>
.config-panel { min-height: 400px; }
.config-panel__heading,
.config-panel__footer,
.enabled-field,
.secret-label { display: flex; align-items: center; }
.config-panel__heading { justify-content: space-between; gap: 20px; padding-bottom: 14px; border-bottom: 1px solid #e5ebf1; }
.config-panel__heading h2 { color: #203246; font-size: 16px; font-weight: 700; }
.config-panel__heading p { margin-top: 4px; color: #718096; font-size: 12px; }
.provider-segment { width: min(420px, 100%); margin: 18px 0; }
.config-form { max-width: 900px; }
.config-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 16px; }
.config-grid__full { grid-column: 1 / -1; }
.enabled-field { min-height: 32px; gap: 9px; color: #526273; font-size: 13px; }
.secret-label { width: 100%; gap: 8px; }
.configured-tag { flex: 0 0 auto; white-space: nowrap; }
.configured-tag :deep(.el-tag__content) { display: inline-flex; align-items: center; gap: 4px; line-height: 1; white-space: nowrap; }
.configured-tag :deep(svg) { display: block; flex: 0 0 auto; }
.config-panel__footer { justify-content: space-between; gap: 16px; padding-top: 14px; border-top: 1px solid #e5ebf1; color: #8793a3; font-size: 12px; }
@media (max-width: 720px) {
  .config-grid { grid-template-columns: 1fr; }
  .config-grid__full { grid-column: auto; }
  .config-panel__footer { align-items: flex-end; flex-direction: column; }
}
</style>
