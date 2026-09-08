const { chromium } = require('playwright')
const assert = require('node:assert/strict')

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    let previewRequests = 0
    const active = { id: 'active', filename: 'demo.txt', row_count: 21, created_at: '2026-09-07T00:00:00Z', expires_at: '2026-10-07T00:00:00Z', expired: false }
    await page.route('**/__export_records_smoke', route => route.fulfill({ contentType: 'text/html', body: '<html><meta name="viewport" content="width=device-width, initial-scale=1"><body><div id="app"></div></body></html>' }))
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url())
      if (!url.pathname.startsWith('/api/')) return route.continue()
      if (url.pathname.endsWith('/download')) {
        return route.fulfill({ contentType: 'text/plain', headers: { 'Content-Disposition': 'attachment; filename="demo.txt"' }, body: 'account---password---2fa---url\r\n' })
      }
      let data
      if (url.pathname.endsWith('/data')) {
        previewRequests++
        data = { items: [{ account: `page-${url.searchParams.get('page')}`, password: 'demo-password', twofa: '001234', profile_url: 'https://example.test' }], total: 21 }
        if (url.pathname.includes('/xlsx/')) Object.assign(data.items[0], { business_platform: 'shopify', email_address: 'demo@example.test', email_password: 'mail-password', refresh_token: 'demo-refresh-token', client_id: 'demo-client' })
      } else data = { items: [active, { ...active, id: 'expired', filename: 'expired.txt', expired: true }, { ...active, id: 'xlsx', filename: 'demo.xlsx' }, { ...active, id: 'pending', filename: 'pending.xlsx', pending: true }], total: 4 }
      return route.fulfill({ json: { code: 0, msg: 'ok', data } })
    })
    await page.goto(`${process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173'}/__export_records_smoke`)
    await page.evaluate(async () => {
      await import('/src/styles.css')
      const source = await (await fetch('/src/components/AccountExportRecords.vue')).text()
      const vuePath = source.match(/from "(\/node_modules\/\.vite\/deps\/vue\.js[^"]*)"/)[1]
      const { createApp, h } = await import(vuePath)
      const authSource = await (await fetch('/src/stores/auth.ts')).text()
      const { createPinia } = await import(authSource.match(/from "(\/node_modules\/\.vite\/deps\/pinia\.js[^"]*)"/)[1])
      const { useAuthStore } = await import('/src/stores/auth.ts')
      const { default: Component } = await import('/src/components/AccountExportRecords.vue')
      const pinia = createPinia()
      useAuthStore(pinia).user = { roles: ['super_admin'], permissions: [] }
      createApp({ setup: () => () => h(Component) }).use(pinia).mount('#app')
    })
    const view = page.getByRole('button', { name: '查看导出数据', exact: true })
    await view.first().waitFor()
    assert.equal(previewRequests, 0)
    assert.equal(await view.nth(1).isDisabled(), true)
    assert.equal(await page.getByRole('button', { name: '下载原文件', exact: true }).nth(1).isDisabled(), true)
    await view.first().click()
    const dialog = page.locator('.el-dialog:visible')
    await dialog.getByText('page-1', { exact: true }).waitFor()
    await dialog.getByText('未记录', { exact: true }).waitFor()
    await dialog.locator('.btn-next').click()
    await dialog.getByText('page-2', { exact: true }).waitFor()
    assert.equal(previewRequests, 2)
    await page.screenshot({ path: 'logs/account-export-records-desktop.png' })
    await dialog.locator('.el-dialog__headerbtn').click()
    await dialog.waitFor({ state: 'hidden' })
    assert.equal(await page.getByText('demo-password', { exact: true }).count(), 0)
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: '下载原文件', exact: true }).first().click()
    assert.equal((await download).suggestedFilename(), 'demo.txt')
    assert.equal(await view.nth(3).isDisabled(), true)
    assert.equal(await page.getByRole('button', { name: '下载原文件', exact: true }).nth(3).isDisabled(), true)
    await view.nth(2).click()
    await dialog.getByText('demo-refresh-token', { exact: true }).waitFor()
    await dialog.getByText('mail-password', { exact: true }).waitFor()
    await dialog.getByText('Shopify', { exact: true }).waitFor()
    await page.waitForTimeout(700)
    await page.screenshot({ path: 'logs/account-export-email-preview.png' })
    await dialog.locator('.el-dialog__headerbtn').click()
    await dialog.waitFor({ state: 'hidden' })
    assert.equal(await page.getByText('demo-refresh-token', { exact: true }).count(), 0)
    await page.setViewportSize({ width: 390, height: 844 })
    await view.first().click()
    await dialog.getByText('page-1', { exact: true }).waitFor()
    const bounds = await dialog.boundingBox()
    assert.ok(bounds.width <= 390)
    await page.waitForTimeout(400)
    await page.screenshot({ path: 'logs/account-export-records-mobile.png' })
    assert.deepEqual(errors, [])
    console.log('Export records smoke passed: lazy preview, paging, expired actions, download, clearing secrets, desktop/mobile')
  } finally {
    await browser.close()
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
