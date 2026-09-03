<script setup lang="ts">
import {
  Boxes,
  BarChart3,
  Bell,
  CheckCheck,
  Activity,
  ClipboardList,
  Database,
  FileText,
  Gauge,
  History,
  Image,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquareReply,
  PlaySquare,
  ScrollText,
  Server,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElNotification } from 'element-plus'

import { changeCurrentPassword } from '@/api/rbac'
import {
  getSystemNotificationUnreadCount,
  listSystemNotifications,
  markAllSystemNotificationsRead,
  markSystemNotificationRead,
  type SystemNotification,
} from '@/api/systemNotifications'
import {
  REALTIME_EVENT_NAME,
  useRealtimeEvents,
  type RealtimeEventPayload,
} from '@/composables/useRealtimeEvents'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const realtime = useRealtimeEvents()

const notificationPopoverVisible = ref(false)
const notificationDialogVisible = ref(false)
const notificationLoading = ref(false)
const unreadNotificationCount = ref(0)
const systemNotifications = ref<SystemNotification[]>([])
const activeNotification = ref<SystemNotification | null>(null)
const passwordDialogVisible = ref(false)
const passwordForm = reactive({ old_password: '', new_password: '', confirm_password: '' })

const rawNavGroups = [
  {
    label: '工作台',
    index: 'workspace',
    icon: LayoutDashboard,
    children: [
      { label: '总览', to: '/', icon: LayoutDashboard, permission: 'dashboard.view' },
      { label: '运营报表', to: '/reports', icon: BarChart3, permission: 'reports.view' },
    ],
  },
  {
    label: '账号中心',
    index: 'account',
    icon: Users,
    children: [
      { label: '账号管理', to: '/accounts', icon: Users, permission: 'accounts.view' },
      { label: '账号数据', to: '/account-data', icon: Activity, permission: 'accounts.view' },

    ],
  },
  {
    label: '设备中心',
    index: 'device',
    icon: Boxes,
    children: [{ label: '设备管理', to: '/slots', icon: Boxes, permission: 'devices.view' }],
  },
  {
    label: '资源中心',
    index: 'resource',
    icon: ShieldCheck,
    children: [
      { label: '代理资源', to: '/proxies', icon: ShieldCheck, permission: 'proxies.view' },
      { label: '注册资源', to: '/registration-resources', icon: Database, permission: 'registration_resources.view' },
    ],
  },
  {
    label: '内容中心',
    index: 'content',
    icon: FileText,
    children: [
      { label: '内容库', to: '/contents', icon: FileText, permission: 'content.view' },
      { label: '素材库', to: '/media-assets', icon: Image, permission: 'media.view' },
    ],
  },
  {
    label: '运营中心',
    index: 'interaction',
    icon: ScrollText,
    children: [
      { label: '互动会话', to: '/interaction-sessions', icon: PlaySquare, permission: 'operations.view' },
      { label: '回复审核', to: '/comment-replies', icon: MessageSquareReply, permission: 'operations.view' },
      { label: '发布内容', to: '/published-contents', icon: FileText, permission: 'operations.view' },
      { label: '账号养号', to: '/account-warmup', icon: Activity, permission: 'account_warmup.view' },
    ],
  },
  {
    label: '任务中心',
    index: 'task',
    icon: ClipboardList,
    children: [
      { label: '脚本管理', to: '/scripts', icon: ScrollText, permission: 'scripts.view' },
      { label: '任务模板', to: '/task-templates', icon: ClipboardList, permission: 'templates.view' },
      { label: '任务记录', to: '/tasks', icon: PlaySquare, permission: 'tasks.view' },
    ],
  },
  {
    label: '系统管理',
    index: 'system',
    icon: Settings,
    children: [
      { label: '用户管理', to: '/users', icon: Users, permission: 'users.view' },
      { label: '角色管理', to: '/roles', icon: ShieldCheck, permission: 'roles.view' },
      { label: '系统配置', to: '/settings', icon: Settings, permission: 'system_settings.view' },
    ],
  },
  {
    label: '运行监控',
    index: 'runtime',
    icon: Server,
    children: [
      { label: 'Runtime 状态', to: '/runtimes', icon: Server, permission: 'runtimes.view' },
      { label: '采集同步日志', to: '/benchmark-sync-records', icon: History, permission: 'monitoring.view' },
      { label: '评论数据日志', to: '/content-comments', icon: ScrollText, permission: 'monitoring.view' },
      { label: '事件统计', to: '/event-statistics', icon: BarChart3, permission: 'event_statistics.view' },
      { label: '操作日志', to: '/operation-logs', icon: History, permission: 'audit.view' },
    ],
  },
]

// 移动端横向导航空间有限，仍然展开成扁平入口便于快速切换。
const navGroups = computed(() => rawNavGroups
  .map((group) => ({ ...group, children: group.children.filter((item) => auth.can(item.permission)) }))
  .filter((group) => group.children.length > 0))
const mobileNavItems = computed(() => navGroups.value.flatMap((group) => group.children))
const defaultCollapsedGroups = new Set(['runtime', 'system'])
const defaultOpeneds = computed(() => navGroups.value
  .filter((group) => (
    !defaultCollapsedGroups.has(group.index)
    || group.children.some((item) => route.path === item.to || route.path.startsWith(`${item.to}/`))
  ))
  .map((group) => group.index))
const userInitial = computed(() => auth.displayName.slice(0, 1).toUpperCase())

function formatNotificationTime(value: string) {
  if (!value) return '-'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

async function loadNotificationUnreadCount() {
  if (!auth.token || !auth.can('notifications.view')) return
  try {
    const data = await getSystemNotificationUnreadCount()
    unreadNotificationCount.value = data.unread_count
  } catch {
    // 顶部通知加载失败不阻断其他后台操作，用户下次打开时会再次获取。
  }
}

async function loadSystemNotifications() {
  if (!auth.token || !auth.can('notifications.view') || notificationLoading.value) return
  notificationLoading.value = true
  try {
    const [data, unread] = await Promise.all([
      listSystemNotifications(),
      getSystemNotificationUnreadCount(),
    ])
    systemNotifications.value = data.items
    unreadNotificationCount.value = unread.unread_count
  } catch {
    // 通知加载失败不阻断后台操作，用户下次打开时会重新获取。
  } finally {
    notificationLoading.value = false
  }
}

async function showNotificationDetail(notification: SystemNotification) {
  activeNotification.value = notification
  notificationDialogVisible.value = true
  notificationPopoverVisible.value = false
  if (notification.is_read || !auth.can('notifications.manage')) return
  try {
    await markSystemNotificationRead(notification.id)
    notification.is_read = true
    unreadNotificationCount.value = Math.max(0, unreadNotificationCount.value - 1)
  } catch {
    // 详情仍可正常阅读，已读状态会在下次请求时重新同步。
  }
}

async function markAllNotificationsRead() {
  if (unreadNotificationCount.value <= 0 || !auth.can('notifications.manage')) return
  try {
    await markAllSystemNotificationsRead()
    systemNotifications.value.forEach((item) => {
      item.is_read = true
    })
    unreadNotificationCount.value = 0
  } catch {
    ElNotification.error({
      title: '操作失败',
      message: '系统通知状态更新失败，请稍后重试。',
    })
  }
}

function handleNotificationPopoverShow() {
  void loadSystemNotifications()
}

async function logout() {
  await auth.logout()
  realtime.disconnect()
  router.push('/login')
}

function openPasswordDialog() {
  passwordForm.old_password = ''
  passwordForm.new_password = ''
  passwordForm.confirm_password = ''
  passwordDialogVisible.value = true
}

async function submitPasswordChange() {
  if (passwordForm.new_password.length < 8 || !/[A-Za-z]/.test(passwordForm.new_password) || !/\d/.test(passwordForm.new_password)) {
    ElMessage.warning('新密码至少 8 位，且必须同时包含字母和数字')
    return
  }
  if (passwordForm.new_password !== passwordForm.confirm_password) {
    ElMessage.warning('两次输入的新密码不一致')
    return
  }
  try {
    await changeCurrentPassword({
      old_password: passwordForm.old_password,
      new_password: passwordForm.new_password,
    })
    ElMessage.success('密码已修改，请重新登录')
    passwordDialogVisible.value = false
    await logout()
  } catch (error) {
    ElNotification.error({ title: '修改密码失败', message: error instanceof Error ? error.message : '请稍后重试' })
  }
}

function handleRealtimeEvent(event: Event) {
  const payload = (event as CustomEvent<RealtimeEventPayload>).detail
  if (payload?.type === 'realtime.connected') {
    void loadNotificationUnreadCount()
    return
  }
  if (payload?.topic === 'system_notification' && !auth.can('notifications.view')) return
  if (payload?.topic === 'system_notification') {
    void loadSystemNotifications()
    const data = payload.data && typeof payload.data === 'object'
      ? payload.data as Record<string, unknown>
      : {}
    const releaseNotification = ElNotification({
      title: String(data.title || '系统版本已更新'),
      message: Array.isArray(data.items) && data.items.length
        ? String(data.items[0])
        : '点击查看本次版本更新内容。',
      type: 'success',
      duration: 10000,
      onClick: () => {
        notificationPopoverVisible.value = true
        releaseNotification.close()
      },
    })
    return
  }
  if (payload?.topic === 'comment_reply') {
    const data = payload.data && typeof payload.data === 'object'
      ? payload.data as Record<string, unknown>
      : {}
    const status = String(data.status || '')
    if (!['pending_review', 'failed', 'blocked'].includes(status)) return
    const needsReview = status === 'pending_review'
    const notification = ElNotification({
      title: needsReview ? '有新的评论回复待审核' : '评论回复处理异常',
      message: needsReview ? 'AI 文案已经生成，请确认或修改后下发。' : String(data.error_message || '回复任务暂时无法继续，请查看处理。'),
      type: needsReview ? 'warning' : 'error',
      duration: needsReview ? 8000 : 0,
      onClick: () => {
        router.push('/comment-replies')
        notification.close()
      },
    })
    return
  }
  if (!['content_monitor.abnormal', 'account_content_monitor.abnormal'].includes(String(payload?.type || ''))) return
  const data = payload.data && typeof payload.data === 'object'
    ? payload.data as Record<string, unknown>
    : {}
  const isAccountMonitor = payload.type === 'account_content_monitor.abnormal'
  const notification = ElNotification({
    title: isAccountMonitor ? '账号监听异常' : '帖子监听异常',
    message: String(data.message || '内容监听连续失败，已自动停止。'),
    type: 'error',
    duration: 0,
    onClick: () => {
      router.push(isAccountMonitor ? '/account-data' : '/published-contents')
      notification.close()
    },
  })
}

onMounted(() => {
  window.addEventListener(REALTIME_EVENT_NAME, handleRealtimeEvent)
  realtime.connect()
  void loadNotificationUnreadCount()
})

onBeforeUnmount(() => {
  window.removeEventListener(REALTIME_EVENT_NAME, handleRealtimeEvent)
  realtime.disconnect()
})

watch(
  () => auth.token,
  (token) => {
    if (token) {
      realtime.connect()
      void loadNotificationUnreadCount()
    }
    else realtime.disconnect()
  },
)
</script>

<template>
  <div class="app-shell min-h-screen bg-paper">
    <aside class="fixed inset-y-0 left-0 hidden w-60 border-r border-line bg-white lg:flex lg:flex-col">
      <div class="flex h-16 items-center gap-2 border-b border-line px-5">
        <Gauge class="h-6 w-6 text-brand-600" />
        <div>
          <div class="text-sm font-semibold text-ink">社媒聚合云控系统</div>
        </div>
      </div>
      <el-scrollbar class="flex-1">
        <el-menu router :default-active="route.path" :default-openeds="defaultOpeneds" class="app-menu">
          <el-sub-menu v-for="group in navGroups" :key="group.index" :index="group.index">
            <template #title>
              <component :is="group.icon" class="mr-3 h-4 w-4" />
              <span>{{ group.label }}</span>
            </template>
            <el-menu-item v-for="item in group.children" :key="item.to" :index="item.to">
              <component :is="item.icon" class="mr-3 h-4 w-4" />
              <span>{{ item.label }}</span>
            </el-menu-item>
          </el-sub-menu>
        </el-menu>
      </el-scrollbar>
    </aside>

    <div class="lg:pl-60">
      <header class="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div class="flex h-16 items-center justify-between gap-3 px-4 lg:px-6">
          <div class="flex min-w-0 items-center gap-3 lg:hidden">
            <Gauge class="h-5 w-5 text-brand-600" />
            <span class="truncate text-sm font-semibold text-ink">社媒聚合云控系统</span>
          </div>
          <div class="hidden text-sm text-slate-500 lg:block">运营管理工作台</div>
          <div class="flex items-center gap-3">
            <el-popover
              v-if="auth.can('notifications.view')"
              v-model:visible="notificationPopoverVisible"
              placement="bottom-end"
              :width="400"
              trigger="click"
              @show="handleNotificationPopoverShow"
            >
              <template #reference>
                <el-badge
                  :value="unreadNotificationCount > 99 ? '99+' : unreadNotificationCount"
                  :hidden="unreadNotificationCount === 0"
                  :max="99"
                >
                  <el-tooltip content="系统通知" placement="bottom">
                    <el-button circle aria-label="系统通知">
                      <Bell class="h-4 w-4" />
                    </el-button>
                  </el-tooltip>
                </el-badge>
              </template>
              <div class="overflow-hidden">
                <div class="flex items-center justify-between border-b border-slate-200 px-1 pb-3">
                  <div class="flex items-center gap-2">
                    <Megaphone class="h-4 w-4 text-brand-600" />
                    <strong class="text-sm text-slate-800">系统通知</strong>
                  </div>
                  <el-button v-if="unreadNotificationCount > 0 && auth.can('notifications.manage')" text size="small" :icon="CheckCheck" @click="markAllNotificationsRead">
                    全部已读
                  </el-button>
                </div>
                <div v-loading="notificationLoading" class="max-h-96 overflow-y-auto py-2">
                  <el-empty
                    v-if="!notificationLoading && systemNotifications.length === 0"
                    description="暂无系统通知"
                    :image-size="64"
                  />
                  <button
                    v-for="notification in systemNotifications"
                    :key="notification.id"
                    type="button"
                    class="flex w-full gap-3 border-b border-slate-100 px-2 py-3 text-left transition-colors last:border-0 hover:bg-slate-50"
                    @click="showNotificationDetail(notification)"
                  >
                    <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full" :class="notification.is_read ? 'bg-slate-300' : 'bg-brand-600'" />
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-sm font-semibold text-slate-800">{{ notification.title }}</span>
                      <span class="mt-1 block truncate text-xs text-slate-500">{{ notification.items[0] || '系统功能与稳定性更新' }}</span>
                      <span class="mt-1.5 block text-xs text-slate-400">{{ formatNotificationTime(notification.published_at) }}</span>
                    </span>
                  </button>
                </div>
              </div>
            </el-popover>
            <el-avatar :size="28">{{ userInitial }}</el-avatar>
            <span class="max-w-40 truncate text-sm text-slate-600">{{ auth.displayName }}</span>
            <el-tooltip content="修改密码" placement="bottom">
              <el-button circle :icon="KeyRound" @click="openPasswordDialog" />
            </el-tooltip>
            <el-tooltip content="退出登录" placement="bottom">
              <el-button circle :icon="LogOut" @click="logout" />
            </el-tooltip>
          </div>
        </div>
        <el-scrollbar class="border-t border-line px-3 py-2 lg:hidden">
          <div class="flex gap-1">
            <RouterLink
              v-for="item in mobileNavItems"
              :key="`mobile-${item.to}`"
              :to="item.to"
              class="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-slate-600"
              active-class="bg-brand-50 text-brand-700"
            >
              <component :is="item.icon" class="h-4 w-4" />
              <span>{{ item.label }}</span>
            </RouterLink>
          </div>
        </el-scrollbar>
      </header>

      <main class="px-4 py-5 lg:px-6">
        <RouterView />
      </main>

      <el-dialog
        v-model="notificationDialogVisible"
        :title="activeNotification?.title || '系统通知'"
        width="min(620px, 92vw)"
        destroy-on-close
      >
        <div v-if="activeNotification" class="space-y-5">
          <div class="flex flex-wrap items-center gap-2">
            <el-tag effect="plain">{{ activeNotification.version }}</el-tag>
            <span class="text-sm text-slate-500">{{ formatNotificationTime(activeNotification.published_at) }}</span>
          </div>
          <div>
            <div class="mb-3 text-sm font-semibold text-slate-800">本次更新</div>
            <ul class="space-y-3">
              <li v-for="(item, index) in activeNotification.items" :key="index" class="flex gap-3 rounded-md bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />
                <span>{{ item }}</span>
              </li>
            </ul>
          </div>
        </div>
        <template #footer>
          <el-button type="primary" @click="notificationDialogVisible = false">我知道了</el-button>
        </template>
      </el-dialog>

      <el-dialog v-model="passwordDialogVisible" title="修改登录密码" width="460px" destroy-on-close>
        <el-form label-position="top">
          <el-form-item label="当前密码" required>
            <el-input v-model="passwordForm.old_password" type="password" show-password autocomplete="current-password" />
          </el-form-item>
          <el-form-item label="新密码" required>
            <el-input v-model="passwordForm.new_password" type="password" show-password autocomplete="new-password" placeholder="至少 8 位，包含字母和数字" />
          </el-form-item>
          <el-form-item label="确认新密码" required>
            <el-input v-model="passwordForm.confirm_password" type="password" show-password autocomplete="new-password" @keyup.enter="submitPasswordChange" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="passwordDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitPasswordChange">确认修改</el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>
