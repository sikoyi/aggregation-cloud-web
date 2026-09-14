import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { businessPlatformOptions, filterOptionsByScope } from '@/config/options'

export const accountDataRoute: RouteRecordRaw = {
  path: 'account-data',
  component: () => import('@/views/AccountDataLayout.vue'),
  meta: { permission: 'accounts.view' },
  children: [
    {
      path: '',
      redirect: to => {
        const { view, ...query } = to.query
        const section = view === 'external' || view === 'shopify' ? view : 'social'
        return { name: `account-data-${section}`, query, hash: to.hash }
      },
    },
    { path: 'social', name: 'account-data-social', component: () => import('@/views/AccountDataView.vue') },
    {
      path: 'external', name: 'account-data-external', component: () => import('@/components/ExternalAccountMonitors.vue'),
      beforeEnter: to => useAuthStore().can('operations.view') || { name: 'forbidden', query: { from: to.fullPath } },
    },
    {
      path: 'shopify', name: 'account-data-shopify', component: () => import('@/components/ShopifyStoreMonitors.vue'),
      beforeEnter: to => filterOptionsByScope(businessPlatformOptions, useAuthStore().user?.business_platform_scope)
        .some(option => option.value === 'shopify') || { name: 'forbidden', query: { from: to.fullPath } },
    },
  ],
}
