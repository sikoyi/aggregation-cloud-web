// Synthetic API only: verify confirmation, cancellation, failure and successful removal.
const assert = require('node:assert/strict')
const { chromium } = require('playwright')

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    let calls = 0
    let removed = false
    await page.route('**/__export_delete_smoke', route => route.fulfill({ contentType: 'text/html', body: '<div id="app"></div>' }))
    await page.route('**/api/accounts/export-records**', route => {
      if (route.request().method() === 'DELETE') {
        calls += 1
        if (calls === 1) return route.fulfill({ status: 500, json: { code: 50000, msg: '测试删除失败' } })
        removed = true
        return route.fulfill({ json: { code: 0, data: { id: 'demo' } } })
      }
      return route.fulfill({ json: { code: 0, data: { total: removed ? 0 : 1, items: removed ? [] : [{
        id: 'demo', filename: 'accounts.xlsx', row_count: 20, created_at: '2026-09-07T10:00:00Z', expires_at: '2026-10-07T10:00:00Z', state: 'ready',
      }] } } })
    })
    await page.goto('http://127.0.0.1:5173/__export_delete_smoke')
    await page.evaluate(async () => {
      await import('/src/styles.css')
      const entry = await (await fetch('/src/main.ts')).text()
      for (const match of entry.matchAll(/import "([^\"]*(?:message|message-box|notification)[^\"]*)"/g)) await import(match[1])
      const source = await (await fetch('/src/components/AccountExportRecords.vue')).text()
      const authSource = await (await fetch('/src/stores/auth.ts')).text()
      const { createApp, h } = await import(source.match(/from "(\/node_modules\/\.vite\/deps\/vue\.js[^"]*)"/)[1])
      const { createPinia } = await import(authSource.match(/from "(\/node_modules\/\.vite\/deps\/pinia\.js[^"]*)"/)[1])
      const { useAuthStore } = await import('/src/stores/auth.ts')
      const { default: Component } = await import('/src/components/AccountExportRecords.vue')
      const pinia = createPinia()
      useAuthStore(pinia).user = { roles: [], permissions: ['accounts.export'] }
      createApp({ setup: () => () => h(Component) }).use(pinia).mount('#app')
    })
    const remove = page.getByRole('button', { name: '删除导出记录', exact: true })
    await remove.click()
    await page.getByRole('button', { name: '取消', exact: true }).click()
    assert.equal(calls, 0)
    await remove.click()
    await page.getByRole('button', { name: '确认删除', exact: true }).click()
    await page.getByText('测试删除失败', { exact: true }).waitFor()
    assert.equal(await remove.count(), 1)
    await remove.click()
    await page.getByRole('button', { name: '确认删除', exact: true }).click()
    await remove.waitFor({ state: 'hidden' })
    assert.equal(calls, 2)
    console.log('PASS: cancel without request, failed delete retains row, confirmed delete refreshes list; mock only')
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
