import { createRouter, createWebHistory } from 'vue-router'

import AppShell from '@/layouts/AppShell.vue'
import { useAuthStore } from '@/stores/auth'
import AccountCenterView from '@/views/AccountCenterView.vue'
import ContentCenterView from '@/views/ContentCenterView.vue'
import DashboardView from '@/views/DashboardView.vue'
import DeviceCenterView from '@/views/DeviceCenterView.vue'
import LoginView from '@/views/LoginView.vue'
import ProxyCenterView from '@/views/ProxyCenterView.vue'
import ResourceView from '@/views/ResourceView.vue'

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
        { path: 'accounts', component: AccountCenterView },
        { path: 'account-groups', redirect: { path: '/accounts', query: { tab: 'groups' } } },
        { path: 'slots', component: DeviceCenterView },
        { path: 'slot-groups', redirect: { path: '/slots', query: { tab: 'groups' } } },
        { path: 'proxies', component: ProxyCenterView },
        { path: 'proxy-groups', redirect: { path: '/proxies', query: { tab: 'groups' } } },
        { path: 'contents', component: ContentCenterView },
        { path: 'content-groups', redirect: { path: '/contents', query: { tab: 'groups' } } },
        { path: 'media-assets', component: ResourceView, meta: { resource: 'mediaAssets' } },
        { path: 'interaction-sessions', component: ResourceView, meta: { resource: 'interactionSessions' } },
        { path: 'published-contents', component: ResourceView, meta: { resource: 'publishedContents' } },
        { path: 'content-comments', component: ResourceView, meta: { resource: 'contentComments' } },
        { path: 'interaction-actions', component: ResourceView, meta: { resource: 'interactionActions' } },
        { path: 'scripts', component: ResourceView, meta: { resource: 'scripts' } },
        { path: 'task-templates', component: ResourceView, meta: { resource: 'taskTemplates' } },
        { path: 'tasks', component: ResourceView, meta: { resource: 'tasks' } },
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
