// Read-only UI smoke: synthetic accounts and intercepted API, no database writes.
const assert = require('node:assert/strict')
const { chromium } = require('playwright')

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/__avatar_smoke', route => route.fulfill({ contentType: 'text/html', body: '<div id="app"></div>' }))
    await page.route('**/bad-avatar.png', route => route.fulfill({ status: 404, body: '' }))
    await page.route('**/api/account-identities/demo/accounts*', route => route.fulfill({ json: { code: 0, data: { items: [
      { id: '1', business_platform: 'threads', display_name: 'Threads Name', username: 'long-account-name@example.test', avatar_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=' },
      { id: '2', business_platform: 'instagram', display_name: 'Instagram Name', avatar_url: '/bad-avatar.png' },
      { id: '3', business_platform: 'shopify', display_name: 'Shopify Name' },
    ] } } }))
    await page.goto('http://127.0.0.1:5173/__avatar_smoke')
    await page.evaluate(async () => {
      await import('/src/styles.css')
      const source = await (await fetch('/src/components/AccountIdentityPlatformDetails.vue')).text()
      const authSource = await (await fetch('/src/stores/auth.ts')).text()
      const { createApp, h } = await import(source.match(/from "(\/node_modules\/\.vite\/deps\/vue\.js[^"]*)"/)[1])
      const { createPinia } = await import(authSource.match(/from "(\/node_modules\/\.vite\/deps\/pinia\.js[^"]*)"/)[1])
      const { useAuthStore } = await import('/src/stores/auth.ts')
      const { default: Details } = await import('/src/components/AccountIdentityPlatformDetails.vue')
      const { default: Parent } = await import('/src/components/AccountIdentityTableCell.vue')
      const pinia = createPinia()
      useAuthStore(pinia).user = { roles: [], permissions: ['accounts.view'] }
      createApp({ setup: () => () => h('div', [
        h(Parent, { kind: 'loginIdentity', row: { id: 'demo', login_username: 'demo@example.test', account_count: 3 } }),
        h(Details, { identityId: 'demo' }),
      ]) }).use(pinia).mount('#app')
    })
    await page.locator('.platform-account-identity__avatar').nth(2).waitFor()
    await page.waitForFunction(() => document.querySelectorAll('.platform-account-identity__avatar img').length === 1)
    assert.equal(await page.locator('.identity-main svg, .identity-main img, .identity-main .el-avatar').count(), 0)
    assert.equal(await page.locator('.platform-account-identity__avatar').nth(1).innerText(), 'I')
    assert.equal(await page.locator('.platform-account-identity__avatar').nth(2).innerText(), 'S')
    for (const width of [1440, 768]) {
      await page.setViewportSize({ width, height: 900 })
      const sizes = await page.locator('.platform-account-identity__avatar').evaluateAll(nodes => nodes.map(node => {
        const rect = node.getBoundingClientRect()
        return [rect.width, rect.height]
      }))
      for (const size of sizes) assert.deepEqual(size, [34, 34])
      await page.screenshot({ path: `logs/account-avatar-${width}.png`, fullPage: true })
    }
    assert.deepEqual(errors, [])
    console.log('PASS: parent without avatar; platform image and missing/broken fallback; 34px at 1440/768; no writes')
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
