const assert = require('node:assert/strict')
const { resolve } = require('node:path')
const { spawnSync } = require('node:child_process')
const { chromium } = require('playwright')

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    page.setDefaultTimeout(10000)
    const submitted = []
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/__account_import_smoke', route => route.fulfill({ contentType: 'text/html',
      body: '<html><body><div id="app"></div></body></html>' }))
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname
      if (!path.startsWith('/api/')) return route.continue()
      let data = { items: [], total: 0 }
      if (path === '/api/accounts/import') {
        const body = route.request().postDataJSON()
        submitted.push(body)
        // Validate the real schema, without calling import services or a database.
        const check = spawnSync(resolve('../.venv/Scripts/python.exe'), ['-c',
          'import sys; from app.schemas.account import AccountImportRequest; AccountImportRequest.model_validate_json(sys.stdin.read())'],
          { cwd: resolve('..'), input: JSON.stringify(body), encoding: 'utf8',
            env: { ...process.env, PYTHONUTF8: '1' } })
        if (check.status !== 0) {
          console.error(check.stderr || check.error)
          return route.fulfill({ status: 422, json: { code: 42200, msg: '账号类型校验失败', data: null } })
        }
        data = { total_count: 1, created_count: 1, failed_count: 0 }
      }
      await route.fulfill({ json: { code: 0, msg: 'ok', data } })
    })
    await page.goto('http://127.0.0.1:5173/__account_import_smoke')
    await page.evaluate(async () => {
      await import('/src/styles.css')
      const entry = await (await fetch('/src/main.ts')).text()
      for (const match of entry.matchAll(/import "([^\"]*(?:message|message-box|notification)[^\"]*)"/g)) await import(match[1])
      const source = await (await fetch('/src/components/CrudPage.vue')).text()
      const authSource = await (await fetch('/src/stores/auth.ts')).text()
      const { createApp, h } = await import(source.match(/from "(\/node_modules\/\.vite\/deps\/vue\.js[^"]*)"/)[1])
      const { createPinia } = await import(authSource.match(/from "(\/node_modules\/\.vite\/deps\/pinia\.js[^"]*)"/)[1])
      const { useAuthStore } = await import('/src/stores/auth.ts')
      const { resources } = await import('/src/config/resources.ts')
      const { buildAccountIdentityResource } = await import('/src/config/accountIdentityResource.ts')
      const { default: Component } = await import('/src/components/CrudPage.vue')
      const pinia = createPinia()
      useAuthStore(pinia).user = { roles: [], permissions: ['accounts.view', 'accounts.create'] }
      const config = buildAccountIdentityResource(resources.accounts)
      config.filters = []
      createApp({ setup: () => () => h(Component, { config }) }).use(pinia).mount('#app')
    })
    for (const [label, value] of [['新号', 'new'], ['老号', 'old'], ['未知', 'unknown']]) {
      await page.getByRole('button', { name: '导入账号', exact: true }).click()
      const dialog = page.locator('.el-dialog:visible')
      const type = dialog.locator('.el-form-item').filter({ has: page.locator('.el-form-item__label', { hasText: /^账号类型$/ }) })
      await type.getByRole('combobox').click()
      await page.getByRole('option', { name: label, exact: true }).click()
      await dialog.locator('textarea').fill('demo@example.test---test-password---JBSWY3DPEHPK3PXP')
      await dialog.getByRole('button', { name: '保存', exact: true }).click()
      await dialog.waitFor({ state: 'hidden' })
      assert.equal(submitted.at(-1).account_age_type, value)
    }
    assert.deepEqual(errors, [])
    assert.equal(submitted.length, 3)
    console.log('PASS: real import form sends all three account types; real backend schema accepts; zero real accounts imported')
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
