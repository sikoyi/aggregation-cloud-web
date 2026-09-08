// Synthetic resources only. No customer plaintext or real account/registration mutations.
const assert = require('node:assert/strict')
const { chromium } = require('playwright')

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
    page.setDefaultTimeout(10000)
    const errors = [], mutations = []
    let fail = false, hold = false, release = null
    const secret = 'SYNTHETIC-REGISTRATION-PRIVATE-DATA'
    const fields = [{ field_key: 'first_name', display_name: '姓名', data_type: 'string', sensitive: false },
      { field_key: 'ssn', display_name: 'SSN', data_type: 'string', sensitive: true },
      { field_key: 'address', display_name: '个人地址', data_type: 'string', sensitive: true }]
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/__registration_privacy_smoke', route => route.fulfill({ contentType: 'text/html',
      body: '<html><meta name="viewport" content="width=device-width, initial-scale=1"><body><div id="app"></div></body></html>' }))
    await page.route('**/api/**', async route => {
      const req = route.request(), path = new URL(req.url()).pathname
      if (!path.startsWith('/api/')) return route.continue()
      let data = { items: [], total: 0, page: 1, page_size: 20 }
      if (req.method() !== 'GET') {
        mutations.push(path)
        assert.ok(path.endsWith('/reveal'), `Unexpected mutation ${path}`)
        if (hold) await new Promise(resolve => { release = resolve })
        if (fail) return route.fulfill({ status: 503, json: { code: 50000, msg: '资料加密密钥未正确配置，请联系管理员' } })
        data = { id: 'r1', row_number: 2, payload: { first_name: 'Synthetic User', ssn: secret, address: 'LongAddressWithoutSpaces'.repeat(12) } }
      } else if (path.endsWith('/templates')) {
        data = [{ id: 'v1', template_key: 'shopify_registration', version: 1, name: 'Shopify 注册资源', business_platform: 'shopify', status: 'enabled', fields }]
      } else if (path.endsWith('/batches')) {
        data = { ...data, total: 1, items: [{ id: 'b1', template_id: 'v1', template_name: 'Shopify 注册资源', template_version: 1,
          business_platform: 'shopify', name: '隐私测试批次', source_filename: 'synthetic.xlsx', total_count: 2, available_count: 2,
          used_count: 0, invalid_count: 0, validation_errors: [], created_at: '2026-09-08T01:00:00Z' }] }
      } else if (path.endsWith('/resources')) {
        // Deliberately advertise permission on the row; operator role still must not get a reveal button.
        data = { ...data, total: 2, items: ['r1', 'r2'].map((id, index) => ({ id, template_id: 'v1', batch_id: 'b1', row_number: index + 2,
          payload: { first_name: '******', ssn: '******', address: '******' }, status: 'unused', can_reveal: true })) }
      }
      await route.fulfill({ json: { code: 0, msg: 'ok', data } })
    })
    await page.goto(`${process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173'}/__registration_privacy_smoke`)
    await page.evaluate(async () => {
      await import('/src/styles.css')
      const entry = await (await fetch('/src/main.ts')).text()
      for (const match of entry.matchAll(/import "([^\"]*(?:message|message-box|notification)[^\"]*)"/g)) await import(match[1])
      const source = await (await fetch('/src/views/RegistrationResourcesView.vue')).text()
      const { createApp, h } = await import(source.match(/from "(\/node_modules\/\.vite\/deps\/vue\.js[^"]*)"/)[1])
      const authSource = await (await fetch('/src/stores/auth.ts')).text()
      const { createPinia } = await import(authSource.match(/from "(\/node_modules\/\.vite\/deps\/pinia\.js[^"]*)"/)[1])
      const { useAuthStore } = await import('/src/stores/auth.ts')
      const { default: View } = await import('/src/views/RegistrationResourcesView.vue')
      const pinia = createPinia(), auth = useAuthStore(pinia)
      window.setResourceRole = role => { auth.user = { id: 'operator', tenant_id: 't', username: 'operator', roles: [role],
        permissions: ['registration_resources.view', 'registration_resources.create', 'registration_resources.reveal'] } }
      window.setResourceRole('operator')
      createApp({ setup: () => () => h(View) }).use(pinia).mount('#app')
    })
    await page.getByRole('button', { name: '查看资料', exact: true }).click()
    await page.locator('.el-drawer:visible .el-table__row').nth(1).waitFor()
    await page.waitForFunction(() => !document.querySelector('.el-drawer .el-loading-mask'))
    await page.mouse.move(10, 10)
    assert.equal(await page.getByRole('button', { name: '查看原文', exact: true }).count(), 0)
    assert.equal(mutations.length, 0)
    assert.ok(!(await page.textContent('body')).includes(secret))
    await page.screenshot({ path: 'logs/registration-resource-operator.png', fullPage: true, animations: 'disabled' })

    await page.evaluate(() => window.setResourceRole('super_admin'))
    const reveal = page.getByRole('button', { name: '查看原文', exact: true }).first()
    await reveal.click()
    const dialog = page.locator('.el-dialog:visible').last()
    await dialog.getByText(secret, { exact: true }).waitFor()
    assert.equal(mutations.length, 1)
    await page.screenshot({ path: 'logs/registration-resource-admin.png', fullPage: true, animations: 'disabled' })
    await page.setViewportSize({ width: 390, height: 844 })
    const bounds = await dialog.boundingBox()
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390)
    const overflow = await dialog.locator('.resource-plaintext').evaluate(el => el.scrollWidth > el.clientWidth + 1)
    assert.equal(overflow, false)
    await page.screenshot({ path: 'logs/registration-resource-mobile.png', fullPage: true, animations: 'disabled' })
    await dialog.getByRole('button', { name: '关闭', exact: true }).click()
    assert.ok(!(await page.textContent('body')).includes(secret))
    assert.ok(!(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).includes(secret))
    await page.setViewportSize({ width: 1600, height: 1000 })

    fail = true
    await reveal.click()
    await dialog.getByRole('alert').waitFor()
    assert.ok(!(await page.textContent('body')).includes(secret))
    fail = false
    await dialog.getByRole('button', { name: '重新加载', exact: true }).click()
    await dialog.getByText(secret, { exact: true }).waitFor()
    await page.evaluate(() => window.setResourceRole('operator'))
    assert.ok(!(await page.textContent('body')).includes(secret))
    assert.equal(await page.getByRole('button', { name: '查看原文', exact: true }).count(), 0)

    await page.evaluate(() => window.setResourceRole('super_admin'))
    hold = true
    const started = page.waitForRequest(req => req.method() === 'POST' && req.url().endsWith('/reveal'))
    await reveal.click()
    await started
    await dialog.getByRole('button', { name: '关闭', exact: true }).click()
    const finished = page.waitForResponse(res => res.url().endsWith('/reveal'))
    release()
    await finished
    await page.waitForTimeout(150)
    assert.ok(!(await page.textContent('body')).includes(secret))
    assert.deepEqual(errors, [])
    console.log('PASS: operator masking, admin reveal, audit request, error retry, revoke/close cleanup and desktop/mobile layout')
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
