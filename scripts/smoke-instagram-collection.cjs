// Mount the real settings component with synthetic HTTP responses only.
const assert = require('node:assert/strict')
const { chromium } = require('playwright')

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } })
    page.setDefaultTimeout(10000)
    const errors = [], mutations = []
    let tokens = [], enabled = false
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/__instagram_collection_smoke', route => route.fulfill({ contentType: 'text/html',
      body: '<html><meta name="viewport" content="width=device-width, initial-scale=1"><body style="padding:20px"><div id="app"></div></body></html>' }))
    await page.route('**/api/**', async route => {
      const req = route.request(), path = new URL(req.url()).pathname
      if (!path.startsWith('/api/')) return route.continue()
      assert.ok(path.startsWith('/api/interaction-center/content-monitor/provider-config/'))
      const platform = path.split('/')[5]
      let data = { business_platform: platform, provider: 'apify', enabled, tokens: platform === 'instagram' ? tokens : [] }
      if (req.method() !== 'GET') {
        mutations.push(path)
        assert.equal(platform, 'instagram', 'Mutation must stay on the selected platform')
        if (path.endsWith('/tokens')) {
          tokens = [{ id: 'ig-token', ...req.postDataJSON(), created_at: '2026-09-08T01:00:00Z', updated_at: '2026-09-08T01:00:00Z' }]
          data = tokens[0]
        } else if (path.endsWith('/test')) {
          data = { business_platform: 'instagram', account_username: 'synthetic' }
        } else {
          enabled = req.postDataJSON().enabled ?? enabled
          data = { ...data, enabled }
        }
      } else if (path.endsWith('/usage')) {
        data = { token_count: tokens.length, enabled_token_count: tokens.length, available_token_count: tokens.length,
          account_count: tokens.length, total_included_credits_usd: 5, total_monthly_quota_usd: 5,
          total_monthly_usage_usd: 0, total_remaining_quota_usd: 5, total_today_usage_usd: 0,
          daily_usages: [], tokens: [] }
      }
      await route.fulfill({ json: { code: 0, msg: 'ok', data } })
    })
    await page.goto(`${process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173'}/__instagram_collection_smoke`)
    await page.evaluate(async () => {
      await import('/src/styles.css')
      const entry = await (await fetch('/src/main.ts')).text()
      for (const match of entry.matchAll(/import "([^\"]*(?:message|message-box|notification)[^\"]*)"/g)) await import(match[1])
      const source = await (await fetch('/src/components/ApifyMonitorConfigPanel.vue')).text()
      const { createApp, h } = await import(source.match(/from "(\/node_modules\/\.vite\/deps\/vue\.js[^"]*)"/)[1])
      const { default: View } = await import('/src/components/ApifyMonitorConfigPanel.vue')
      createApp({ setup: () => () => h(View) }).mount('#app')
    })
    await page.getByText('Instagram', { exact: true }).click()
    await page.getByRole('heading', { name: '互动采集', exact: true }).waitFor()
    assert.equal(await page.getByText('Threads 内部协议', { exact: true }).count(), 0)
    await page.getByText('暂无 Apify Token', { exact: true }).waitFor()
    await page.waitForFunction(() => !document.querySelector('.platform-switcher .is-disabled'))
    await page.waitForFunction(() => !document.querySelector('.el-loading-mask'))
    await page.screenshot({ path: 'logs/instagram-collection-desktop.png', fullPage: true, animations: 'disabled' })
    await page.getByRole('button', { name: '添加 Token', exact: true }).click()
    const dialog = page.locator('.el-dialog:visible')
    const fields = dialog.locator('input:not([type="checkbox"])')
    await fields.nth(0).fill('Instagram synthetic')
    await fields.nth(1).fill('synthetic-instagram-token')
    await dialog.getByRole('button', { name: /保存/ }).click()
    await page.getByText('Instagram synthetic', { exact: true }).waitFor()
    await page.locator('.monitor-switch .el-switch').click()
    await page.locator('.monitor-switch').getByText('互动采集已启用', { exact: true }).waitFor()
    for (const close of await page.locator('.el-notification__closeBtn').all()) await close.click()
    await page.waitForFunction(() => !document.querySelector('.el-loading-mask'))
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: 'logs/instagram-collection-mobile.png', fullPage: true, animations: 'disabled' })
    for (const selector of ['.platform-switcher', '.monitor-switch', '.provider-config']) {
      const box = await page.locator(selector).boundingBox()
      assert.ok(box.x >= 0 && box.x + box.width <= 390, `${selector} overflows mobile viewport`)
    }
    await page.setViewportSize({ width: 1500, height: 1000 })
    await page.getByText('Threads', { exact: true }).click()
    await page.getByText('Threads 内部协议', { exact: true }).waitFor()
    assert.equal(await page.getByText('Instagram synthetic', { exact: true }).count(), 0)
    await page.getByText('X(Twitter)', { exact: true }).click()
    await page.getByText('暂无 Apify Token', { exact: true }).waitFor()
    assert.equal(await page.getByText('Threads 内部协议', { exact: true }).count(), 0)
    assert.deepEqual(errors, [])
    assert.ok(mutations.length >= 2)
    console.log('PASS: Instagram platform configuration, isolated token writes, enable switch, Threads/X compatibility, desktop/mobile framing')
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
