// Read-only component smoke with synthetic multi-platform device data.
const assert = require('node:assert/strict')
const { chromium } = require('playwright')
async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
    await page.route('**/__device_layout', route => route.fulfill({ contentType: 'text/html', body: '<div id="app"></div>' }))
    await page.goto('http://127.0.0.1:5173/__device_layout')
    await page.evaluate(async () => {
      await import('/src/styles.css')
      const source = await (await fetch('/src/components/DeviceTableCell.vue')).text()
      const { createApp, h } = await import(source.match(/from "(\/node_modules\/\.vite\/deps\/vue\.js[^"]*)"/)[1])
      const { default: Cell } = await import('/src/components/DeviceTableCell.vue')
      const row = { status: 'offline', account_sessions: [
        { id: '1', account_id: '5278', business_platform: 'instagram', account_username: 'choejunho214', login_status: 'logged_in' },
        { id: '2', account_id: '5277', business_platform: 'threads', account_username: 'different-long-username@example.test', login_status: 'not_logged_in' },
      ] }
      createApp({ setup: () => () => h('div', { style: 'display:grid;grid-template-columns:100px 320px;gap:12px;padding:24px' }, [
        h(Cell, { kind: 'deviceState', row, column: {} }), h(Cell, { kind: 'deviceAccount', row, column: {} }),
      ]) }).mount('#app')
    })
    const rows = page.locator('.device-account-session')
    assert.equal(await rows.count(), 2)
    const geometry = await rows.evaluateAll(nodes => nodes.map(node => {
      const [platform, name, state] = [...node.children].map(child => child.getBoundingClientRect())
      return platform.right <= name.left && name.right <= state.left && Math.abs(platform.y - state.y) < 5
    }))
    assert.deepEqual(geometry, [true, true])
    await page.locator('.device-account-session__name').first().hover()
    await page.getByRole('tooltip').filter({ hasText: '账号 ID 5278' }).waitFor()
    assert.equal((await page.locator('.device-state').innerText()).trim(), '离线')
    await page.mouse.move(900, 700)
    await page.screenshot({ path: 'logs/device-account-compact.png' })
    console.log('PASS: two compact rows, separate usernames, no overlap, ID tooltip, device-only status')
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
