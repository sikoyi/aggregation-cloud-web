// Synthetic, read-only UI smoke. All API traffic is fulfilled locally; no customer backend.
const assert = require('node:assert/strict')
const { mkdirSync } = require('node:fs')
const { chromium } = require('playwright')

async function main() {
  const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5197'
  const browser = await chromium.launch({ headless: true })
  mkdirSync('logs', { recursive: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
    page.setDefaultTimeout(15000)
    const errors = []
    const requests = []
    let conflictMode = 'normal'
    page.on('pageerror', error => errors.push(error.message))
    const bound = { id: 'slot-bound', display_name: '正式运营环境', provider_slot_id: 'formal-provider-001' }
    const observed = { id: 'slot-observed', display_name: '其他 Agent 发现的重复登录环境', provider_slot_id: 'discovered-provider-001' }
    const device = slot => ({ ...slot, status: 'offline', runtime_platform: 'fingerprint_browser', provider: 'morelogin',
      group_name: '已生效分组', group_sync_status: 'propagating', pending_group_name: '旧目标组', binding_conflict_count: 2 })
    const conflict = { id: 'conflict-1', account_id: 'account-1', business_platform: 'threads', username: 'operator-synthetic',
      bound_slot: bound, observed_slot: observed, bound_slot_restricted: false, observed_slot_restricted: false,
      runtime_id: 'runtime-1', first_seen_at: '2026-09-13T01:00:00Z', last_seen_at: '2026-09-13T02:00:00Z' }
    await page.route('**/*', async route => {
      const request = route.request()
      const url = new URL(request.url())
      if (url.origin !== new URL(base).origin) return route.abort()
      if (url.pathname === '/__binding_smoke') return route.fulfill({ contentType: 'text/html',
        body: '<html><meta name="viewport" content="width=device-width, initial-scale=1"><body><div id="app"></div></body></html>' })
      if (!url.pathname.startsWith('/api/')) return route.continue()
      assert.equal(request.method(), 'GET', `Unexpected mutation: ${request.method()} ${url.pathname}`)
      requests.push(url.pathname + url.search)
      let data = { items: [], total: 0 }
      if (url.pathname.endsWith('/binding-conflicts')) {
        if (conflictMode === 'error') return route.fulfill({ status: 403, json: { code: 403, msg: '无权查看冲突记录', data: null } })
        data = { items: conflictMode === 'empty' ? [] : [conflict, { ...conflict, id: 'conflict-2', username: null,
          bound_slot: null, observed_slot: null, bound_slot_restricted: true, observed_slot_restricted: true }] }
      } else if (url.pathname === '/api/execution-slots') {
        data = { items: [device(observed)], total: 1 }
      } else if (url.pathname === '/api/execution-slots/slot-bound') {
        data = device(bound)
      } else if (url.pathname === '/api/execution-slots/slot-observed') {
        data = device(observed)
      } else if (url.pathname === '/api/account-identities') {
        data = { items: [{ id: 'identity-1', login_username: 'synthetic@example.test', binding_conflict_count: 2,
          account_count: 1, active_session_count: 1, matched_account_ids: ['account-1'], can_read_credentials: false,
          has_password: true, has_totp: true, platform_summaries: [{ account_id: 'account-1', business_platform: 'threads',
            session_id: 'session-1', slot_id: bound.id, slot_name: bound.display_name, login_status: 'logged_in' }] }], total: 1 }
      } else if (url.pathname === '/api/account-identities/statistics') {
        data = { total: 1, online: 0, logged_in: 1, not_logged_in: 0, banned: 0, verification_required: 0, unknown: 0, exported: 0 }
      } else if (url.pathname === '/api/account-identities/identity-1/accounts') {
        data = { items: [{ id: 'account-1', username: 'operator-synthetic', business_platform: 'threads',
          account_session_id: 'session-1', bound_slot_name: bound.display_name, bound_slot_provider_id: bound.provider_slot_id,
          login_status: 'logged_in', binding_conflict_count: 2 }] }
      }
      await route.fulfill({ json: { code: 0, msg: 'ok', data } })
    })
    await page.goto(`${base}/__binding_smoke`)
    await page.evaluate(async () => {
      await import('/src/styles.css')
      const entry = await (await fetch('/src/main.ts')).text()
      for (const match of entry.matchAll(/import "([^\"]*(?:message|message-box|notification)[^\"]*)"/g)) await import(match[1])
      const source = await (await fetch('/src/views/DeviceCenterView.vue')).text()
      const authSource = await (await fetch('/src/stores/auth.ts')).text()
      const { createApp, h } = await import(source.match(/from "(\/node_modules\/\.vite\/deps\/vue\.js[^"]*)"/)[1])
      const { createRouter, createMemoryHistory, RouterView } = await import(source.match(/from "(\/node_modules\/\.vite\/deps\/vue-router\.js[^"]*)"/)[1])
      const { createPinia } = await import(authSource.match(/from "(\/node_modules\/\.vite\/deps\/pinia\.js[^"]*)"/)[1])
      const { default: Devices } = await import('/src/views/DeviceCenterView.vue')
      const { default: Crud } = await import('/src/components/CrudPage.vue')
      const { resources } = await import('/src/config/resources.ts')
      const { buildAccountIdentityResource } = await import('/src/config/accountIdentityResource.ts')
      const { useAuthStore } = await import('/src/stores/auth.ts')
      const config = buildAccountIdentityResource(resources.accounts)
      config.filters = config.filters.filter(field => field.key === 'has_binding_conflict')
      const pinia = createPinia()
      useAuthStore(pinia).user = { id: 'binding-smoke', permissions: ['accounts.view', 'devices.view'], roles: [] }
      const router = createRouter({ history: createMemoryHistory(), routes: [
        { path: '/slots', component: Devices },
        { path: '/accounts', component: { setup: () => () => h(Crud, { config }) } },
      ] })
      await router.push('/slots')
      window.smokeRouter = router
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedId = text } } })
      createApp({ setup: () => () => h(RouterView) }).use(pinia).use(router).mount('#app')
    })
    await page.getByRole('button', { name: '绑定冲突 2' }).click()
    const dialog = page.getByRole('dialog', { name: '绑定冲突', exact: true })
    await dialog.getByText('正式运营环境', { exact: true }).waitFor()
    assert.equal(await dialog.getByText('无权查看此环境').count(), 2)
    assert.equal(await dialog.locator('.binding-conflicts__record').nth(1).getByRole('button').count(), 0)
    assert.equal(await page.locator('.device-group__spinner').count(), 0)
    await dialog.getByRole('button', { name: '复制环境 ID', exact: true }).first().click()
    assert.equal(await page.evaluate(() => window.copiedId), 'formal-provider-001')
    await dialog.getByRole('button', { name: '复制设备记录 ID', exact: true }).first().click()
    assert.equal(await page.evaluate(() => window.copiedId), 'slot-bound')
    await page.mouse.move(5, 5)
    await page.screenshot({ path: 'logs/binding-conflicts-desktop.png', fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: 'logs/binding-conflicts-mobile.png', fullPage: true })
    assert.equal(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true)
    const boxes = await dialog.locator('.binding-conflicts__environment').evaluateAll(nodes => nodes.slice(0, 2).map(el => {
      const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, bottom: r.bottom }
    }))
    assert.equal(boxes[0].x, boxes[1].x)
    assert.ok(boxes[0].bottom <= boxes[1].y)
    await page.setViewportSize({ width: 1600, height: 1000 })
    await dialog.getByRole('button', { name: '定位设备', exact: true }).first().click()
    await page.getByText('精确定位设备记录 ID').waitFor()
    await page.locator('.device-identity').getByText('正式运营环境', { exact: true }).waitFor()
    assert.ok(requests.includes('/api/execution-slots/slot-bound'))
    await page.getByRole('button', { name: '绑定冲突 2' }).click()
    await dialog.getByRole('button', { name: '定位设备', exact: true }).nth(1).click()
    await page.locator('.device-identity').getByText('其他 Agent 发现的重复登录环境', { exact: true }).waitFor()
    assert.ok(requests.includes('/api/execution-slots/slot-observed'))
    await page.getByRole('button', { name: '清除定位' }).click()
    const conflictFilter = page.locator('.el-form-item').filter({ has: page.locator('.el-form-item__label', { hasText: '绑定冲突' }) })
    await conflictFilter.getByRole('combobox').click()
    await page.getByRole('option', { name: '存在绑定冲突', exact: true }).click()
    await page.waitForTimeout(150)
    assert.ok(requests.some(url => url.startsWith('/api/execution-slots?') && url.includes('has_binding_conflict=true')))
    await page.evaluate(() => window.smokeRouter.push('/accounts'))
    await page.getByText('synthetic@example.test', { exact: true }).waitFor()
    await page.locator('.el-table__expand-icon').first().click()
    await page.locator('.identity-details').getByRole('button', { name: '绑定冲突 2' }).click()
    await dialog.getByText('正式运营环境', { exact: true }).waitFor().catch(async error => {
      await page.screenshot({ path: 'logs/binding-conflicts-failure.png', fullPage: true })
      console.log({ errors, requests, dialogs: await page.locator('.el-dialog').allTextContents() })
      throw error
    })
    assert.ok(requests.includes('/api/accounts/account-1/binding-conflicts'))
    await page.screenshot({ path: 'logs/binding-conflicts-account.png', fullPage: true })
    conflictMode = 'error'
    await dialog.getByRole('button', { name: '刷新冲突记录' }).click()
    await dialog.getByText('无权查看冲突记录', { exact: true }).waitFor()
    assert.equal(await dialog.locator('.conflict-slot').count(), 0)
    conflictMode = 'empty'
    await dialog.getByRole('button', { name: '刷新冲突记录' }).click()
    await dialog.getByText('暂无绑定冲突', { exact: true }).waitFor()
    conflictMode = 'normal'
    await dialog.getByRole('button', { name: '刷新冲突记录' }).click()
    await dialog.getByRole('button', { name: '定位设备', exact: true }).first().click()
    await page.locator('.device-identity').getByText('正式运营环境', { exact: true }).waitFor()
    // Previously persisted conflict filter does not constrain the exact detail endpoint.
    assert.equal(await page.locator('.filter-card').count(), 0)
    await page.evaluate(() => window.smokeRouter.push('/accounts'))
    await page.getByRole('combobox', { name: '绑定冲突:' }).click()
    await page.getByRole('option', { name: '存在绑定冲突', exact: true }).click()
    await page.waitForTimeout(150)
    assert.ok(requests.some(url => url.startsWith('/api/account-identities?') && url.includes('has_binding_conflict=true')))
    await page.goto(`${base}/scripts/fixtures/binding-conflict-preview.html`)
    await page.locator('.binding-conflicts[aria-busy="false"]').waitFor()
    await page.screenshot({ path: 'logs/binding-conflicts-long-desktop.png', fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.locator('.binding-conflicts__record').nth(1).getByText('设备记录 ID observed-2').scrollIntoViewIfNeeded()
    await page.screenshot({ path: 'logs/binding-conflicts-long-mobile.png', fullPage: true })
    assert.equal(await page.locator('.binding-conflicts').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true)
    await page.getByRole('button', { name: '关闭', exact: true }).click()
    await page.getByRole('checkbox', { name: '设备查看权限' }).uncheck()
    await page.getByRole('button', { name: 'normal', exact: true }).click()
    await page.locator('.binding-conflicts[aria-busy="false"]').waitFor()
    assert.equal(await page.getByRole('button', { name: '定位设备' }).count(), 0)
    await page.getByRole('button', { name: '关闭', exact: true }).click()
    await page.getByRole('button', { name: 'loading', exact: true }).click()
    await page.locator('.binding-conflicts[aria-busy="true"]').waitFor()
    assert.equal(await page.getByRole('button', { name: '刷新冲突记录' }).isDisabled(), true)
    await page.getByRole('button', { name: '关闭', exact: true }).click()
    assert.deepEqual(errors, [])
    console.log('PASS: device/account modal, both copy IDs, restricted/empty/error/retry, same-route exact target, persistent-filter isolation, conflict filters, desktop/mobile layout; GET-only mocked APIs')
  } finally { await browser.close() }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
