// Run with local Vite and Playwright. API fixtures never create real posts or tasks.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')

async function run() {
  const browser = await chromium.launch({ headless: true })
  const screenshots = process.env.SELECTION_SCREENSHOTS || path.resolve('.tmp/selection-sticky')
  await fs.mkdir(screenshots, { recursive: true })
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
      const page = await browser.newPage({ viewport })
      const errors = []
      const queries = []
      page.on('pageerror', error => errors.push(error.message))
      await page.addInitScript(() => localStorage.setItem('access_token', 'mock'))
      const posts = Array.from({ length: 40 }, (_, i) => ({ id: `p${i}`, business_platform: 'threads',
        source_id: 'source', text_body: `Post ${i}\n\nOriginal content for scrolling verification.`,
        media: [], author: { username: `author${i}`, display_name: `Author ${i}` },
        content_url: 'https://threads.com/@demo/post/test', updated_at: '2026-10-12T00:00:00Z' }))
      await page.route('**/api/**', async route => {
        const pathname = new URL(route.request().url()).pathname
        if (!pathname.startsWith('/api/')) return route.continue()
        let data = {}
        if (pathname === '/api/auth/me') data = { id: 'test', username: 'test', roles: ['super_admin'], permissions: [], status: 'active' }
        else if (pathname.endsWith('/local-state-scope')) data = { user_id: 'test', tenant_id: 'test' }
        else if (pathname.endsWith('/posts/query')) {
          const query = route.request().postDataJSON()
          queries.push(query)
          data = { items: posts.slice((query.page - 1) * query.page_size, query.page * query.page_size), total: posts.length }
        } else if (pathname.endsWith('/sources') || pathname.endsWith('/selection-options')) data = []
        else if (pathname.endsWith('/orders')) data = { items: [], total: 0 }
        await route.fulfill({ json: { code: 0, msg: 'ok', data } })
      })
      await page.goto(`${process.env.SELECTION_BASE_URL || 'http://127.0.0.1:5173'}/content-selection`)
      await page.locator('.post-item').first().waitFor().catch(async error => {
        console.log(await page.locator('body').innerText(), errors, queries)
        throw error
      })
      const filters = page.locator('.selection-filters')
      const initial = await filters.boundingBox()
      await page.evaluate(() => window.scrollTo(0, 1200))
      await page.waitForFunction(() => {
        const filters = document.querySelector('.selection-filters')
        return Math.abs(filters.getBoundingClientRect().top - parseFloat(getComputedStyle(filters).top)) < 1
      })
      const pinned = await filters.boundingBox()
      assert(initial.y > pinned.y)
      const header = await page.locator('header.sticky').boundingBox()
      assert(pinned.y >= header.y + header.height, JSON.stringify({ viewport, pinned, header }))
      assert(pinned.y + pinned.height <= viewport.height - 120 + 1)
      await page.getByRole('textbox', { name: '正文 / 作者' }).fill('updated')
      await Promise.all([
        page.waitForResponse(response => response.url().endsWith('/posts/query')),
        page.getByRole('textbox', { name: '正文 / 作者' }).press('Enter'),
      ])
      assert.equal(queries.at(-1).keyword, 'updated')
      await page.getByRole('button', { name: '更多筛选' }).click()
      await page.waitForFunction(() => document.querySelector('.compact-filter-form').getBoundingClientRect().height > 0)
      const expanded = await filters.boundingBox()
      assert(expanded.y + expanded.height <= viewport.height - 120 + 1)
      const queryButton = filters.getByRole('button', { name: '查询', exact: true }).last()
      await queryButton.scrollIntoViewIfNeeded()
      await queryButton.click()
      await page.waitForFunction(() => !document.querySelector('.selection-content > .el-loading-mask'))
      assert(await filters.evaluate(el => el.scrollWidth <= el.clientWidth + 1))
      await filters.evaluate(el => { el.scrollTop = 0 })
      await page.evaluate(() => window.scrollTo(0, 1200))
      await page.waitForFunction(() => {
        const filters = document.querySelector('.selection-filters')
        return Math.abs(filters.getBoundingClientRect().top - parseFloat(getComputedStyle(filters).top)) < 1
      })
      await page.screenshot({ path: path.join(screenshots, `sticky-${viewport.width}.png`) })
      await page.getByRole('tab', { name: '来源账号', exact: true }).click()
      assert.equal(await filters.count(), 0)
      assert.deepEqual(errors, [])
      console.log(`PASS ${viewport.width}x${viewport.height}: sticky, filtering, expanded controls, tab isolation`)
      await page.close()
    }
  } finally { await browser.close() }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
