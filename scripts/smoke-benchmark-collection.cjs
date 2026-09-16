const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const { mkdirSync } = require('node:fs')

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    const errors = []
    const methods = []
    page.on('pageerror', error => errors.push(error.message))
    let status = 'queued'
    let phase = 'profile'
    let hasProfile = false
    await page.route('**/__benchmark_collection_smoke', route => route.fulfill({
      contentType: 'text/html', body: '<html><meta name="viewport" content="width=device-width, initial-scale=1"><body><div id="app"></div></body></html>',
    }))
    await page.route('**/api/**', route => {
      if (!new URL(route.request().url()).pathname.startsWith('/api/')) return route.continue()
      methods.push(route.request().method())
      const mappings = new URL(route.request().url()).pathname.endsWith('/mappings')
      return route.fulfill({ json: { code: 0, msg: 'ok', data: mappings ? { total: 0, items: [] } : {
        id: 'tracker', enabled: true, status: 'active', source_business_platform: 'threads',
        source_display_name: hasProfile ? 'Source account' : null,
        source_username: hasProfile ? 'source' : null,
        source_profile_url: 'https://www.threads.com/@source',
        last_success_at: status === 'succeeded' ? '2026-09-16T09:31:15Z' : null,
        collection_run: { id: 'run', status, phase, attempt_no: 1, started_at: '2026-09-16T09:26:16Z',
          error_message: status === 'failed' ? '帖子采集请求失败' : null },
      } } })
    })
    await page.goto('http://127.0.0.1:5173/__benchmark_collection_smoke')
    await page.evaluate(async () => {
      await import('/src/styles.css')
      const source = await (await fetch('/src/components/BenchmarkTrackerDetailPanel.vue')).text()
      const vuePath = source.match(/from "(\/node_modules\/\.vite\/deps\/vue\.js[^"]*)"/)[1]
      const { createApp, h } = await import(vuePath)
      const { default: Component } = await import('/src/components/BenchmarkTrackerDetailPanel.vue')
      createApp({ setup: () => () => h(Component, { account: { id: 'test' } }) }).mount('#app')
    })
    await page.getByText('排队中', { exact: true }).waitFor({ timeout: 10000 }).catch(async error => {
      console.error({ errors, methods, body: await page.locator('body').innerText() })
      throw error
    })
    status = 'running'
    await page.getByText('正在采集资料', { exact: true }).waitFor()
    phase = 'posts'
    hasProfile = true
    await page.getByText('正在采集帖子', { exact: true }).waitFor()
    await page.getByText('Source account', { exact: true }).waitFor()
    assert.equal(await page.getByText('等待首次采集', { exact: true }).count(), 0)
    mkdirSync('logs', { recursive: true })
    await page.screenshot({ path: 'logs/benchmark-collection-desktop.png' })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: 'logs/benchmark-collection-mobile.png' })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    status = 'failed'
    await page.getByText('采集失败', { exact: true }).waitFor()
    await page.getByText('帖子采集请求失败', { exact: true }).waitFor()
    assert.equal(await page.getByText('Source account', { exact: true }).count(), 1)
    status = 'succeeded'
    await page.getByRole('button', { name: '刷新', exact: true }).click()
    await page.getByText('采集已完成', { exact: true }).waitFor()
    assert.deepEqual(errors, [])
    assert.ok(methods.every(method => method === 'GET'))
    console.log('Benchmark collection UI passed: queued/profile/posts/failure/success, early identity, read-only polling, desktop/mobile')
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
