const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const { mkdirSync } = require('node:fs')

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    const errors = []
    const writes = []
    const listQueries = []
    let deleted = false, skipDelete = false
    let job = { id: 'review-1', revision: 'revision-1', status: 'pending_review', source_display_name: 'Source Author', source_username: 'source',
      source_business_platform: 'threads', target_display_name: 'Target Account', target_username: 'target', business_platform: 'x',
      final_content: 'Original post text', created_at: '2026-09-16T09:00:00Z', task_run_id: null,
      snapshot: { content_url: 'https://www.threads.com/@source/post/example', media_urls: [] } }
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/__benchmark_review_smoke', route => route.fulfill({ contentType: 'text/html', body: '<html><meta name="viewport" content="width=device-width, initial-scale=1"><body><div id="app"></div></body></html>' }))
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname
      if (!path.startsWith('/api/')) return route.continue()
      if (path === '/api/accounts' || path === '/api/account-tags') {
        const option = path === '/api/accounts' ? { id: 'account-1', username: 'Target filter account' } : { id: 'tag-1', name: 'Filter tag' }
        return route.fulfill({ json: { code: 0, msg: 'ok', data: { items: [option], total: 1 } } })
      }
      if (path.endsWith('/reviews')) listQueries.push(new URL(route.request().url()).searchParams.toString())
      if (route.request().method() === 'POST') {
        writes.push({ path, body: route.request().postDataJSON() })
        if (path.endsWith('/batch/delete')) {
          deleted = !skipDelete
          return route.fulfill({ json: { code: 0, msg: 'ok', data: { processed_count: skipDelete ? 0 : 1, skipped_count: skipDelete ? 1 : 0, failed_count: 0, failures: [] } } })
        }
        job = { ...job, status: 'queued', final_content: writes.at(-1).body.content, task_run_id: 'task-1' }
      }
      return route.fulfill({ json: { code: 0, msg: 'ok', data: path.endsWith('/reviews') ? { items: deleted ? [] : [job], total: deleted ? 0 : 1 } : job } })
    })
    await page.goto('http://127.0.0.1:5173/__benchmark_review_smoke')
    await page.evaluate(async () => {
      await import('/src/styles.css')
      await import('/src/theme.css')
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
    const filters = page.locator('.review-filters')
    await filters.getByText('筛选条件', { exact: true }).waitFor()
    assert.equal(await filters.getByRole('button', { name: '清空', exact: true }).isDisabled(), true)
    await filters.locator('.el-form-item').filter({ hasText: '工单状态' }).locator('.el-select').click()
    await Promise.all([
      page.waitForResponse(response => response.url().includes('/api/benchmark-trackers/reviews?') && response.url().includes('status=failed')),
      page.getByRole('option', { name: '发布失败', exact: true }).click(),
    ])
    await filters.getByRole('button', { name: '清空', exact: true }).click()
    await filters.getByRole('button', { name: '查询', exact: true }).click()
    assert.ok(listQueries.some(query => query.includes('status=failed')))
    assert.ok(!listQueries.at(-1).includes('status='))
    await filters.locator('.el-form-item').filter({ hasText: '业务平台' }).locator('.el-select').click()
    await page.getByRole('option', { name: 'X(Twitter)', exact: true }).click()
    await filters.locator('.el-form-item').filter({ hasText: '账号标签' }).locator('.el-select').click()
    await page.getByRole('option', { name: 'Filter tag', exact: true }).click()
    await filters.locator('.el-form-item').filter({ hasText: '发布账号' }).locator('.el-select').click()
    await page.getByRole('option', { name: 'Target filter account', exact: true }).click()
    await filters.getByPlaceholder('对标账号 / 原帖 / 发布文案').fill(' needle ')
    const combinedResponse = page.waitForResponse(response => response.url().includes('keyword=needle'))
    await filters.getByRole('button', { name: '查询', exact: true }).click()
    await combinedResponse
    const combined = new URLSearchParams(listQueries.at(-1))
    assert.equal(combined.get('business_platform'), 'x')
    assert.equal(combined.get('account_id'), 'account-1')
    assert.equal(combined.get('account_tag_id'), 'tag-1')
    await filters.getByRole('button', { name: '清空', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.review-filters input[placeholder="对标账号 / 原帖 / 发布文案"]')?.value === '')
    mkdirSync('logs', { recursive: true })
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 })
      await filters.getByRole('button', { name: '查询', exact: true }).hover()
      const filterBounds = await filters.boundingBox()
      const selectBounds = await filters.locator('.el-select').first().boundingBox()
      assert.ok(selectBounds.x >= filterBounds.x && selectBounds.x + selectBounds.width <= filterBounds.x + filterBounds.width)
      await page.screenshot({ path: `logs/post-review-filters-${width}.png` })
    }
    await page.setViewportSize({ width: 1440, height: 900 })
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
    await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click()
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    assert.equal(await page.getByRole('button', { name: '删除记录', exact: true }).count(), 0)
    job = { ...job, status: 'failed' }
    await filters.getByRole('button', { name: '查询', exact: true }).click()
    const remove = page.getByRole('button', { name: '删除记录', exact: true })
    await remove.waitFor()
    await remove.click()
    await page.getByRole('button', { name: '取消', exact: true }).click()
    assert.equal(writes.length, 1)
    skipDelete = true
    await remove.click()
    await page.getByRole('button', { name: '确认删除', exact: true }).click()
    await page.getByText('未删除记录', { exact: true }).waitFor()
    assert.equal(deleted, false)
    assert.deepEqual(writes.at(-1).body, { job_ids: ['review-1'] })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.locator('.review-row-actions').screenshot({ path: 'logs/post-review-row-actions.png' })
    skipDelete = false
    await remove.click()
    await page.getByRole('button', { name: '确认删除', exact: true }).click()
    await page.getByText('暂无对标帖子工单', { exact: true }).waitFor()
    assert.equal(deleted, true)
    assert.deepEqual(writes.at(-1).body, { job_ids: ['review-1'] })
    assert.deepEqual(errors, [])
    console.log('Benchmark review UI passed: scoped list, source/target, edit, confirmation, no pre-approval dispatch, desktop/mobile')
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
