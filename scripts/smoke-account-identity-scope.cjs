const assert = require('node:assert/strict')
const { chromium } = require('playwright')

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
    page.setDefaultTimeout(10000)
    const errors = []
    const updates = []
    const detailQueries = []
    page.on('pageerror', error => errors.push(error.message))
    const summaries = [
      { account_id: 'thread-1', business_platform: 'threads', tag_names: ['Selected tag'], login_status: 'unknown' },
      { account_id: 'ins-1', business_platform: 'instagram', tag_names: ['Other platform tag'], login_status: 'logged_in' },
    ]
    await page.route('**/__identity_scope_smoke', route => route.fulfill({ contentType: 'text/html',
      body: '<html><meta name="viewport" content="width=device-width, initial-scale=1"><body><div id="app"></div></body></html>' }))
    await page.route('**/api/**', async route => {
      const request = route.request()
      const url = new URL(request.url())
      if (!url.pathname.startsWith('/api/')) return route.continue()
      let data = { items: [], total: 0 }
      if (url.pathname === '/api/account-identities') {
        data = { items: [{ id: 'identity-1', login_username: 'scope-test@example.test', account_count: 2,
          matched_account_ids: ['thread-1'], can_edit_credentials: true, platform_summaries: summaries,
          has_password: true, has_totp: true, can_read_credentials: false, created_at: '2026-09-07T00:00:00Z' }], total: 1 }
      } else if (url.pathname === '/api/account-identities/identity-1/accounts') {
        detailQueries.push(url.searchParams.get('account_ids'))
        data = { items: [{ id: 'thread-1', business_platform: 'threads', login_username: 'scope-test@example.test',
          display_name: 'Selected platform account', login_status: 'unknown', tag_names: ['Selected tag'],
          account_age_type: 'old' }] }
      } else if (url.pathname === '/api/accounts/login-status/batch') {
        updates.push(request.postDataJSON())
        data = { updated_count: 1 }
      }
      await route.fulfill({ json: { code: 0, msg: 'ok', data } })
    })
    await page.goto(`${process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173'}/__identity_scope_smoke`)
    await page.evaluate(async () => {
      await import('/src/styles.css')
      const entry = await (await fetch('/src/main.ts')).text()
      for (const match of entry.matchAll(/import "([^\"]*(?:message|message-box|notification)[^\"]*)"/g)) await import(match[1])
      const source = await (await fetch('/src/components/CrudPage.vue')).text()
      const vuePath = source.match(/from "(\/node_modules\/\.vite\/deps\/vue\.js[^"]*)"/)[1]
      const authSource = await (await fetch('/src/stores/auth.ts')).text()
      const piniaPath = authSource.match(/from "(\/node_modules\/\.vite\/deps\/pinia\.js[^"]*)"/)[1]
      const { createApp, h } = await import(vuePath)
      const { createPinia } = await import(piniaPath)
      const { useAuthStore } = await import('/src/stores/auth.ts')
      const { resources } = await import('/src/config/resources.ts')
      const { buildAccountIdentityResource } = await import('/src/config/accountIdentityResource.ts')
      const { default: CrudPage } = await import('/src/components/CrudPage.vue')
      const config = buildAccountIdentityResource(resources.accounts)
      config.filters = []
      const pinia = createPinia()
      const auth = useAuthStore(pinia)
      auth.user = { id: 'smoke', username: 'smoke', display_name: 'Smoke', roles: [],
        permissions: ['accounts.view', 'accounts.edit', 'accounts.batch', 'accounts.export', 'accounts.delete'] }
      createApp({ setup: () => () => h(CrudPage, { config }) }).use(pinia).mount('#app')
    })
    await page.getByText('scope-test@example.test', { exact: true }).waitFor()
    await page.getByText(/匹配 1 个/).waitFor()
    assert.equal(await page.getByText('Other platform tag', { exact: true }).count(), 0)
    assert.equal(await page.getByText('Instagram', { exact: true }).count(), 1)
    await page.locator('.el-table__expand-icon').first().click()
    await page.getByText('Selected platform account', { exact: true }).waitFor()
    assert.deepEqual(detailQueries, ['thread-1'])
    assert.equal(await page.locator('.identity-details').getByText('Instagram', { exact: true }).count(), 0)
    await page.locator('.resource-table--accountIdentities .el-checkbox:visible').first().click()
    await page.getByRole('button', { name: '修改登录状态', exact: true }).click()
    const dialog = page.locator('.el-dialog:visible')
    await dialog.getByRole('combobox').click()
    await page.getByRole('option', { name: '未登录', exact: true }).click()
    await dialog.getByRole('button', { name: /提交|保存|确认/ }).last().click()
    const confirm = page.locator('.el-message-box')
    await confirm.getByText(/1 个登录身份，本次影响 1 个平台账号/).waitFor()
    await confirm.getByRole('button', { name: /确定|确认/ }).click()
    await page.waitForFunction(() => !document.querySelector('.el-message-box'))
    assert.deepEqual(updates, [{ account_ids: ['thread-1'], login_status: 'not_logged_in' }])
    await page.locator('.el-overlay:visible').waitFor({ state: 'hidden' })
    await page.waitForTimeout(400)
    await page.screenshot({ path: 'logs/account-identity-scope-desktop.png', fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: 'logs/account-identity-scope-mobile.png', fullPage: true })
    assert.deepEqual(errors, [])
    console.log('Identity scope smoke passed: two-platform overview, matched tags/details, exact one-account batch request, no page errors')
  } finally { await browser.close() }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
