// All resource data and deletes are mocked.
const assert = require('node:assert/strict')
const { mkdirSync } = require('node:fs')
const { chromium } = require('playwright')
async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const errors = [], deleted = []
    let rows = ['available', 'reserved'].map(id => ({ id, name: id, template_id: 't', template_name: 'Template',
      template_version: 1, source_filename: 'synthetic.xlsx', total_count: 1, available_count: 1, used_count: 0,
      invalid_count: 0, business_platform: 'shopify', validation_errors: [] }))
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/__registration_batch', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><meta name="viewport" content="width=device-width, initial-scale=1"><body><div id="app"></div></body></html>' }))
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname
      if (!path.startsWith('/api/')) return route.continue()
      if (route.request().method() === 'DELETE') {
        const id = path.split('/').pop()
        deleted.push(id)
        if (id === 'reserved') return route.fulfill({ status: 409, json: { code: 409, msg: '批次存在已预留或已使用资源，不能删除' } })
        rows = rows.filter(row => row.id !== id)
      }
      return route.fulfill({ json: { code: 0, msg: 'ok', data: path.endsWith('/templates') ? [] : { items: rows, total: rows.length } } })
    })
    await page.goto((process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173') + '/__registration_batch')
    await page.evaluate(async () => {
      await import('/node_modules/element-plus/dist/index.css')
      await import('/node_modules/element-plus/theme-chalk/dark/css-vars.css')
      await import('/src/styles.css')
      await import('/src/theme.css')
      const source = await (await fetch('/src/views/RegistrationResourcesView.vue')).text()
      const { createApp, h } = await import(source.match(/from "(\/node_modules\/\.vite\/deps\/vue\.js[^"]*)"/)[1])
      const authSource = await (await fetch('/src/stores/auth.ts')).text()
      const { createPinia } = await import(authSource.match(/from "(\/node_modules\/\.vite\/deps\/pinia\.js[^"]*)"/)[1])
      const { useAuthStore } = await import('/src/stores/auth.ts')
      const { default: View } = await import('/src/views/RegistrationResourcesView.vue')
      const pinia = createPinia(), auth = useAuthStore(pinia)
      window.setBatchDeletePermission = allowed => { auth.user = { id: 'operator', roles: [], permissions: ['registration_resources.view', ...(allowed ? ['registration_resources.delete'] : [])] } }
      window.setBatchDeletePermission(true)
      createApp({ setup: () => () => h(View) }).use(pinia).mount('#app')
    })
    const bar = page.locator('.registration-batch-bar'), button = bar.getByRole('button', { name: '批量删除', exact: true })
    await page.getByText('available', { exact: true }).waitFor()
    assert(await button.isDisabled())
    const selectAll = () => page.locator('.el-table__header-wrapper .el-checkbox').first().click()
    await selectAll()
    await button.click()
    await page.getByRole('button', { name: '取消', exact: true }).click()
    assert.deepEqual(deleted, [])
    assert.equal(await bar.locator('strong').innerText(), '2')
    mkdirSync('logs', { recursive: true })
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      for (const dark of [false, true]) {
        await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark)
        assert(await bar.evaluate(node => node.scrollWidth <= node.clientWidth))
        await bar.screenshot({ path: `logs/registration-batch-${width}-${dark ? 'dark' : 'light'}.png` })
      }
    }
    await button.click()
    await page.getByRole('button', { name: '确认删除', exact: true }).click()
    await page.getByRole('dialog', { name: '批量删除结果：成功 1，失败 1' }).waitFor()
    await page.getByText('批次存在已预留或已使用资源，不能删除', { exact: true }).waitFor()
    assert.deepEqual(deleted, ['available', 'reserved'])
    await page.waitForFunction(() => document.querySelector('.registration-batch-bar strong')?.textContent === '0')
    await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).last().click()
    await page.evaluate(() => window.setBatchDeletePermission(false))
    await bar.waitFor({ state: 'hidden' })
    assert.deepEqual(errors, [])
    console.log('PASS: empty selection, cancel, partial failure, result details, selection reset, permissions, light/dark/mobile')
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
