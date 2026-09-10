const assert = require('node:assert/strict')
const { chromium } = require('playwright')

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
    const errors = []
    let calls = 0
    let delayed
    page.on('pageerror', e => errors.push(e.message))
    await page.route('**/__credential_reveal_smoke', route => route.fulfill({ contentType: 'text/html',
      body: '<html><meta name="viewport" content="width=device-width, initial-scale=1"><body><div id="app"></div></body></html>' }))
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url())
      if (!url.pathname.startsWith('/api/')) return route.continue()
      if (url.pathname.endsWith('/credentials/reveal')) {
        calls++
        const body = route.request().postDataJSON()
        assert.equal(route.request().method(), 'POST')
        assert.deepEqual(Object.keys(body), ['admin_password'])
        if (body.admin_password === 'slow-password') await new Promise(resolve => { delayed = resolve })
        if (!['root-password', 'slow-password'].includes(body.admin_password)) {
          return route.fulfill({ status: 403, json: { code: 40300, msg: '系统内置管理员密码不正确' } })
        }
        return route.fulfill({ json: { code: 0, data: {
          id: url.pathname.split('/')[3], password_secret_ref: 'single-view-password', totp_secret_ref: 'single-view-2fa-seed',
        } } })
      }
      await route.fulfill({ json: { code: 0, data: {} } })
    })
    await page.goto(`${process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173'}/__credential_reveal_smoke`)
    await page.evaluate(async () => {
      await import('/src/styles.css')
      const source = await (await fetch('/src/components/AccountTableCell.vue')).text()
      const { createApp, h, reactive } = await import(source.match(/from "(\/node_modules\/\.vite\/deps\/vue\.js[^"]*)"/)[1])
      const authSource = await (await fetch('/src/stores/auth.ts')).text()
      const { createPinia } = await import(authSource.match(/from "(\/node_modules\/\.vite\/deps\/pinia\.js[^"]*)"/)[1])
      const { useAuthStore } = await import('/src/stores/auth.ts')
      const { default: Cell } = await import('/src/components/AccountTableCell.vue')
      const pinia = createPinia()
      const auth = useAuthStore(pinia)
      const row = reactive({ id: 'a', login_username: 'synthetic-account@example.test', has_totp: true,
        can_read_credentials: true, password_secret_ref: 'stale-list-password', totp_secret_ref: 'stale-list-2fa' })
      window.setRevealRole = role => {
        auth.user = { id: role, username: role, status: 'active', is_system_admin: role === 'builtin',
          roles: role === 'operator' ? ['operator'] : ['super_admin'], permissions: ['accounts.view', 'accounts.totp'] }
      }
      window.changeRevealAccount = id => { row.id = id }
      window.setRevealRole('other-admin')
      createApp({ setup: () => () => h('main', { style: 'margin:32px 16px;max-width:320px' }, [
        h('h3', '账号凭据'), h(Cell, { kind: 'accountCredentials', column: { key: 'password_secret_ref', label: '凭据' }, row, sharedCredentials: true }),
      ]) }).use(pinia).mount('#app')
    })
    const open = () => page.getByRole('button', { name: '验证密码查看当前账号凭据', exact: true }).click()
    const input = () => page.getByRole('textbox', { name: '系统内置管理员登录密码', exact: true })
    const submit = () => page.getByRole('button', { name: '验证并查看', exact: true }).click()
    const close = () => page.getByRole('button', { name: '关闭', exact: true }).click()
    await page.getByRole('button', { name: '验证密码查看当前账号凭据' }).waitFor()
    assert.equal(await page.getByText('stale-list-password', { exact: true }).count(), 0)
    assert.equal(await page.getByText('stale-list-2fa', { exact: true }).count(), 0)
    for (const width of [1400, 390]) {
      await page.setViewportSize({ width, height: 900 })
      await open()
      await input().fill('wrong')
      await submit()
      await page.getByText('系统内置管理员密码不正确', { exact: true }).waitFor()
      assert.equal(await input().inputValue(), '')
      await input().fill('root-password'); await submit()
      await page.getByText('single-view-password', { exact: true }).waitFor()
      await page.getByText('single-view-2fa-seed', { exact: true }).waitFor()
      const box = await page.getByRole('dialog').boundingBox()
      assert(box.x >= 0 && box.x + box.width <= width)
      await page.screenshot({ path: `logs/account-credential-reveal-${width}.png`, fullPage: true })
      await close()
      await page.getByText('single-view-password', { exact: true }).waitFor({ state: 'hidden' })
      await open()
      assert.equal(await input().inputValue(), '')
      assert.equal(await page.getByText('single-view-password', { exact: true }).count(), 0)
      await close()
    }
    await open(); await input().fill('slow-password'); await submit()
    await page.waitForFunction(() => document.querySelector('.el-button.is-loading'))
    await close()
    while (!delayed) await page.waitForTimeout(20)
    delayed()
    await page.waitForTimeout(200)
    assert.equal(await page.getByText('single-view-password', { exact: true }).count(), 0)
    await open(); await input().fill('root-password'); await submit()
    await page.getByText('single-view-password', { exact: true }).waitFor()
    await page.evaluate(() => window.changeRevealAccount('b'))
    await page.getByText('single-view-password', { exact: true }).waitFor({ state: 'hidden' })
    await open(); await input().fill('root-password'); await submit()
    await page.getByText('single-view-password', { exact: true }).waitFor()
    await page.evaluate(() => window.setRevealRole('operator'))
    await page.getByText('single-view-password', { exact: true }).waitFor({ state: 'hidden' })
    assert.equal(await page.getByRole('button', { name: '验证密码查看当前账号凭据' }).count(), 0)
    assert.equal(await page.getByRole('button', { name: '查看 2FA 验证码' }).isDisabled(), false)
    await page.evaluate(() => window.setRevealRole('builtin'))
    await page.getByText('stale-list-password', { exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: '验证密码查看当前账号凭据' }).count(), 0)
    assert.deepEqual(errors, [])
    console.log(JSON.stringify({ ok: true, requests: calls, viewports: [1400, 390], errors }))
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
