const assert = require('node:assert/strict')
const { mkdirSync } = require('node:fs')
const { chromium } = require('playwright')

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(() => localStorage.setItem('access_token', 'navigation-smoke-mock'))
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname
      if (!path.startsWith('/api/')) return route.continue()
      const data = path === '/api/auth/me'
        ? { id: 'test', username: 'test', roles: ['super_admin'], permissions: [], status: 'active' }
        : path.includes('unread') ? { count: 0 } : { items: [], total: 0 }
      return route.fulfill({ json: { code: 0, msg: 'ok', data } })
    })
    await page.route('**/src/views/AccountCenterView.vue*', route => route.abort('failed'))
    await page.goto((process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173') + '/tasks')
    const menu = page.locator('aside .el-menu-item').filter({ hasText: '账号管理' })
    await menu.click()
    await page.getByText('页面加载失败', { exact: true }).waitFor()
    mkdirSync('logs', { recursive: true })
    await page.getByRole('button', { name: '暂不刷新', exact: true }).hover()
    await page.screenshot({ path: 'logs/navigation-recovery.png', animations: 'disabled' })
    assert(page.url().endsWith('/tasks'))
    await page.getByRole('button', { name: '暂不刷新', exact: true }).click()
    await page.getByText('页面加载失败', { exact: true }).waitFor({ state: 'hidden' })
    assert(page.url().endsWith('/tasks'))
    await page.getByRole('button', { name: '切换暗黑模式', exact: true }).click()
    assert(await page.locator('html').evaluate(el => el.classList.contains('dark')))
    await page.unroute('**/src/views/AccountCenterView.vue*')
    await menu.click()
    await page.getByText('页面加载失败', { exact: true }).waitFor()
    await Promise.all([
      page.waitForEvent('load'),
      page.getByRole('button', { name: '重新加载', exact: true }).click(),
    ])
    await menu.click()
    await page.waitForURL('**/accounts')
    assert.deepEqual(errors, [])
    console.log('PASS: failed navigation prompt, cancel preserves page, theme works, confirmed reload restores navigation, no unhandled errors')
  } finally {
    await browser.close()
  }
}

main().catch(error => { console.error(error); process.exit(1) })
