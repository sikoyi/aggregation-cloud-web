const { chromium } = require('playwright')
const assert = require('node:assert/strict')

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1680, height: 900 } })
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    let fail = false
    let lastQuery
    await page.route('**/__shopify_monitor_smoke', r => r.fulfill({ contentType: 'text/html', body: '<html><meta name="viewport" content="width=device-width, initial-scale=1"><body><div id="app"></div></body></html>' }))
    await page.route('**/api/**', r => {
      const url = new URL(r.request().url())
      if (!url.pathname.startsWith('/api/')) return r.continue()
      lastQuery = url.searchParams
      if (fail) return r.fulfill({ status: 503, json: { code: 50000, msg: '测试服务暂不可用', data: null } })
      const states = ['active', 'retrying', 'stopped_banned', 'stopped_exported', 'missing_url']
      return r.fulfill({ json: { code: 0, msg: 'ok', data: { total: 21, items: states.map((state, index) => ({
        account_id: String(index), username: `demo-${index}`, profile_url: state === 'missing_url' ? '' : 'https://example.myshopify.com', state,
        failures: state === 'stopped_banned' ? 6 : state === 'retrying' ? 3 : 0,
        last_checked_at: '2026-09-07T08:00:00Z', next_check_at: state === 'active' ? '2026-09-07T14:00:00Z' : null,
        last_error: state === 'retrying' ? '店铺访问失败（网络、证书或地址异常）' : null,
      })) } } })
    })
    await page.goto('http://127.0.0.1:5173/__shopify_monitor_smoke')
    await page.evaluate(async () => {
      await import('/src/styles.css')
      const source = await (await fetch('/src/components/ShopifyStoreMonitors.vue')).text()
      const vuePath = source.match(/from "(\/node_modules\/\.vite\/deps\/vue\.js[^"]*)"/)[1]
      const { createApp, h } = await import(vuePath)
      const authSource = await (await fetch('/src/stores/auth.ts')).text()
      const { createPinia } = await import(authSource.match(/from "(\/node_modules\/\.vite\/deps\/pinia\.js[^"]*)"/)[1])
      const { useAuthStore } = await import('/src/stores/auth.ts')
      const { default: Component } = await import('/src/components/ShopifyStoreMonitors.vue')
      const pinia = createPinia()
      useAuthStore(pinia).user = { roles: [], permissions: ['accounts.view'] }
      createApp({ setup: () => () => h(Component) }).use(pinia).mount('#app')
    })
    await page.locator('.el-table').getByText('已导出，停止监听', { exact: true }).waitFor()
    assert.ok(await page.getByText('5 / 5', { exact: true }).count())
    assert.ok(await page.getByText('2 / 5', { exact: true }).count())
    await page.getByPlaceholder('账号 / 店铺链接').fill('demo')
    await page.getByRole('button', { name: '查询', exact: true }).click()
    await page.waitForTimeout(150)
    assert.equal(lastQuery.get('keyword'), 'demo')
    await page.locator('.btn-next').click()
    await page.waitForTimeout(150)
    assert.equal(lastQuery.get('page'), '2')
    await page.locator('.el-pagination .el-select').click()
    await page.getByRole('option').filter({ hasText: '50' }).click()
    await page.waitForTimeout(300)
    assert.equal(lastQuery.get('page'), '1')
    assert.equal(lastQuery.get('page_size'), '50')
    assert.ok(await page.locator('.el-pagination.is-background').count())
    await page.screenshot({ path: 'logs/shopify-monitor-desktop.png' })
    fail = true
    await page.getByRole('button', { name: '刷新监听', exact: true }).click()
    await page.getByText('测试服务暂不可用', { exact: true }).waitFor()
    fail = false
    await page.getByRole('button', { name: '刷新监听', exact: true }).click()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(300)
    await page.screenshot({ path: 'logs/shopify-monitor-mobile.png' })
    assert.deepEqual(errors, [])
    console.log('Shopify monitor UI passed: states, retries, filtering, pagination, error/recovery, desktop/mobile')
  } finally { await browser.close() }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
