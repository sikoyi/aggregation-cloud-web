// Mocked APIs only; no real script or template mutation.
const assert = require('node:assert/strict')
const { mkdirSync } = require('node:fs')
const { chromium } = require('playwright')

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const errors = [], writes = []
    page.on('pageerror', error => errors.push(error.stack || error.message))
    await page.route('**/__batch_style', route => route.fulfill({ contentType: 'text/html',
      body: '<!doctype html><html><meta name="viewport" content="width=device-width, initial-scale=1"><body><div id="app"></div></body></html>' }))
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname
      if (!path.startsWith('/api/')) return route.continue()
      if (route.request().method() !== 'GET') writes.push(path)
      const record = { id: '1', name: 'Example', script_key: 'example', script_name: 'Example script',
        status: 'enabled', can_manage: true, execution_count: 1, execution_mode: 'immediate',
        business_platform: 'threads', runtime_platform: 'fingerprint_browser', provider: 'morelogin',
        supported_business_platforms: ['threads'], supported_runtime_platforms: ['fingerprint_browser'],
        supported_providers: ['morelogin'], default_params: {} }
      const data = ['/api/scripts', '/api/task-templates'].includes(path)
        ? { items: [record], total: 1, page: 1, page_size: 20 } : { items: [], total: 0 }
      return route.fulfill({ json: { code: 0, msg: 'ok', data } })
    })
    await page.goto((process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173') + '/__batch_style')
    await page.evaluate(async () => {
      await import('/node_modules/element-plus/dist/index.css')
      await import('/node_modules/element-plus/theme-chalk/dark/css-vars.css')
      await import('/src/styles.css')
      await import('/src/theme.css')
      const source = await (await fetch('/src/components/CrudPage.vue')).text()
      const { createApp, h, ref } = await import(source.match(/from "(\/node_modules\/\.vite\/deps\/vue\.js[^"]*)"/)[1])
      const authSource = await (await fetch('/src/stores/auth.ts')).text()
      const { createPinia } = await import(authSource.match(/from "(\/node_modules\/\.vite\/deps\/pinia\.js[^"]*)"/)[1])
      const { useAuthStore } = await import('/src/stores/auth.ts')
      const { resources } = await import('/src/config/resources.ts')
      const { default: CrudPage } = await import('/src/components/CrudPage.vue')
      const key = ref('scripts'), pinia = createPinia(), auth = useAuthStore(pinia)
      window.setBatchView = value => { key.value = value }
      window.setBatchRole = readonly => {
        auth.user = { id: 'operator', roles: readonly ? [] : ['super_admin'],
          permissions: readonly ? ['scripts.view', 'templates.view'] : [] }
      }
      window.setBatchRole(false)
      createApp({ setup: () => () => h(CrudPage, { key: key.value, config: resources[key.value] }) }).use(pinia).mount('#app')
    })
    mkdirSync('logs', { recursive: true })
    for (const [key, unit] of [['scripts', '个脚本'], ['taskTemplates', '个模板']]) {
      await page.evaluate(key => window.setBatchView(key), key)
      const toolbar = page.locator('.batch-toolbar--persistent')
      await toolbar.getByText(unit, { exact: true }).waitFor()
      const row = page.locator('.el-table__body-wrapper .el-table__row').first()
      await row.waitFor()
      assert.equal(await toolbar.locator('strong').innerText(), '0')
      assert(await toolbar.getByRole('button').evaluateAll(nodes => nodes.every(node => node.disabled)))
      assert.equal(await toolbar.getByText('取消选择').count(), 0)
      assert.equal(await toolbar.evaluate(node => getComputedStyle(node).minHeight), '52px')
      await row.locator('.el-checkbox').click()
      assert.equal(await toolbar.locator('strong').innerText(), '1')
      assert(await toolbar.getByRole('button').evaluateAll(nodes => nodes.every(node => !node.disabled)))
      await row.locator('.el-checkbox').click()
      assert.equal(await toolbar.locator('strong').innerText(), '0')
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 })
        for (const dark of [false, true]) {
          await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark)
          assert(await toolbar.evaluate(node => node.scrollWidth <= node.clientWidth))
          await toolbar.screenshot({ path: `logs/${key}-batch-${width}-${dark ? 'dark' : 'light'}.png` })
        }
      }
      await page.evaluate(() => window.setBatchRole(true))
      await toolbar.waitFor({ state: 'hidden' })
      await page.evaluate(() => window.setBatchRole(false))
      await page.setViewportSize({ width: 1440, height: 1000 })
    }
    assert.deepEqual(errors, [])
    assert.deepEqual(writes, [])
    console.log('PASS: persistent script/template batch bars, selection, permissions, light/dark, desktop/mobile')
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
