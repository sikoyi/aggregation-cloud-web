<script setup lang="ts">
import { Save } from 'lucide-vue-next'
import { ElNotification } from 'element-plus'
import { onMounted, reactive, ref, watch } from 'vue'

import { getEnabledAiProviderOptions, resolveEnabledAiProvider, type EnabledAiProviderOption } from '@/api/interactionAi'
import { cacheSystemDefaults, getSystemDefaults, type SystemDefaults } from '@/api/systemSettings'
import { http } from '@/api/http'
import { useScopedBusinessPlatformOptions } from '@/composables/useScopedBusinessPlatformOptions'
import {
  providerOptions,
  runtimePlatformOptions,
} from '@/config/options'
import { formatDate } from '@/utils/format'
import { notifyError } from '@/utils/notify'

const aiProviderOptions = ref<EnabledAiProviderOption[]>([])
const businessPlatformOptions = useScopedBusinessPlatformOptions()

const loading = ref(false)
const saving = ref(false)
const updatedAt = ref('')
const form = reactive<SystemDefaults>({
  default_business_platform: 'threads',
  default_runtime_platform: 'fingerprint_browser',
  default_provider: 'morelogin',
  default_ai_provider: 'gemini',
})

async function loadConfig() {
  loading.value = true
  try {
    const [data, enabledAiOptions] = await Promise.all([
      getSystemDefaults(true),
      getEnabledAiProviderOptions(true),
    ])
    aiProviderOptions.value = enabledAiOptions
    Object.assign(form, data)
    form.default_ai_provider = resolveEnabledAiProvider(data.default_ai_provider, enabledAiOptions) || null
    updatedAt.value = String(data.updated_at || '')
  } catch (err) {
    notifyError(err, '加载失败', '加载系统默认选项失败')
  } finally {
    loading.value = false
  }
}

async function saveConfig() {
  saving.value = true
  try {
    const payload: SystemDefaults = {
      default_business_platform: form.default_business_platform || null,
      default_runtime_platform: form.default_runtime_platform || null,
      default_provider: form.default_provider || null,
      default_ai_provider: form.default_ai_provider || null,
    }
    const data = await http.put<SystemDefaults>('/api/system-settings/defaults', payload)
    const saved = cacheSystemDefaults(data)
    Object.assign(form, saved)
    updatedAt.value = String(saved.updated_at || '')
    ElNotification.success({
      title: '保存成功',
      message: '后续新增表单将按已设置的默认选项自动带入',
      duration: 5000,
    })
  } catch (err) {
    notifyError(err, '保存失败', '系统默认选项保存失败')
  } finally {
    saving.value = false
  }
}

watch(
  [businessPlatformOptions, () => form.default_business_platform],
  ([options, currentValue]) => {
    const value = String(currentValue || '')
    const allowedValues = options.map((option) => String(option.value))
    if (value && !allowedValues.includes(value)) form.default_business_platform = null
  },
  { immediate: true },
)

onMounted(loadConfig)
defineExpose({ loadConfig })
</script>

<template>
  <div v-loading="loading" class="config-panel">
    <div class="config-panel__heading">
      <div>
        <h2>业务默认选项</h2>
        <p>统一设置新增任务、模板、脚本和互动会话时优先带出的选项；留空时不自动选择，具体业务仍按自身规则校验。</p>
      </div>
      <el-tag type="primary" effect="light">全系统生效</el-tag>
    </div>

    <el-form label-position="top" class="config-form">
      <div class="config-grid">
        <el-form-item label="默认业务 App">
          <el-select
            v-model="form.default_business_platform"
            class="w-full"
            filterable
            clearable
            placeholder="不设置默认业务 App"
          >
            <el-option v-for="item in businessPlatformOptions" :key="String(item.value)" :label="item.label" :value="String(item.value)" />
          </el-select>
        </el-form-item>
        <el-form-item label="默认执行平台">
          <el-select
            v-model="form.default_runtime_platform"
            class="w-full"
            clearable
            placeholder="不设置默认执行平台"
          >
            <el-option v-for="item in runtimePlatformOptions" :key="String(item.value)" :label="item.label" :value="String(item.value)" />
          </el-select>
        </el-form-item>
        <el-form-item label="默认设备供应商">
          <el-select
            v-model="form.default_provider"
            class="w-full"
            filterable
            clearable
            placeholder="不设置默认设备供应商"
          >
            <el-option v-for="item in providerOptions" :key="String(item.value)" :label="item.label" :value="String(item.value)" />
          </el-select>
        </el-form-item>
        <el-form-item label="默认 AI 供应商">
          <el-select
            v-if="aiProviderOptions.length"
            v-model="form.default_ai_provider"
            class="w-full"
            clearable
            placeholder="不设置默认 AI 供应商"
          >
            <el-option v-for="item in aiProviderOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
          <el-input v-else disabled placeholder="暂无已启用的互动 AI" />
        </el-form-item>
      </div>
    </el-form>

    <div class="config-panel__footer">
      <span>{{ updatedAt ? '最近更新：' + formatDate(updatedAt) : '当前使用系统初始默认值' }}</span>
      <el-button type="primary" :icon="Save" :loading="saving" @click="saveConfig">保存默认选项</el-button>
    </div>
  </div>
</template>

<style scoped>
.config-panel { min-height: 300px; }
.config-panel__heading,
.config-panel__footer { display: flex; align-items: center; }
.config-panel__heading { justify-content: space-between; gap: 20px; padding-bottom: 14px; border-bottom: 1px solid #e5ebf1; }
.config-panel__heading h2 { color: #203246; font-size: 16px; font-weight: 700; }
.config-panel__heading p { margin-top: 4px; color: #718096; font-size: 12px; }
.config-form { max-width: 900px; padding-top: 18px; }
.config-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 16px; }
.config-panel__footer { justify-content: space-between; gap: 16px; padding-top: 14px; border-top: 1px solid #e5ebf1; color: #8793a3; font-size: 12px; }
@media (max-width: 720px) {
  .config-grid { grid-template-columns: 1fr; }
  .config-panel__footer { align-items: flex-end; flex-direction: column; }
}
</style>
