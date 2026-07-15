<script setup lang="ts">
import { Bot, CheckCircle2, PlugZap, Save } from 'lucide-vue-next'
import { ElNotification } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'

import { http } from '@/api/http'
import type { AnyRecord } from '@/types/api'
import { notifyError } from '@/utils/notify'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})
const endpoint = '/api/interaction-center/ai/provider-config'
const loading = ref(false)
const saving = ref(false)
const testingModel = ref('')
const keyConfigured = ref(false)
const updatedAt = ref('')
const form = reactive({
  api_key: '',
  base_url: 'https://api.openai.com/v1',
  primary_model: 'gpt-5.6-luna',
  fallback_model: 'gpt-5.6-terra',
  enabled: true,
})

async function loadConfig() {
  loading.value = true
  try {
    const data = await http.get<AnyRecord>(endpoint)
    form.api_key = String(data.api_key || '')
    form.base_url = String(data.base_url || 'https://api.openai.com/v1')
    form.primary_model = String(data.primary_model || 'gpt-5.6-luna')
    form.fallback_model = String(data.fallback_model || 'gpt-5.6-terra')
    form.enabled = data.enabled !== false
    keyConfigured.value = Boolean(form.api_key || data.key_configured)
    updatedAt.value = String(data.updated_at || '')
  } catch (err) {
    notifyError(err, '加载失败', '加载互动 AI 配置失败')
  } finally {
    loading.value = false
  }
}

async function testConnection(model: string) {
  testingModel.value = model
  try {
    const data = await http.post<AnyRecord>(`${endpoint}/test`, {
      api_key: form.api_key.trim() || null,
      base_url: form.base_url.trim(),
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
    ElNotification.warning({ title: '请检查配置', message: '启用互动 AI 前需要填写 OpenAI API Key' })
    return
  }
  saving.value = true
  try {
    const data = await http.put<AnyRecord>(endpoint, {
      api_key: form.api_key.trim() || null,
      base_url: form.base_url.trim(),
      primary_model: form.primary_model,
      fallback_model: form.fallback_model,
      enabled: form.enabled,
    })
    form.api_key = String(data.api_key || form.api_key)
    keyConfigured.value = Boolean(form.api_key || data.key_configured)
    updatedAt.value = String(data.updated_at || '')
    ElNotification.success({ title: '保存成功', message: '互动文案模型配置已更新' })
  } catch (err) {
    notifyError(err, '保存失败', '互动 AI 配置保存失败')
  } finally {
    saving.value = false
  }
}

watch(() => props.modelValue, (value) => value && loadConfig())
</script>

<template>
  <el-dialog
    v-model="visible"
    width="min(92vw, 720px)"
    destroy-on-close
    append-to-body
    :close-on-click-modal="false"
  >
    <template #header>
      <div class="config-title">
        <span class="config-title__icon"><Bot :size="18" /></span>
        <div>
          <strong>互动 AI 配置</strong>
          <span>服务端生成评论与回复文案</span>
        </div>
      </div>
    </template>

    <div v-loading="loading" class="config-body">
      <el-form label-position="top">
        <div class="config-grid">
          <el-form-item label="启用状态">
            <div class="enabled-field">
              <el-switch v-model="form.enabled" />
              <span>{{ form.enabled ? '已启用' : '已停用' }}</span>
            </div>
          </el-form-item>
          <el-form-item label="调用策略">
            <el-tag type="primary" effect="light">Luna 主用，Terra 自动兜底</el-tag>
          </el-form-item>
          <el-form-item class="config-grid__full">
            <template #label>
              <div class="token-label">
                <span>OpenAI API Key</span>
                <el-tag v-if="keyConfigured" size="small" type="success" effect="light">
                  <CheckCircle2 :size="13" /> 已配置
                </el-tag>
              </div>
            </template>
            <el-input
              v-model="form.api_key"
              type="password"
              show-password
              autocomplete="new-password"
              placeholder="请输入 OpenAI API Key"
            />
          </el-form-item>
          <el-form-item label="API 地址" class="config-grid__full">
            <el-input v-model="form.base_url" placeholder="https://api.openai.com/v1" />
          </el-form-item>
          <el-form-item label="主模型">
            <el-select v-model="form.primary_model" disabled class="w-full">
              <el-option label="GPT-5.6 Luna" value="gpt-5.6-luna" />
            </el-select>
            <el-button
              text
              type="primary"
              :icon="PlugZap"
              :loading="testingModel === form.primary_model"
              @click="testConnection(form.primary_model)"
            >测试 Luna</el-button>
          </el-form-item>
          <el-form-item label="兜底模型">
            <el-select v-model="form.fallback_model" disabled class="w-full">
              <el-option label="GPT-5.6 Terra" value="gpt-5.6-terra" />
            </el-select>
            <el-button
              text
              type="primary"
              :icon="PlugZap"
              :loading="testingModel === form.fallback_model"
              @click="testConnection(form.fallback_model)"
            >测试 Terra</el-button>
          </el-form-item>
        </div>
      </el-form>
    </div>

    <template #footer>
      <div class="config-footer">
        <span class="config-footer__meta">{{ updatedAt ? '配置已保存' : '尚未保存配置' }}</span>
        <el-space>
          <el-button @click="visible = false">取消</el-button>
          <el-button type="primary" :icon="Save" :loading="saving" @click="saveConfig">保存配置</el-button>
        </el-space>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.config-title,
.enabled-field,
.token-label,
.config-footer {
  display: flex;
  align-items: center;
}

.config-title { gap: 12px; }
.config-title__icon {
  display: inline-flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: #256a9a;
  background: #edf6fc;
}
.config-title strong,
.config-title span { display: block; }
.config-title strong { color: #172333; font-size: 15px; }
.config-title div > span { margin-top: 2px; color: #718096; font-size: 12px; }
.config-body { min-height: 320px; padding-top: 4px; }
.config-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 16px; }
.config-grid__full { grid-column: 1 / -1; }
.enabled-field { min-height: 32px; gap: 8px; color: #526273; font-size: 13px; }
.token-label { width: 100%; gap: 8px; }
.token-label :deep(.el-tag) { display: inline-flex; align-items: center; gap: 4px; }
.config-footer { justify-content: space-between; gap: 12px; }
.config-footer__meta { color: #8793a3; font-size: 12px; }
@media (max-width: 640px) {
  .config-grid { grid-template-columns: 1fr; }
  .config-grid__full { grid-column: auto; }
  .config-footer { align-items: flex-end; flex-direction: column; }
}
</style>
