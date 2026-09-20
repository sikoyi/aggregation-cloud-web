const assert = require('node:assert/strict')
const { mkdirSync } = require('node:fs')
const { chromium } = require('playwright')

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const errors = [], writes = [], queries = []
    let groups = []
    let rows = [
      { id: 'one', business_platform: 'x', profile_url: 'https://x.com/one', remark: '', interval_minutes: 60, enabled: false, status: 'paused', version: 1, group_id: null, profile: { display_name: 'Example One', followers_count: 12500 } },
      { id: 'two', business_platform: 'threads', profile_url: 'https://www.threads.com/@two', remark: '', interval_minutes: 60, enabled: true, status: 'retrying', version: 2, group_id: null, profile: { display_name: 'Example Two' } },
    ]
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/__external_monitor_smoke', route => route.fulfill({ contentType: 'text/html', body: '<html><meta name="viewport" content="width=device-width, initial-scale=1"><body><div id="app"></div></body></html>' }))
    await page.route('**/api/**', route => {
      const url = new URL(route.request().url())
      if (!url.pathname.startsWith('/api/')) return route.continue()
      const method = route.request().method()
      const payload = method === 'GET' || method === 'DELETE' ? null : route.request().postDataJSON()
      let data
      if (method !== 'GET') writes.push({ path: url.pathname, method, payload })
      else queries.push(url.href)
      if (url.pathname.endsWith('/summary')) data = { total: 203, active: 150, pending: 20, retrying: 18, paused: 15 }
      else if (url.pathname.endsWith('/groups')) {
        if (method === 'POST') { data = { id: 'group', name: payload.name, version: 1 }; groups.push(data) }
        else data = groups
      } else if (url.pathname.endsWith('/groups/group')) {
        if (method === 'DELETE') { groups = []; rows = rows.map(row => ({ ...row, group_id: null })); data = {} }
        else { groups = [{ ...groups[0], name: payload.name, version: 2 }]; data = groups[0] }
      } else if (url.pathname.endsWith('/batch')) {
        rows = rows.flatMap(row => {
          if (!payload.items.some(item => item.id === row.id)) return [row]
          if (payload.action === 'delete') return []
          return [{ ...row, version: row.version + 1,
            ...(payload.action === 'enable' ? { enabled: true, status: 'pending' } : {}),
            ...(payload.action === 'disable' ? { enabled: false, status: 'paused' } : {}),
            ...(payload.action === 'interval' ? { interval_minutes: payload.interval_minutes } : {}),
            ...(payload.action === 'group' ? { group_id: payload.group_id } : {}),
          }]
        })
        data = { succeeded: payload.items.length, skipped: 0, failed: 0, items: [] }
      } else data = { items: rows, total: rows.length }
      return route.fulfill({ json: { code: 0, msg: 'ok', data } })
    })
    await page.goto((process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173') + '/__external_monitor_smoke')
    await page.evaluate(async () => {
      await import('/node_modules/element-plus/dist/index.css')
      await import('/node_modules/element-plus/theme-chalk/dark/css-vars.css')
      await import('/src/styles.css')
      await import('/src/theme.css')
      const source = await (await fetch('/src/components/ExternalAccountMonitors.vue')).text()
      const vuePath = source.match(/from "(\/node_modules\/\.vite\/deps\/vue\.js[^"]*)"/)[1]
      const authSource = await (await fetch('/src/stores/auth.ts')).text()
      const piniaPath = authSource.match(/from "(\/node_modules\/\.vite\/deps\/pinia\.js[^"]*)"/)[1]
      const { createApp, h } = await import(vuePath)
      const { createPinia } = await import(piniaPath)
      const { useAuthStore } = await import('/src/stores/auth.ts')
      const { default: Component } = await import('/src/components/ExternalAccountMonitors.vue')
      const app = createApp({ setup: () => () => h(Component) })
      const pinia = createPinia()
      app.use(pinia)
      useAuthStore(pinia).user = { id: 'user', roles: ['super_admin'], permissions: ['operations.view', 'operations.edit'], status: 'active' }
      app.mount('#app')
    })
    await page.getByText('Example One', { exact: true }).waitFor()
    assert.equal(await page.locator('.external-monitors__stat strong').first().innerText(), '203')
    const enable = page.getByRole('button', { name: '批量开启监听', exact: true })
    assert(await enable.isDisabled())
    await page.getByRole('button', { name: /已关闭.*15/ }).click()
    await page.waitForFunction(() => document.querySelector('.external-monitors__stat.is-active')?.textContent.includes('已关闭'))
    await page.getByRole('button', { name: /账号总数.*203/ }).click()
    async function selectAll() { await page.locator('.el-table__header-wrapper .el-checkbox').first().click(); await page.getByText('已选择', { exact: false }).first().waitFor() }
    await selectAll()
    await enable.click()
    await page.waitForFunction(() => document.querySelector('.external-batch-bar strong')?.textContent === '0')
    assert.deepEqual(writes.at(-1).payload, { action: 'enable', items: [{ id: 'one', expected_version: 1 }, { id: 'two', expected_version: 2 }] })
    await page.getByRole('button', { name: '管理分组', exact: true }).click()
    const groupDialog = page.getByRole('dialog', { name: '外部账号分组' })
    await groupDialog.locator('input').fill('Creators')
    await groupDialog.getByRole('button', { name: '新建', exact: true }).click()
    await groupDialog.getByText('Creators', { exact: true }).waitFor()
    await groupDialog.getByRole('button', { name: '关闭', exact: true }).click()
    await selectAll()
    await page.getByRole('button', { name: '批量分组', exact: true }).click()
    await page.getByRole('dialog', { name: '批量设置分组' }).locator('.el-select').click()
    await page.locator('.el-select-dropdown__item:visible').filter({ hasText: /^Creators$/ }).click()
    await page.getByRole('button', { name: '确认修改', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.external-batch-bar strong')?.textContent === '0')
    assert.equal(writes.at(-1).payload.group_id, 'group')
    await selectAll()
    await page.getByRole('button', { name: '批量修改间隔', exact: true }).click()
    await page.getByRole('dialog', { name: '批量修改监听间隔' }).getByRole('spinbutton').fill('30')
    await page.getByRole('button', { name: '确认修改', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.external-batch-bar strong')?.textContent === '0')
    assert.equal(writes.at(-1).payload.interval_minutes, 30)
    await selectAll()
    await page.getByRole('button', { name: '批量关闭监听', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.external-batch-bar strong')?.textContent === '0')
    assert.equal(writes.at(-1).payload.action, 'disable')
    const notifications = page.locator('.el-notification__closeBtn')
    while (await notifications.count()) {
      await notifications.first().click()
      await page.waitForTimeout(350)
    }
    mkdirSync('logs', { recursive: true })
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      const boxes = await page.locator('.external-monitors__stat').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { x: r.x, right: r.right, fits: node.scrollWidth <= node.clientWidth } }))
      assert(boxes.every(box => box.x >= 0 && box.right <= width && box.fits))
      await page.screenshot({ path: `logs/external-monitor-batch-${width}.png`, fullPage: true })
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await page.waitForTimeout(500)
    await page.screenshot({ path: 'logs/external-monitor-batch-dark.png', fullPage: true })
    await selectAll()
    await page.getByRole('button', { name: '批量删除', exact: true }).click()
    await page.getByRole('button', { name: '取消', exact: true }).click()
    assert.equal(rows.length, 2)
    await page.getByRole('button', { name: '批量删除', exact: true }).click()
    await page.getByRole('button', { name: '确认删除', exact: true }).click()
    await page.getByText('暂无外部账号', { exact: true }).waitFor()
    assert.equal(rows.length, 0)
    assert(queries.some(url => url.includes('status=paused')))
    assert.deepEqual(errors, [])
    console.log('PASS: global counts, filter, selection reset, groups, batch enable/disable/interval/delete, cancellation, light/dark/mobile')
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
