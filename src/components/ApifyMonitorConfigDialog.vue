<script setup lang="ts">
import { CheckCircle2, PlugZap, Save, Settings2 } from 'lucide-vue-next'
import { ElNotification } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'

import { http } from '@/api/http'
import { businessPlatformOptions } from '@/config/options'
import type { AnyRecord } from '@/types/api'
import { notifyError } from '@/utils/notify'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})
const platformOptions = businessPlatformOptions.filter((item) => item.value === 'threads')
const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const tokenConfigured = ref(false)
const tokenMasked = ref('')
const updatedAt = ref('')
const form = reactive({
  business_platform: 'threads',
  api_token: '',
  actor_id: 'scrapeengine/threads-search-post-scraper',
  enabled: true,
})

function endpoint(suffix = '') {
  return `/api/interaction-center/content-monitor/provider-config/${encodeURIComponent(form.business_platform)}${suffix}`
}

async function loadConfig() {
  loading.value = true
  try {
    const data = await http.get<AnyRecord>(endpoint())
    form.actor_id = String(data.actor_id || 'scrapeengine/threads-search-post-scraper')
    form.enabled = data.enabled !== false
    form.api_token = ''
    tokenConfigured.value = data.token_configured === true
    tokenMasked.value = String(data.token_masked || '')
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
    const data = await http.post<AnyRecord>(endpoint('/test'), {
      api_token: form.api_token.trim() || null,
      actor_id: form.actor_id.trim(),
    })
    ElNotification.success({
      title: '连接成功',
      message: `Actor ${String(data.actor_name || data.actor_id || form.actor_id)} 可正常访问`,
      duration: 5000,
    })
  } catch (err) {
    notifyError(err, '连接失败', 'Apify 配置不可用')
  } finally {
    testing.value = false
  }
}

async function saveConfig() {
  if (!form.actor_id.trim()) {
    ElNotification.warning({ title: '请检查配置', message: 'Actor 不能为空' })
    return
  }
  if (form.enabled && !form.api_token.trim() && !tokenConfigured.value) {
    ElNotification.warning({ title: '请检查配置', message: '启用监听前需要填写 Apify Token' })
    return
  }
  saving.value = true
  try {
    const data = await http.put<AnyRecord>(endpoint(), {
      api_token: form.api_token.trim() || null,
      actor_id: form.actor_id.trim(),
      enabled: form.enabled,
    })
    tokenConfigured.value = data.token_configured === true
    tokenMasked.value = String(data.token_masked || '')
    updatedAt.value = String(data.updated_at || '')
    form.api_token = ''
    ElNotification.success({ title: '保存成功', message: 'Apify 监听配置已更新' })
  } catch (err) {
    notifyError(err, '保存失败', 'Apify 配置保存失败')
  } finally {
    saving.value = false
  }
}

watch(
  () => props.modelValue,
  (value) => {
    if (value) loadConfig()
  },
)
</script>

<template>
  <el-dialog
    v-model="visible"
    width="min(92vw, 680px)"
    destroy-on-close
    append-to-body
    :close-on-click-modal="false"
  >
    <template #header>
      <div class="config-title">
        <span class="config-title__icon"><Settings2 :size="18" /></span>
        <div>
          <strong>Apify 监听配置</strong>
          <span>服务端帖子监听</span>
        </div>
      </div>
    </template>

    <div v-loading="loading" class="config-body">
      <el-form label-position="top">
        <div class="config-grid">
          <el-form-item label="业务 App">
            <el-select v-model="form.business_platform" disabled class="w-full">
              <el-option
                v-for="option in platformOptions"
                :key="String(option.value)"
                :label="option.label"
                :value="String(option.value)"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="启用状态">
            <div class="enabled-field">
              <el-switch v-model="form.enabled" inline-prompt active-text="启用" inactive-text="停用" />
              <el-tag v-if="tokenConfigured" size="small" type="success" effect="light">
                <CheckCircle2 :size="13" /> Token 已配置
              </el-tag>
            </div>
          </el-form-item>
          <el-form-item label="Apify Token" class="config-grid__full">
            <el-input
              v-model="form.api_token"
              type="password"
              show-password
              autocomplete="new-password"
              :placeholder="tokenConfigured ? `已保存 ${tokenMasked}，留空保持不变` : '请输入 Apify API Token'"
            />
          </el-form-item>
          <el-form-item label="Actor" class="config-grid__full">
            <el-input v-model="form.actor_id" placeholder="username/actor-name" />
          </el-form-item>
        </div>
      </el-form>
    </div>

    <template #footer>
      <div class="config-footer">
        <span class="config-footer__meta">
          {{ updatedAt ? `配置已保存` : '尚未保存配置' }}
        </span>
        <el-space>
          <el-button @click="visible = false">取消</el-button>
          <el-button :icon="PlugZap" :loading="testing" @click="testConnection">测试连接</el-button>
          <el-button type="primary" :icon="Save" :loading="saving" @click="saveConfig">保存配置</el-button>
        </el-space>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.config-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

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
.config-title span {
  display: block;
}

.config-title strong {
  color: #172333;
  font-size: 15px;
}

.config-title div > span {
  margin-top: 2px;
  color: #718096;
  font-size: 12px;
}

.config-body {
  min-height: 230px;
  padding-top: 4px;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2px 16px;
}

.config-grid__full {
  grid-column: 1 / -1;
}

.enabled-field {
  display: flex;
  min-height: 32px;
  align-items: center;
  gap: 12px;
}

.enabled-field :deep(.el-tag) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.config-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.config-footer__meta {
  color: #8793a3;
  font-size: 12px;
}

@media (max-width: 640px) {
  .config-grid {
    grid-template-columns: 1fr;
  }

  .config-grid__full {
    grid-column: auto;
  }

  .config-footer {
    align-items: flex-end;
    flex-direction: column;
  }
}
</style>
