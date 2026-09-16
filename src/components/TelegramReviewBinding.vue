<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { ExternalLink, Link2, RefreshCw, Unlink } from 'lucide-vue-next'
import { ElMessageBox, ElNotification } from 'element-plus'
import { http as api } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { notifyError } from '@/utils/notify'
import { formatDate } from '@/utils/format'

interface Binding {
  configured: boolean
  worker_status?: 'ready' | 'unavailable' | 'unknown' | 'unconfigured'
  bot_username: string
  bound: boolean
  telegram_user_id: string | null
  bound_at: string | null
  last_error: string | null
  notify_auto_success: boolean
  notify_auto_failure: boolean
}
const auth = useAuthStore()
const visible = ref(false)
const loading = ref(false)
const binding = ref<Binding | null>(null)
const bindingUrl = ref('')
const expiresAt = ref('')
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
const canBind = computed(() => auth.can('operations.review') && auth.can('operations.view'))
const activeUrl = computed(() => Date.parse(expiresAt.value) > now.value ? bindingUrl.value : '')

async function refresh() {
  if (loading.value) return
  loading.value = true
  try {
    binding.value = await api.get<Binding>('/api/telegram-review/binding')
    if (binding.value.bound) bindingUrl.value = ''
  } catch (error) {
    notifyError(error, '加载失败', '无法读取 TG 绑定状态')
  } finally { loading.value = false }
}

async function open() {
  visible.value = true
  binding.value = null
  bindingUrl.value = ''
  await refresh()
  if (timer) clearInterval(timer)
  if (visible.value) timer = setInterval(() => { now.value = Date.now(); void refresh() }, 5000)
}

async function bind() {
  if (loading.value || !canBind.value || !binding.value?.configured || binding.value.bound) return
  loading.value = true
  bindingUrl.value = ''
  try {
    const result = await api.post<{ url: string; expires_at: string }>('/api/telegram-review/binding-code', {})
    const url = new URL(result.url)
    if (url.protocol !== 'https:' || url.hostname !== 't.me' || url.username || url.password) throw new Error('绑定链接无效')
    bindingUrl.value = result.url
    expiresAt.value = result.expires_at
    now.value = Date.now()
  } catch (error) {
    notifyError(error, '绑定失败', '无法生成 TG 绑定链接')
  } finally { loading.value = false }
}

async function unbind() {
  if (loading.value || !binding.value?.bound) return
  try { await ElMessageBox.confirm('解除后将停止向此 TG 身份推送审核和结果消息，旧审核按钮立即失效。', '解除 TG 绑定', { type: 'warning' }) }
  catch { return }
  loading.value = true
  try {
    await api.delete('/api/telegram-review/binding')
    bindingUrl.value = ''
    ElNotification.success({ title: '已解除 TG 绑定' })
  } catch (error) { notifyError(error, '解绑失败', '无法解除 TG 绑定') }
  finally { loading.value = false }
  await refresh()
}

async function setNotification(key: 'notify_auto_success' | 'notify_auto_failure', value: boolean) {
  if (loading.value || !canBind.value || !binding.value?.bound) return
  loading.value = true
  try {
    binding.value = await api.put<Binding>('/api/telegram-review/notification-settings', {
      notify_auto_success: binding.value.notify_auto_success,
      notify_auto_failure: binding.value.notify_auto_failure,
      [key]: value,
    })
  } catch (error) {
    notifyError(error, '保存失败', '无法保存 TG 通知设置')
  } finally { loading.value = false }
}

function close() {
  if (timer) clearInterval(timer)
  timer = undefined
  bindingUrl.value = ''
  expiresAt.value = ''
}
onBeforeUnmount(close)
</script>

<template>
  <el-button :icon="Link2" @click="open">TG 审核</el-button>
  <el-dialog v-model="visible" title="TG 审核绑定" width="min(480px, 94vw)" append-to-body @closed="close">
    <div v-loading="loading" class="telegram-binding">
      <el-alert v-if="binding && !binding.configured" title="尚未配置审核机器人，请联系管理员" type="warning" :closable="false" />
      <el-descriptions v-if="binding" :column="1" border>
        <el-descriptions-item label="机器人">{{ binding.bot_username ? `@${binding.bot_username}` : '-' }}</el-descriptions-item>
        <el-descriptions-item label="绑定状态"><el-tag :type="binding.bound ? 'success' : 'info'">{{ binding.bound ? '已绑定' : '未绑定' }}</el-tag></el-descriptions-item>
        <el-descriptions-item label="通知服务"><el-tag :type="binding.worker_status === 'ready' ? 'success' : 'warning'">{{ binding.worker_status === 'ready' ? '已就绪' : binding.worker_status === 'unavailable' ? '未就绪' : binding.worker_status === 'unconfigured' ? '未配置' : '状态未知' }}</el-tag></el-descriptions-item>
        <el-descriptions-item v-if="binding.bound" label="TG 用户 ID">{{ binding.telegram_user_id }}</el-descriptions-item>
        <el-descriptions-item v-if="binding.bound" label="绑定时间">{{ formatDate(binding.bound_at) }}</el-descriptions-item>
      </el-descriptions>
      <el-form v-if="binding?.bound" label-position="left" label-width="180px">
        <el-form-item label="自动回复成功通知">
          <el-switch :model-value="binding.notify_auto_success" :disabled="loading || !canBind" aria-label="自动回复成功通知" @change="value => setNotification('notify_auto_success', Boolean(value))" />
        </el-form-item>
        <el-form-item label="自动回复失败通知">
          <el-switch :model-value="binding.notify_auto_failure" :disabled="loading || !canBind" aria-label="自动回复失败通知" @change="value => setNotification('notify_auto_failure', Boolean(value))" />
        </el-form-item>
      </el-form>
      <el-alert v-if="binding?.last_error" :title="binding.last_error" type="warning" :closable="false" />
      <div v-if="activeUrl" class="telegram-binding__link">
        <a :href="activeUrl" target="_blank" rel="noopener noreferrer"><ExternalLink :size="16" />打开 TG 完成绑定</a>
        <span>有效期至 {{ formatDate(expiresAt) }}</span>
      </div>
    </div>
    <template #footer>
      <el-tooltip content="刷新绑定状态"><el-button :icon="RefreshCw" circle :loading="loading" @click="refresh" /></el-tooltip>
      <el-button v-if="binding?.bound" type="danger" plain :icon="Unlink" :disabled="loading" @click="unbind">解除绑定</el-button>
      <el-button v-else type="primary" :icon="Link2" :disabled="!canBind || !binding?.configured || loading" @click="bind">{{ activeUrl ? '重新生成链接' : '绑定 TG' }}</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.telegram-binding { min-height: 130px; display: grid; gap: 16px; }
.telegram-binding__link { display: grid; gap: 8px; font-size: 13px; }
.telegram-binding__link a { display: inline-flex; align-items: center; gap: 6px; color: var(--el-color-primary); }
.telegram-binding__link span { color: var(--el-text-color-secondary); }
.telegram-binding :deep(.el-descriptions__content) { overflow-wrap: anywhere; }
</style>
