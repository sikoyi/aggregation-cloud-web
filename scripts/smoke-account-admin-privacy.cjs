const assert = require('node:assert/strict')
const { chromium } = require('playwright')

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
    page.setDefaultTimeout(10000)
    const errors = []
    let totpRequests = 0
    let exportRequests = 0
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/__admin_privacy_smoke', route => route.fulfill({ contentType: 'text/html',
      body: '<html><meta name="viewport" content="width=device-width, initial-scale=1"><body><div id="app"></div></body></html>' }))
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url())
      if (!url.pathname.startsWith('/api/')) return route.continue()
      let data = { items: [], total: 0 }
      if (url.pathname === '/api/account-identities/feature') {
        data = { enabled: true, dual_write_enabled: true }
      } else if (url.pathname === '/api/account-identities') {
        // A stale response must not bypass the current frontend permission check.
        data = { items: [{ id: 'privacy-1', login_username: 'privacy@example.test', account_count: 1,
          has_password: true, has_totp: true, can_read_credentials: true, can_edit_credentials: false,
          password_secret_ref: 'private-password', totp_secret_ref: 'JBSWY3DPEHPK3PXP',
          created_at: '2026-09-08T00:00:00Z', platform_summaries: [
            { account_id: 'account-1', business_platform: 'shopify', login_status: 'not_logged_in' },
          ] }], total: 1 }
      } else if (url.pathname.endsWith('/totp')) {
        totpRequests++
        const now = Date.now() / 1000
        data = { code: '123456', server_time: now, expires_at: now + 30, period: 30 }
      } else if (url.pathname.includes('/export-records')) {
        exportRequests++
        data = url.pathname.endsWith('/data')
          ? { items: [{ account: 'privacy@example.test', password: 'export-secret', twofa: 'export-seed' }], total: 1 }
          : { items: [{ id: 'old', filename: 'old-export.txt', row_count: 1,
            created_at: '2026-09-08T00:00:00Z', expires_at: '2026-10-08T00:00:00Z', expired: false }], total: 1 }
      }
      await route.fulfill({ json: { code: 0, msg: 'ok', data } })
    })
    await page.goto(`${process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173'}/__admin_privacy_smoke`)
    await page.evaluate(async () => {
      await import('/src/styles.css')
      const entry = await (await fetch('/src/main.ts')).text()
      for (const match of entry.matchAll(/import "([^\"]*(?:message|message-box|notification)[^\"]*)"/g)) await import(match[1])
      const source = await (await fetch('/src/views/AccountCenterView.vue')).text()
      const { createApp, h, ref } = await import(source.match(/from "(\/node_modules\/\.vite\/deps\/vue\.js[^"]*)"/)[1])
      const { createRouter, createMemoryHistory } = await import(source.match(/from "(\/node_modules\/\.vite\/deps\/vue-router\.js[^"]*)"/)[1])
      const authSource = await (await fetch('/src/stores/auth.ts')).text()
      const { createPinia } = await import(authSource.match(/from "(\/node_modules\/\.vite\/deps\/pinia\.js[^"]*)"/)[1])
      const { useAuthStore } = await import('/src/stores/auth.ts')
      const { default: Center } = await import('/src/views/AccountCenterView.vue')
      const { default: Records } = await import('/src/components/AccountExportRecords.vue')
      const pinia = createPinia()
      const auth = useAuthStore(pinia)
      const mode = ref('center')
      const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/accounts', component: Center }] })
      await router.push('/accounts')
      await router.isReady()
      window.setPrivacyRole = (admin, totp = true) => {
        auth.user = { id: 'smoke', username: 'admin', display_name: 'Privacy test',
          roles: admin ? ['super_admin'] : ['operator'],
          permissions: ['accounts.view', 'accounts.batch', 'accounts.credentials', 'accounts.export', ...(totp ? ['accounts.totp'] : [])] }
      }
      window.privacyMode = value => { mode.value = value }
      window.setPrivacyRole(false)
      window.privacyClipboard = ''
      Object.defineProperty(navigator, 'clipboard', { configurable: true,
        value: { writeText: async value => { window.privacyClipboard = value } } })
      createApp({ setup: () => () => h(mode.value === 'center' ? Center : Records) }).use(pinia).use(router).mount('#app')
    })
    await page.getByText('privacy@example.test', { exact: true }).waitFor()
    assert.equal(await page.getByText('无凭据读取权限', { exact: true }).count(), 2)
    assert.equal(await page.getByRole('tab', { name: '导出记录' }).count(), 0)
    assert.equal(await page.getByRole('button', { name: '导出账号', exact: true }).count(), 0)
    assert.equal(await page.getByRole('button', { name: '复制密码', exact: true }).isDisabled(), true)
    assert.equal(await page.getByRole('button', { name: '复制 2FA', exact: true }).isDisabled(), true)
    assert.equal(await page.getByText('private-password', { exact: true }).count(), 0)
    assert.equal(await page.getByText('JBSWY3DPEHPK3PXP', { exact: true }).count(), 0)
    await page.getByRole('button', { name: '查看 2FA 验证码', exact: true }).click()
    await page.getByText('123 456', { exact: true }).waitFor()
    await page.getByRole('button', { name: '复制验证码', exact: true }).click()
    assert.equal(await page.evaluate(() => window.privacyClipboard), '123456')
    assert.equal(totpRequests, 1)
    await page.waitForTimeout(350)
    await page.screenshot({ path: 'logs/account-admin-privacy-operator.png', fullPage: true })
    await page.evaluate(() => window.setPrivacyRole(false, false))
    await page.getByText('123 456', { exact: true }).waitFor({ state: 'hidden' })
    assert.equal(await page.getByRole('button', { name: '查看 2FA 验证码', exact: true }).isDisabled(), true)
    assert.equal(totpRequests, 1)

    await page.evaluate(() => window.setPrivacyRole(true))
    await page.getByText('private-password', { exact: true }).waitFor()
    await page.getByRole('tab', { name: '导出记录' }).waitFor()
    await page.locator('.resource-table--accountIdentities .el-checkbox:visible').first().click()
    await page.getByRole('button', { name: '导出账号', exact: true }).waitFor()
    await page.getByRole('button', { name: '复制密码', exact: true }).click()
    assert.equal(await page.evaluate(() => window.privacyClipboard), 'private-password')
    await page.evaluate(() => window.setPrivacyRole(false))
    await page.getByText('private-password', { exact: true }).waitFor({ state: 'hidden' })
    assert.equal(await page.getByRole('button', { name: '导出账号', exact: true }).count(), 0)

    await page.evaluate(() => window.privacyMode('records'))
    await page.getByText('当前账号没有导出权限', { exact: true }).waitFor()
    assert.equal(exportRequests, 0)
    await page.evaluate(() => window.setPrivacyRole(true))
    await page.getByText('old-export.txt', { exact: true }).waitFor()
    await page.getByRole('button', { name: '查看导出数据', exact: true }).click()
    await page.getByText('export-secret', { exact: true }).waitFor()
    await page.evaluate(() => window.setPrivacyRole(false))
    await page.getByText('export-secret', { exact: true }).waitFor({ state: 'hidden' })
    assert.equal(await page.getByText('old-export.txt', { exact: true }).count(), 0)
    assert.equal(exportRequests, 2)
    await page.evaluate(() => window.privacyMode('center'))
    await page.getByText('privacy@example.test', { exact: true }).waitFor()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(350)
    await page.screenshot({ path: 'logs/account-admin-privacy-mobile.png', fullPage: true })
    assert.deepEqual(errors, [])
    console.log('Privacy smoke passed: stale grants/data blocked, super-admin credentials/export, operator TOTP, revoked preview cleared, desktop/mobile')
  } finally { await browser.close() }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
