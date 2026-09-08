// Mocked APIs only; no device commands or database writes.
const assert = require('node:assert/strict')
const { chromium } = require('playwright')
async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    page.setDefaultTimeout(10000)
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    const group = { id: 'group-demo', name: '演示分组', runtime_platform: 'fingerprint_browser', provider: 'morelogin', member_count: 0 }
    let created = 0
    await page.route('**/__groups_smoke', route => route.fulfill({ contentType: 'text/html', body: '<div id="app"></div>' }))
    await page.route('**/api/**', route => {
      const url = new URL(route.request().url())
      if (!url.pathname.startsWith('/api/')) return route.continue()
      let data = { items: [], total: 0 }
      if (url.pathname === '/api/slot-groups') {
        if (route.request().method() === 'POST') { created++; data = group }
        else data = { items: [group, ...Array.from({ length: 19 }, (_, i) => ({ ...group, id: `group-${i}`, name: `分组 ${i}` }))], total: 20 }
      }
      if (url.pathname === '/api/slot-groups/group-demo') data = group
      return route.fulfill({ json: { code: 0, data } })
    })
    await page.goto('http://127.0.0.1:5173/__groups_smoke')
    await page.evaluate(async () => {
      await import('/src/styles.css')
      const source = await (await fetch('/src/views/DeviceCenterView.vue')).text()
      const authSource = await (await fetch('/src/stores/auth.ts')).text()
      const { createApp, h } = await import(source.match(/from "(\/node_modules\/\.vite\/deps\/vue\.js[^"]*)"/)[1])
      const { createRouter, createMemoryHistory } = await import(source.match(/from "(\/node_modules\/\.vite\/deps\/vue-router\.js[^"]*)"/)[1])
      const { createPinia } = await import(authSource.match(/from "(\/node_modules\/\.vite\/deps\/pinia\.js[^"]*)"/)[1])
      const { useAuthStore } = await import('/src/stores/auth.ts')
      const { default: View } = await import('/src/views/DeviceCenterView.vue')
      const pinia = createPinia()
      useAuthStore(pinia).user = { roles: [], permissions: ['devices.view', 'devices.create', 'devices.edit', 'devices.delete', 'devices.batch'] }
      const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/slots', component: View }] })
      await router.push('/slots')
      createApp({ setup: () => () => h(View) }).use(pinia).use(router).mount('#app')
    })
    assert.equal(await page.getByRole('tab', { name: '设备分组', exact: true }).count(), 0)
    await page.getByRole('button', { name: '管理分组', exact: true }).click()
    const dialog = page.locator('.device-group-dialog')
    await dialog.getByText('演示分组', { exact: true }).waitFor()
    for (const width of [1440, 1200, 768]) {
      await page.setViewportSize({ width, height: 800 })
      await page.waitForTimeout(350)
      const bounds = await dialog.evaluate(node => {
        const body = node.querySelector('.el-dialog__body').getBoundingClientRect()
        const button = node.querySelector('.resource-page__header .el-button--primary').getBoundingClientRect()
        const header = node.querySelector('.el-dialog__header').getBoundingClientRect()
        return { bodyTop: body.top, buttonTop: button.top, buttonRight: button.right, bodyRight: body.right, headerBottom: header.bottom }
      })
      assert.ok(bounds.buttonTop >= bounds.bodyTop + 3 && bounds.buttonTop >= bounds.headerBottom)
      assert.ok(bounds.buttonRight <= bounds.bodyRight)
      await page.screenshot({ path: `logs/device-group-toolbar-${width}.png` })
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
    await dialog.getByRole('button', { name: '新增设备组', exact: true }).click()
    const panel = dialog.locator('.inline-form-panel')
    await panel.waitFor()
    assert.equal(await page.locator('.el-dialog:visible').count(), 1)
    await panel.locator('.el-form-item').filter({ has: page.locator('.el-form-item__label', { hasText: /^名称$/ }) }).locator('input').fill('测试分组')
    await panel.getByRole('button', { name: '保存', exact: true }).click()
    await panel.waitFor({ state: 'hidden' })
    assert.equal(created, 1)
    await dialog.getByRole('button', { name: '编辑', exact: true }).first().click()
    await panel.getByRole('tab', { name: '组内设备', exact: true }).click()
    await panel.getByRole('button', { name: '添加设备', exact: true }).waitFor()
    assert.equal(await page.locator('.el-dialog:visible').count(), 1)
    await page.screenshot({ path: 'logs/device-group-dialog.png' })
    assert.deepEqual(errors, [])
    console.log('PASS: group manager dialog, inline create/save and edit/member view, no stacked editor dialogs; mock only')
  } finally { await browser.close() }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
