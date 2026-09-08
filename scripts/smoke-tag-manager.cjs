// Synthetic API: account center navigation and inline tag maintenance, no real writes.
const assert = require('node:assert/strict')
const { chromium } = require('playwright')
async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    page.setDefaultTimeout(10000)
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    let creates = 0
    let memberAdds = 0
    let memberRemoves = 0
    const member = { id: 'account-demo', login_username: 'member@example.test', business_platform: 'threads', login_status: 'logged_in' }
    let tagFilter = ''
    await page.route('**/__tags_smoke', route => route.fulfill({ contentType: 'text/html', body: '<div id="app"></div>' }))
    await page.route('**/api/**', route => {
      const url = new URL(route.request().url())
      if (!url.pathname.startsWith('/api/')) return route.continue()
      let data = { items: [], total: 0 }
      if (url.pathname === '/api/accounts') data = { items: [member], total: 1 }
      if (url.pathname === '/api/account-tags/tag-demo/accounts') {
        if (route.request().method() === 'POST') {
          memberAdds++
          assert.deepEqual(route.request().postDataJSON().account_ids, ['account-demo'])
          data = { added_count: 1 }
        } else data = { items: memberAdds > memberRemoves ? [member] : [], total: memberAdds > memberRemoves ? 1 : 0 }
      }
      if (url.pathname === '/api/account-tags/tag-demo/accounts/account-demo' && route.request().method() === 'DELETE') {
        memberRemoves++
        data = {}
      }
      if (url.pathname.includes('feature')) data = { enabled: true, dual_write_enabled: true }
      if (url.pathname === '/api/account-tags') {
        if (route.request().method() === 'POST') { creates++; assert.equal(route.request().postDataJSON().name, '新增测试') }
        data = { items: [{ id: 'tag-demo', name: '演示标签', description: '示例', member_count: 3 }], total: 1 }
      }
      if (url.searchParams.has('tag_id')) tagFilter = url.searchParams.get('tag_id')
      return route.fulfill({ json: { code: 0, data } })
    })
    await page.goto('http://127.0.0.1:5173/__tags_smoke')
    await page.evaluate(async () => {
      await import('/src/styles.css')
      const source = await (await fetch('/src/views/AccountCenterView.vue')).text()
      const authSource = await (await fetch('/src/stores/auth.ts')).text()
      const { createApp, h } = await import(source.match(/from "(\/node_modules\/\.vite\/deps\/vue\.js[^"]*)"/)[1])
      const { createRouter, createMemoryHistory } = await import(source.match(/from "(\/node_modules\/\.vite\/deps\/vue-router\.js[^"]*)"/)[1])
      const { createPinia } = await import(authSource.match(/from "(\/node_modules\/\.vite\/deps\/pinia\.js[^"]*)"/)[1])
      const { useAuthStore } = await import('/src/stores/auth.ts')
      const { default: View } = await import('/src/views/AccountCenterView.vue')
      const pinia = createPinia()
      useAuthStore(pinia).user = { roles: [], permissions: ['accounts.view', 'accounts.create', 'accounts.edit', 'accounts.delete', 'accounts.batch'] }
      const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/accounts', component: View }] })
      await router.push('/accounts')
      createApp({ setup: () => () => h(View) }).use(pinia).use(router).mount('#app')
    })
    assert.equal(await page.getByRole('tab', { name: '账号标签', exact: true }).count(), 0)
    await page.getByRole('button', { name: '管理标签', exact: true }).click()
    const drawer = page.locator('.account-tag-dialog')
    await drawer.waitFor()
    assert.equal(await page.locator('.el-drawer').count(), 0)
    for (const width of [1440, 768]) {
      await page.setViewportSize({ width, height: 1000 })
      const box = await drawer.boundingBox()
      assert.ok(box && box.width <= width * 0.95 && Math.abs(box.x + box.width / 2 - width / 2) < 3)
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
    await drawer.getByText('演示标签', { exact: true }).waitFor()
    await drawer.getByRole('button', { name: '新增标签', exact: true }).click()
    const form = drawer.locator('.tag-manager__form')
    await form.locator('input').fill('新增测试')
    await form.getByRole('button', { name: '保存', exact: true }).click()
    await form.waitFor({ state: 'hidden' })
    assert.equal(creates, 1)
    await drawer.getByRole('button', { name: '管理标签成员', exact: true }).click()
    await drawer.locator('.member-editor__add .el-select__wrapper').click()
    await page.getByRole('option').filter({ hasText: 'member@example.test' }).click()
    await drawer.locator('.member-editor__header').click()
    await drawer.getByRole('button', { name: '添加成员', exact: true }).click()
    await drawer.getByRole('button', { name: '移出标签', exact: true }).waitFor()
    assert.equal(memberAdds, 1)
    await drawer.getByRole('button', { name: '移出标签', exact: true }).click()
    await page.getByRole('button', { name: '移除', exact: true }).click()
    await drawer.getByRole('button', { name: '移出标签', exact: true }).waitFor({ state: 'hidden' })
    assert.equal(memberRemoves, 1)
    await drawer.locator('.member-editor__add .el-select__wrapper').click()
    await page.getByRole('option').filter({ hasText: 'member@example.test' }).click()
    await drawer.locator('.member-editor__header').click()
    await drawer.getByRole('button', { name: '添加成员', exact: true }).click()
    await drawer.getByRole('button', { name: '移出标签', exact: true }).waitFor()
    await page.screenshot({ path: 'logs/tag-members-dialog.png' })
    await drawer.locator('.member-editor__table .el-table__body-wrapper .el-checkbox').first().click()
    await drawer.getByRole('button', { name: '批量移除', exact: true }).click()
    await page.getByRole('button', { name: '移除', exact: true }).click()
    await drawer.getByRole('button', { name: '移出标签', exact: true }).waitFor({ state: 'hidden' })
    assert.equal(memberRemoves, 2)
    await drawer.getByRole('button', { name: '返回标签列表', exact: true }).click()
    await page.screenshot({ path: 'logs/tag-manager-dialog.png' })
    await drawer.getByRole('button', { name: '3', exact: true }).click()
    await drawer.waitFor({ state: 'hidden' })
    await page.waitForTimeout(500)
    assert.equal(tagFilter, 'tag-demo')
    assert.deepEqual(errors, [])
    console.log('PASS: responsive centered dialog, inline create, member selection/add/remove, return to tags, tagged account list; mocked writes only')
  } finally { await browser.close() }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
