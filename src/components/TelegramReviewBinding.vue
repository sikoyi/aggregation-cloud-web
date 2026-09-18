<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ExternalLink, Link2, RefreshCw, Search, Send, Unlink } from 'lucide-vue-next'
import { ElMessageBox, ElNotification } from 'element-plus'
import { http as api } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { notifyError } from '@/utils/notify'
import { formatDate } from '@/utils/format'
import type { PageResult } from '@/types/api'

interface Binding {
  configured: boolean
  worker_status?: 'ready' | 'unavailable' | 'unknown' | 'unconfigured'
  bot_username: string
  bound: boolean
  telegram_user_id: string | null
  bound_at: string | null
  last_error: string | null
  next_retry_at?: string | null
  notify_auto_success: boolean
  notify_auto_failure: boolean
}

interface BindingUser {
  user_id: string
  username: string
  display_name: string
  user_status: string
  telegram_user_id: string
  bound_at: string | null
  notify_auto_success: boolean
  notify_auto_failure: boolean
  last_error: string | null
  next_retry_at: string | null
}

const auth = useAuthStore()
const visible = ref(false)
const loading = ref(false)
const binding = ref<Binding | null>(null)
const bindingUrl = ref('')
const expiresAt = ref('')
const now = ref(Date.now())
const activeTab = ref<'mine' | 'users'>('mine')
const userLoading = ref(false)
const boundUsers = ref<BindingUser[]>([])
const userKeyword = ref('')
const userPage = ref(1)
const userPageSize = ref(20)
const userTotal = ref(0)
let timer: ReturnType<typeof setInterval> | undefined
const canBind = computed(() => auth.can('operations.review') && auth.can('operations.view'))
const isSuperAdmin = computed(() => auth.isSuperAdmin)
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
  activeTab.value = 'mine'
  binding.value = null
  bindingUrl.value = ''
  await refresh()
  if (timer) clearInterval(timer)
  if (visible.value) timer = setInterval(() => { now.value = Date.now(); void refresh() }, 5000)
}

async function loadBoundUsers() {
  if (!isSuperAdmin.value || userLoading.value) return
  userLoading.value = true
  try {
    const result = await api.get<PageResult<BindingUser>>('/api/telegram-review/bindings', {
      keyword: userKeyword.value.trim() || undefined,
      page: userPage.value,
      page_size: userPageSize.value,
    })
    boundUsers.value = result.items
    userTotal.value = result.total
  } catch (error) {
    notifyError(error, '加载失败', '无法读取 TG 绑定用户')
  } finally { userLoading.value = false }
}

function searchBoundUsers() {
  userPage.value = 1
  void loadBoundUsers()
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
watch(activeTab, (tab) => {
  if (tab === 'users') void loadBoundUsers()
})
onBeforeUnmount(close)
</script>

<template>
  <el-tooltip content="TG 审核" placement="bottom">
    <el-button circle :icon="Send" aria-label="TG 审核" @click="open" />
  </el-tooltip>
  <el-dialog
    v-model="visible"
    title="TG 审核"
    :width="isSuperAdmin ? 'min(900px, 96vw)' : 'min(480px, 94vw)'"
    append-to-body
    @closed="close"
  >
    <el-tabs v-if="isSuperAdmin" v-model="activeTab" class="telegram-binding__tabs">
      <el-tab-pane label="我的绑定" name="mine" />
      <el-tab-pane label="绑定用户" name="users" />
    </el-tabs>

    <div v-show="activeTab === 'mine'" v-loading="loading" class="telegram-binding">
      <el-alert v-if="binding && !binding.configured" title="尚未配置审核机器人，请联系管理员" type="warning" :closable="false" />
      <el-descriptions v-if="binding" :column="1" border>
        <el-descriptions-item label="机器人">{{ binding.bot_username ? `@${binding.bot_username}` : '-' }}</el-descriptions-item>
        <el-descriptions-item label="绑定状态"><el-tag :type="binding.bound ? 'success' : 'info'">{{ binding.bound ? '已绑定' : '未绑定' }}</el-tag></el-descriptions-item>
        <el-descriptions-item label="通知服务"><el-tag :type="binding.worker_status === 'ready' ? 'success' : 'warning'">{{ binding.worker_status === 'ready' ? '已就绪' : binding.worker_status === 'unavailable' ? '未就绪' : binding.worker_status === 'unconfigured' ? '未配置' : '状态未知' }}</el-tag></el-descriptions-item>
        <el-descriptions-item v-if="binding.bound" label="TG 用户 ID">{{ binding.telegram_user_id }}</el-descriptions-item>
        <el-descriptions-item v-if="binding.bound" label="绑定时间">{{ formatDate(binding.bound_at) }}</el-descriptions-item>
        <el-descriptions-item v-if="binding.next_retry_at" label="下次重试检查">{{ formatDate(binding.next_retry_at) }}</el-descriptions-item>
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
    <div v-if="isSuperAdmin" v-show="activeTab === 'users'" v-loading="userLoading" class="telegram-users">
      <div class="telegram-users__toolbar">
        <el-input
          v-model="userKeyword"
          clearable
          :prefix-icon="Search"
          placeholder="搜索系统用户或 TG 用户 ID"
          @keyup.enter="searchBoundUsers"
          @clear="searchBoundUsers"
        />
        <el-button type="primary" :icon="Search" @click="searchBoundUsers">查询</el-button>
      </div>
      <el-table :data="boundUsers" border empty-text="暂无已绑定用户" class="telegram-users__table">
        <el-table-column label="系统用户" min-width="180">
          <template #default="{ row }">
            <div class="telegram-users__identity">
              <strong>{{ row.display_name || row.username }}</strong>
              <span>@{{ row.username }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="telegram_user_id" label="TG 用户 ID" min-width="150" />
        <el-table-column label="账号状态" width="96" align="center">
          <template #default="{ row }">
            <el-tag :type="row.user_status === 'active' ? 'success' : 'info'" size="small">
              {{ row.user_status === 'active' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="结果通知" min-width="150" align="center">
          <template #default="{ row }">
            <div class="telegram-users__notices">
              <el-tag :type="row.notify_auto_success ? 'success' : 'info'" size="small">成功{{ row.notify_auto_success ? '开' : '关' }}</el-tag>
              <el-tag :type="row.notify_auto_failure ? 'danger' : 'info'" size="small">失败{{ row.notify_auto_failure ? '开' : '关' }}</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="绑定时间" min-width="165">
          <template #default="{ row }">{{ formatDate(row.bound_at) }}</template>
        </el-table-column>
        <el-table-column label="通知状态" min-width="150">
          <template #default="{ row }">
            <el-tooltip
              v-if="row.last_error"
              :content="row.next_retry_at ? `${row.last_error}；下次重试 ${formatDate(row.next_retry_at)}` : row.last_error"
              placement="top"
            >
              <el-tag type="warning" size="small">等待重试</el-tag>
            </el-tooltip>
            <span v-else class="telegram-users__healthy">正常</span>
          </template>
        </el-table-column>
      </el-table>
      <div class="telegram-users__pagination">
        <span>共 {{ userTotal }} 人</span>
        <el-pagination
          v-model:current-page="userPage"
          v-model:page-size="userPageSize"
          layout="prev, pager, next"
          :total="userTotal"
          @current-change="loadBoundUsers"
        />
      </div>
    </div>
    <template #footer>
      <template v-if="activeTab === 'mine'">
        <el-tooltip content="刷新绑定状态"><el-button :icon="RefreshCw" circle :loading="loading" @click="refresh" /></el-tooltip>
        <el-button v-if="binding?.bound" type="danger" plain :icon="Unlink" :disabled="loading" @click="unbind">解除绑定</el-button>
        <el-button v-else type="primary" :icon="Link2" :disabled="!canBind || !binding?.configured || loading" @click="bind">{{ activeUrl ? '重新生成链接' : '绑定 TG' }}</el-button>
      </template>
      <el-button v-else :icon="RefreshCw" :loading="userLoading" @click="loadBoundUsers">刷新列表</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.telegram-binding { min-height: 130px; display: grid; gap: 16px; }
.telegram-binding__tabs { margin-top: -12px; }
.telegram-binding__link { display: grid; gap: 8px; font-size: 13px; }
.telegram-binding__link a { display: inline-flex; align-items: center; gap: 6px; color: var(--el-color-primary); }
.telegram-binding__link span { color: var(--el-text-color-secondary); }
.telegram-binding :deep(.el-descriptions__content) { overflow-wrap: anywhere; }
.telegram-users { min-height: 280px; display: grid; align-content: start; gap: 14px; }
.telegram-users__toolbar { display: flex; gap: 10px; max-width: 480px; }
.telegram-users__table { width: 100%; }
.telegram-users__identity { display: grid; gap: 3px; min-width: 0; }
.telegram-users__identity strong,
.telegram-users__identity span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.telegram-users__identity span { color: var(--el-text-color-secondary); font-size: 12px; }
.telegram-users__notices { display: flex; justify-content: center; gap: 6px; }
.telegram-users__healthy { color: var(--el-color-success); }
.telegram-users__pagination { display: flex; align-items: center; justify-content: flex-end; gap: 12px; color: var(--el-text-color-secondary); font-size: 13px; }
@media (max-width: 640px) {
  .telegram-users__toolbar { max-width: none; }
  .telegram-users__table { overflow-x: auto; }
  .telegram-users__pagination { justify-content: space-between; }
}
</style>
