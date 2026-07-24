<script setup lang="ts">
import {
  Boxes,
  BarChart3,
  Activity,
  ClipboardList,
  FileText,
  Gauge,
  History,
  Image,
  LayoutDashboard,
  LogOut,
  MessageSquareReply,
  PlaySquare,
  ScrollText,
  Server,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElNotification } from 'element-plus'

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

const navGroups = [
  {
    label: '工作台',
    index: 'workspace',
    icon: LayoutDashboard,
    children: [
      { label: '总览', to: '/', icon: LayoutDashboard },
      { label: '运营报表', to: '/reports', icon: BarChart3 },
      { label: '系统配置', to: '/settings', icon: Settings },
    ],
  },
  {
    label: '账号中心',
    index: 'account',
    icon: Users,
    children: [
      { label: '账号管理', to: '/accounts', icon: Users },
      { label: '账号数据', to: '/account-data', icon: Activity },
    ],
  },
  {
    label: '设备管理',
    index: 'device',
    icon: Boxes,
    children: [{ label: '设备管理', to: '/slots', icon: Boxes }],
  },
  {
    label: '资源中心',
    index: 'resource',
    icon: ShieldCheck,
    children: [
      { label: '代理资源', to: '/proxies', icon: ShieldCheck },
      { label: '素材库', to: '/media-assets', icon: Image },
    ],
  },
  {
    label: '内容中心',
    index: 'content',
    icon: FileText,
    children: [{ label: '内容库', to: '/contents', icon: FileText }],
  },
  {
    label: '互动中心',
    index: 'interaction',
    icon: ScrollText,
    children: [
      { label: '互动会话', to: '/interaction-sessions', icon: PlaySquare },
      { label: '回复审核', to: '/comment-replies', icon: MessageSquareReply },
      { label: '发布内容', to: '/published-contents', icon: FileText },
      { label: '评论记录', to: '/content-comments', icon: ScrollText },
      { label: '互动动作', to: '/interaction-actions', icon: PlaySquare },
    ],
  },
  {
    label: '任务中心',
    index: 'task',
    icon: ClipboardList,
    children: [
      { label: '脚本管理', to: '/scripts', icon: ScrollText },
      { label: '任务模板', to: '/task-templates', icon: ClipboardList },
      { label: '任务记录', to: '/tasks', icon: PlaySquare },
    ],
  },
  {
    label: '运行监控',
    index: 'runtime',
    icon: Server,
    children: [
      { label: 'Runtime 状态', to: '/runtimes', icon: Server },
      { label: '操作日志', to: '/operation-logs', icon: History },
    ],
  },
]

// 移动端横向导航空间有限，仍然展开成扁平入口便于快速切换。
const mobileNavItems = computed(() => navGroups.flatMap((group) => group.children))
const defaultOpeneds = navGroups.map((group) => group.index)
const userInitial = computed(() => auth.displayName.slice(0, 1).toUpperCase())

async function logout() {
  await auth.logout()
  realtime.disconnect()
  router.push('/login')
}

function handleRealtimeEvent(event: Event) {
  const payload = (event as CustomEvent<RealtimeEventPayload>).detail
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
})

onBeforeUnmount(() => {
  window.removeEventListener(REALTIME_EVENT_NAME, handleRealtimeEvent)
  realtime.disconnect()
})

watch(
  () => auth.token,
  (token) => {
    if (token) realtime.connect()
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
            <el-avatar :size="28">{{ userInitial }}</el-avatar>
            <span class="max-w-40 truncate text-sm text-slate-600">{{ auth.displayName }}</span>
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
    </div>
  </div>
</template>
