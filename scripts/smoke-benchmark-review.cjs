const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const { mkdirSync } = require('node:fs')

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    const errors = []
    const writes = []
    let job = { id: 'review-1', revision: 'revision-1', status: 'pending_review', source_display_name: 'Source Author', source_username: 'source',
      source_business_platform: 'threads', target_display_name: 'Target Account', target_username: 'target', business_platform: 'x',
      final_content: 'Original post text', created_at: '2026-09-16T09:00:00Z', task_run_id: null,
      snapshot: { content_url: 'https://www.threads.com/@source/post/example', media_urls: [] } }
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/__benchmark_review_smoke', route => route.fulfill({ contentType: 'text/html', body: '<html><meta name="viewport" content="width=device-width, initial-scale=1"><body><div id="app"></div></body></html>' }))
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname
      if (!path.startsWith('/api/')) return route.continue()
      if (route.request().method() === 'POST') {
        writes.push({ path, body: route.request().postDataJSON() })
        job = { ...job, status: 'queued', final_content: writes.at(-1).body.content, task_run_id: 'task-1' }
      }
      return route.fulfill({ json: { code: 0, msg: 'ok', data: path.endsWith('/reviews') ? { items: [job], total: 1 } : job } })
    })
    await page.goto('http://127.0.0.1:5173/__benchmark_review_smoke')
    await page.evaluate(async () => {
      await import('/src/styles.css')
      const source = await (await fetch('/src/components/BenchmarkPostReviews.vue')).text()
      const vuePath = source.match(/from "(\/node_modules\/\.vite\/deps\/vue\.js[^"]*)"/)[1]
      const authSource = await (await fetch('/src/stores/auth.ts')).text()
      const piniaPath = authSource.match(/from "(\/node_modules\/\.vite\/deps\/pinia\.js[^"]*)"/)[1]
      const { createApp, h } = await import(vuePath)
      const { createPinia } = await import(piniaPath)
      const { useAuthStore } = await import('/src/stores/auth.ts')
      const { default: Component } = await import('/src/components/BenchmarkPostReviews.vue')
      const app = createApp({ setup: () => () => h(Component) })
      const pinia = createPinia()
      app.use(pinia)
      useAuthStore(pinia).user = { id: 'user', roles: ['super_admin'], permissions: ['operations.view', 'operations.review'], status: 'active' }
      app.mount('#app')
    })
    await page.getByText('Original post text', { exact: true }).waitFor()
    await page.locator('.el-table__body-wrapper button').first().click()
    await page.getByRole('dialog').waitFor()
    await page.waitForTimeout(350)
    assert.equal(writes.length, 0)
    await page.locator('#benchmark-review-content').fill('Reviewed and edited post')
    mkdirSync('logs', { recursive: true })
    await page.screenshot({ path: 'logs/benchmark-review-desktop.png' })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(350)
    await page.screenshot({ path: 'logs/benchmark-review-mobile.png' })
    const bounds = await page.getByRole('dialog').boundingBox()
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 391)
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 845)
    await page.getByRole('button', { name: '批准发布', exact: true }).click()
    await page.getByRole('button', { name: '确定', exact: true }).click()
    await page.getByText('任务 ID：task-1', { exact: true }).waitFor()
    assert.equal(writes.length, 1)
    assert.deepEqual(writes[0].body, { revision: 'revision-1', content: 'Reviewed and edited post' })
    assert.equal(await page.getByRole('button', { name: '批准发布', exact: true }).count(), 0)
    assert.deepEqual(errors, [])
    console.log('Benchmark review UI passed: scoped list, source/target, edit, confirmation, no pre-approval dispatch, desktop/mobile')
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
