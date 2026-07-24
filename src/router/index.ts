import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

const AppShell = () => import('@/layouts/AppShell.vue')
const AccountCenterView = () => import('@/views/AccountCenterView.vue')
const AccountDataView = () => import('@/views/AccountDataView.vue')
const ContentCenterView = () => import('@/views/ContentCenterView.vue')
const CommentReplyReviewView = () => import('@/views/CommentReplyReviewView.vue')
const DashboardView = () => import('@/views/DashboardView.vue')
const DeviceCenterView = () => import('@/views/DeviceCenterView.vue')
const LoginView = () => import('@/views/LoginView.vue')
const MediaAssetCenterView = () => import('@/views/MediaAssetCenterView.vue')
const ProxyCenterView = () => import('@/views/ProxyCenterView.vue')
const ReportView = () => import('@/views/ReportView.vue')
const ResourceView = () => import('@/views/ResourceView.vue')
const SystemSettingsView = () => import('@/views/SystemSettingsView.vue')
const TaskRecordsView = () => import('@/views/TaskRecordsView.vue')

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView },
    {
      path: '/',
      component: AppShell,
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'dashboard', component: DashboardView },
        { path: 'reports', component: ReportView },
        { path: 'settings', component: SystemSettingsView },
        { path: 'accounts', component: AccountCenterView },
        { path: 'account-data', component: AccountDataView },
        { path: 'account-groups', redirect: { path: '/accounts', query: { tab: 'groups' } } },
        { path: 'slots', component: DeviceCenterView },
        { path: 'slot-groups', redirect: { path: '/slots', query: { tab: 'groups' } } },
        { path: 'proxies', component: ProxyCenterView },
        { path: 'proxy-groups', redirect: { path: '/proxies', query: { tab: 'groups' } } },
        { path: 'contents', component: ContentCenterView },
        { path: 'content-groups', redirect: { path: '/contents', query: { tab: 'groups' } } },
        { path: 'media-assets', component: MediaAssetCenterView },
        { path: 'media-asset-groups', redirect: { path: '/media-assets', query: { tab: 'groups' } } },
        { path: 'interaction-sessions', component: ResourceView, meta: { resource: 'interactionSessions' } },
        { path: 'comment-replies', component: CommentReplyReviewView },
        { path: 'published-contents', component: ResourceView, meta: { resource: 'publishedContents' } },
        { path: 'content-comments', component: ResourceView, meta: { resource: 'contentComments' } },
        { path: 'interaction-actions', component: ResourceView, meta: { resource: 'interactionActions' } },
        { path: 'scripts', component: ResourceView, meta: { resource: 'scripts' } },
        { path: 'task-templates', component: ResourceView, meta: { resource: 'taskTemplates' } },
        { path: 'tasks', component: TaskRecordsView },
        { path: 'runtimes', component: ResourceView, meta: { resource: 'runtimes' } },
        { path: 'operation-logs', component: ResourceView, meta: { resource: 'operationLogs' } },
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
})
