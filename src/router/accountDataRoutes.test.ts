import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'
import { accountDataRoute } from './accountDataRoutes'
import layout from '../views/AccountDataLayout.vue?raw'
import shell from '../layouts/AppShell.vue?raw'

const auth = vi.hoisted(() => ({ can: vi.fn(() => true), user: { business_platform_scope: null as string[] | null } }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => auth }))

function setup() {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { ...accountDataRoute, path: '/account-data', component: {}, children: accountDataRoute.children!.map(child => ({ ...child, component: {} })) } as RouteRecordRaw,
    { path: '/forbidden', name: 'forbidden', component: {} },
  ] })
  return router
}

beforeEach(() => { auth.can.mockReturnValue(true); auth.user.business_platform_scope = null })
describe('账号数据子路由', () => {
  it('三个页面均可直接访问，重新创建路由仍停留原页面', async () => {
    for (const section of ['social', 'external', 'shopify']) {
      const router = setup()
      await router.push(`/account-data/${section}`)
      expect(router.currentRoute.value.name).toBe(`account-data-${section}`)
      expect(router.currentRoute.value.meta.permission).toBe('accounts.view')
      const reloaded = setup()
      await reloaded.push(router.currentRoute.value.fullPath)
      expect(reloaded.currentRoute.value.name).toBe(router.currentRoute.value.name)
    }
  })
  it('兼容入口及旧 query 链接，不丢其他参数和 hash', async () => {
    const router = setup()
    await router.push('/account-data')
    expect(router.currentRoute.value.path).toBe('/account-data/social')
    await router.push('/account-data?view=shopify&keyword=test#list')
    expect(router.currentRoute.value.fullPath).toBe('/account-data/shopify?keyword=test#list')
    await router.push('/account-data?view=external')
    expect(router.currentRoute.value.path).toBe('/account-data/external')
    await router.push('/account-data?view=invalid')
    expect(router.currentRoute.value.path).toBe('/account-data/social')
  })
  it('切换支持浏览器前进后退', async () => {
    const router = setup()
    await router.push('/account-data/social')
    await router.push('/account-data/external')
    await router.push('/account-data/shopify')
    const navigate = (move: () => void) => new Promise<void>(resolve => {
      const remove = router.afterEach(() => { remove(); resolve() })
      move()
    })
    await navigate(() => router.back())
    expect(router.currentRoute.value.name).toBe('account-data-external')
    await navigate(() => router.forward())
    expect(router.currentRoute.value.name).toBe('account-data-shopify')
  })
  it('直接访问外部监听不能绕过运营权限', async () => {
    auth.can.mockReturnValue(false)
    const router = setup()
    await router.push('/account-data/external')
    expect(router.currentRoute.value.name).toBe('forbidden')
    expect(router.currentRoute.value.query.from).toBe('/account-data/external')
  })
  it('直接访问 Shopify 不能绕过业务范围', async () => {
    auth.user.business_platform_scope = ['threads']
    const router = setup()
    await router.push('/account-data/shopify')
    expect(router.currentRoute.value.name).toBe('forbidden')
  })
  it('页签由路由驱动，父级侧栏保留高亮', () => {
    expect(layout).toContain('String(route.name')
    expect(layout).toContain('router.push({ name })')
    expect(layout).toContain('<router-view />')
    expect(shell).toContain(':default-active="activeMenuPath"')
  })
})
