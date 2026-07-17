<script setup lang="ts">
import { CheckCircle2, PlugZap, Save } from 'lucide-vue-next'
import { ElNotification } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'

import { http } from '@/api/http'
import { businessPlatformOptions } from '@/config/options'
import type { AnyRecord } from '@/types/api'
import { formatDate } from '@/utils/format'
import { notifyError } from '@/utils/notify'

const platformOptions = businessPlatformOptions.filter((item) => item.value === 'threads')
const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const tokenConfigured = ref(false)
const updatedAt = ref('')
const form = reactive({
  business_platform: 'threads',
  api_token: '',
  enabled: true,
})

function endpoint(suffix = '') {
  return `/api/interaction-center/content-monitor/provider-config/${encodeURIComponent(form.business_platform)}${suffix}`
}

async function loadConfig() {
  loading.value = true
  try {
    const data = await http.get<AnyRecord>(endpoint())
    form.enabled = data.enabled !== false
    form.api_token = String(data.api_token || '')
    tokenConfigured.value = Boolean(form.api_token || data.token_configured)
    updatedAt.value = String(data.updated_at || '')
  } catch (err) {
    notifyError(err, '加载失败', '加载 Apify 配置失败')
  } finally {
    loading.value = false
  }
}

async function testConnection() {
  testing.value = true
  try {
    await http.post<AnyRecord>(endpoint('/test'), { api_token: form.api_token.trim() || null })
    ElNotification.success({
      title: '连接成功',
      message: 'Token 可以访问服务端固定的 Threads 采集适配器',
      duration: 5000,
    })
  } catch (err) {
    notifyError(err, '连接失败', 'Apify 配置不可用')
  } finally {
    testing.value = false
  }
}

async function saveConfig() {
  if (form.enabled && !form.api_token.trim() && !tokenConfigured.value) {
    ElNotification.warning({ title: '请检查配置', message: '启用监听前需要填写 Apify Token' })
    return
  }
  saving.value = true
  try {
    const data = await http.put<AnyRecord>(endpoint(), {
      api_token: form.api_token.trim() || null,
      enabled: form.enabled,
    })
    form.api_token = String(data.api_token || form.api_token)
    tokenConfigured.value = Boolean(form.api_token || data.token_configured)
    updatedAt.value = String(data.updated_at || '')
    ElNotification.success({ title: '保存成功', message: 'Apify 监听配置已更新' })
  } catch (err) {
    notifyError(err, '保存失败', 'Apify 配置保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(loadConfig)
</script>

<template>
  <div v-loading="loading" class="config-panel">
    <div class="config-panel__heading">
      <div>
        <h2>Apify 内容监听</h2>
        <p>服务端使用固定 Actor 采集账号资料、帖子指标和评论，运营只需维护访问 Token。</p>
      </div>
      <el-tag :type="form.enabled ? 'success' : 'info'" effect="light">{{ form.enabled ? '已启用' : '已停用' }}</el-tag>
    </div>

    <el-form label-position="top" class="config-form">
      <div class="config-grid">
        <el-form-item label="业务 App">
          <el-select v-model="form.business_platform" disabled class="w-full">
            <el-option v-for="option in platformOptions" :key="String(option.value)" :label="option.label" :value="String(option.value)" />
          </el-select>
        </el-form-item>
        <el-form-item label="监听状态">
          <div class="enabled-field">
            <el-switch v-model="form.enabled" />
            <span>{{ form.enabled ? '已启用账号与帖子监听' : '已停止新一轮监听调度' }}</span>
          </div>
        </el-form-item>
        <el-form-item class="config-grid__full">
          <template #label>
            <div class="secret-label">
              <span>Apify Token</span>
              <el-tag v-if="tokenConfigured" class="configured-tag" size="small" type="success" effect="light">
                <CheckCircle2 :size="13" />
                <span>已配置</span>
              </el-tag>
            </div>
          </template>
          <el-input v-model="form.api_token" type="password" show-password autocomplete="new-password" placeholder="请输入 Apify API Token" />
        </el-form-item>
      </div>
    </el-form>

    <div class="config-panel__footer">
      <span>{{ updatedAt ? `最近更新：${formatDate(updatedAt)}` : '尚未保存配置' }}</span>
      <div class="config-panel__actions">
        <el-button :icon="PlugZap" :loading="testing" @click="testConnection">测试连接</el-button>
        <el-button type="primary" :icon="Save" :loading="saving" @click="saveConfig">保存配置</el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.config-panel { min-height: 260px; }
.config-panel__heading,
.config-panel__footer,
.config-panel__actions,
.enabled-field,
.secret-label { display: flex; align-items: center; }
.config-panel__heading { justify-content: space-between; gap: 20px; padding-bottom: 14px; border-bottom: 1px solid #e5ebf1; }
.config-panel__heading h2 { color: #203246; font-size: 16px; font-weight: 700; }
.config-panel__heading p { margin-top: 4px; color: #718096; font-size: 12px; }
.config-form { max-width: 880px; padding-top: 18px; }
.config-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, .8fr); gap: 2px 16px; }
.config-grid__full { grid-column: 1 / -1; }
.enabled-field { min-height: 32px; gap: 9px; color: #526273; font-size: 13px; }
.secret-label { width: 100%; gap: 8px; }
.configured-tag { flex: 0 0 auto; white-space: nowrap; }
.configured-tag :deep(.el-tag__content) { display: inline-flex; align-items: center; gap: 4px; line-height: 1; white-space: nowrap; }
.configured-tag :deep(svg) { display: block; flex: 0 0 auto; }
.config-panel__footer { justify-content: space-between; gap: 16px; padding-top: 14px; border-top: 1px solid #e5ebf1; color: #8793a3; font-size: 12px; }
.config-panel__actions { gap: 8px; }
@media (max-width: 720px) {
  .config-grid { grid-template-columns: 1fr; }
  .config-grid__full { grid-column: auto; }
  .config-panel__footer { align-items: flex-end; flex-direction: column; }
}
</style>
