import { createRouter, createWebHistory } from 'vue-router'

import AppShell from '@/layouts/AppShell.vue'
import { useAuthStore } from '@/stores/auth'
import DashboardView from '@/views/DashboardView.vue'
import LoginView from '@/views/LoginView.vue'
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
        { path: 'accounts', component: ResourceView, meta: { resource: 'accounts' } },
        { path: 'account-groups', component: ResourceView, meta: { resource: 'accountGroups' } },
        { path: 'slots', component: ResourceView, meta: { resource: 'slots' } },
        { path: 'slot-groups', component: ResourceView, meta: { resource: 'slotGroups' } },
        { path: 'proxies', component: ResourceView, meta: { resource: 'proxies' } },
        { path: 'proxy-groups', component: ResourceView, meta: { resource: 'proxyGroups' } },
        { path: 'contents', component: ResourceView, meta: { resource: 'contents' } },
        { path: 'media-assets', component: ResourceView, meta: { resource: 'mediaAssets' } },
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
