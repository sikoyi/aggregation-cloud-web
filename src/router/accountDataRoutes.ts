import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

export const accountDataRoute: RouteRecordRaw = {
  path: 'account-data',
  component: () => import('@/views/AccountDataLayout.vue'),
  meta: { permission: 'accounts.view' },
  children: [
    {
      path: '',
      redirect: to => {
        const { view, ...query } = to.query
        const section = view === 'external' ? view : 'social'
        return { name: `account-data-${section}`, query, hash: to.hash }
      },
    },
    { path: 'social', name: 'account-data-social', component: () => import('@/views/AccountDataView.vue') },
    {
      path: 'external', name: 'account-data-external', component: () => import('@/components/ExternalAccountMonitors.vue'),
      beforeEnter: to => useAuthStore().can('operations.view') || { name: 'forbidden', query: { from: to.fullPath } },
    },
  ],
}
