import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

const AppShell = () => import('@/layouts/AppShell.vue')
const AccountCenterView = () => import('@/views/AccountCenterView.vue')
const AccountDataView = () => import('@/views/AccountDataView.vue')
const AccountWarmupView = () => import('@/views/AccountWarmupView.vue')
const BenchmarkSyncRecordsView = () => import('@/views/BenchmarkSyncRecordsView.vue')
const ContentCenterView = () => import('@/views/ContentCenterView.vue')
const CommentReplyReviewView = () => import('@/views/CommentReplyReviewView.vue')
const DashboardView = () => import('@/views/DashboardView.vue')
const DeviceCenterView = () => import('@/views/DeviceCenterView.vue')
const ForbiddenView = () => import('@/views/ForbiddenView.vue')
const LoginView = () => import('@/views/LoginView.vue')
const MediaAssetCenterView = () => import('@/views/MediaAssetCenterView.vue')
const ProxyCenterView = () => import('@/views/ProxyCenterView.vue')
const ReportView = () => import('@/views/ReportView.vue')
const ResourceView = () => import('@/views/ResourceView.vue')
const SystemSettingsView = () => import('@/views/SystemSettingsView.vue')
const TaskRecordsView = () => import('@/views/TaskRecordsView.vue')
const UserManagementView = () => import('@/views/UserManagementView.vue')
const RoleManagementView = () => import('@/views/RoleManagementView.vue')

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView },
    { path: '/forbidden', name: 'forbidden', component: ForbiddenView, meta: { requiresAuth: true } },
    {
      path: '/',
      component: AppShell,
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'dashboard', component: DashboardView, meta: { permission: 'dashboard.view' } },
        { path: 'reports', component: ReportView, meta: { permission: 'reports.view' } },
        { path: 'settings', component: SystemSettingsView, meta: { permission: 'system_settings.view' } },
        { path: 'users', component: UserManagementView, meta: { permission: 'users.view' } },
        { path: 'roles', component: RoleManagementView, meta: { permission: 'roles.view' } },
        { path: 'accounts', component: AccountCenterView, meta: { permission: 'accounts.view' } },
        { path: 'account-data', component: AccountDataView, meta: { permission: 'accounts.view' } },
        { path: 'account-warmup', component: AccountWarmupView, meta: { permission: 'account_warmup.view' } },
        { path: 'benchmark-sync-records', component: BenchmarkSyncRecordsView, meta: { permission: 'monitoring.view' } },
        { path: 'slots', component: DeviceCenterView, meta: { permission: 'devices.view' } },
        { path: 'slot-groups', redirect: { path: '/slots', query: { tab: 'groups' } } },
        { path: 'proxies', component: ProxyCenterView, meta: { permission: 'proxies.view' } },
        { path: 'proxy-groups', redirect: { path: '/proxies', query: { tab: 'groups' } } },
        { path: 'contents', component: ContentCenterView, meta: { permission: 'content.view' } },
        { path: 'content-groups', redirect: { path: '/contents', query: { tab: 'groups' } } },
        { path: 'media-assets', component: MediaAssetCenterView, meta: { permission: 'media.view' } },
        { path: 'media-asset-groups', redirect: { path: '/media-assets', query: { tab: 'groups' } } },
        { path: 'interaction-sessions', component: ResourceView, meta: { resource: 'interactionSessions', permission: 'operations.view' } },
        { path: 'comment-replies', component: CommentReplyReviewView, meta: { permission: 'operations.view' } },
        { path: 'published-contents', component: ResourceView, meta: { resource: 'publishedContents', permission: 'operations.view' } },
        { path: 'content-comments', component: ResourceView, meta: { resource: 'contentComments', permission: 'monitoring.view' } },
        { path: 'scripts', component: ResourceView, meta: { resource: 'scripts', permission: 'scripts.view' } },
        { path: 'task-templates', component: ResourceView, meta: { resource: 'taskTemplates', permission: 'templates.view' } },
        { path: 'tasks', component: TaskRecordsView, meta: { permission: 'tasks.view' } },
        { path: 'runtimes', component: ResourceView, meta: { resource: 'runtimes', permission: 'runtimes.view' } },
        { path: 'operation-logs', component: ResourceView, meta: { resource: 'operationLogs', permission: 'audit.view' } },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.name === 'login' && auth.isAuthenticated) return { name: 'dashboard' }
  if (auth.isAuthenticated && !auth.user) {
    await auth.loadMe().catch(() => {
      auth.clearSession()
      return { name: 'login', query: { redirect: to.fullPath } }
    })
    if (!auth.isAuthenticated) return { name: 'login', query: { redirect: to.fullPath } }
  }
  const permission = typeof to.meta.permission === 'string' ? to.meta.permission : ''
  if (permission && !auth.can(permission)) {
    return { name: 'forbidden', query: { from: to.fullPath } }
  }
})
