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
      { id: 'two', business_platform: 'threads', profile_url: 'https://www.threads.com/@two', remark: '', interval_minutes: 60, enabled: true, status: 'retrying', version: 2, group_id: null, profile: { display_name: 'Example Two With A Very Long Display Name For Layout Checks' } },
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
      } else if (url.pathname.endsWith('/two')) {
        data = { monitor: rows[1], posts: [{ source_key: 'saved-post', content_url: 'https://www.threads.com/@two/post/saved',
          report: { text_content: 'Saved before comment collection completed', comments: [], metrics: {} } }], total: 1, snapshots: [] }
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
    rows = rows.map((row, index) => ({ ...row, enabled: true, status: 'collecting',
      activity_status: index ? 'collecting' : 'waiting',
      collection_progress: { phase: index ? 'comments' : 'posts', posts_collected: 24,
        comments_completed: 3, comments_total: 24, last_progress_at: '2026-09-20T07:00:00+00:00' },
    }))
    await page.getByRole('button', { name: '刷新外部账号监听', exact: true }).click()
    await page.getByText('等待调度', { exact: true }).waitFor()
    await page.locator('.el-table').getByText('采集中', { exact: true }).waitFor()
    await page.getByText('帖子已采集 24 条', { exact: true }).waitFor()
    await page.getByText('评论采集 3 / 24 帖', { exact: true }).waitFor()
    await page.getByText('最近整轮成功', { exact: true }).waitFor()
    await page.getByRole('button', { name: '查看外部账号数据', exact: true }).nth(1).click()
    const detailDialog = page.getByRole('dialog', { name: '外部账号数据', exact: true })
    await detailDialog.getByText('评论采集 3 / 24 帖', { exact: true }).waitFor()
    await detailDialog.getByText('Saved before comment collection completed', { exact: true }).waitFor()
    await detailDialog.getByRole('tab', { name: '最近采集记录', exact: true }).click()
    await detailDialog.getByText('暂无采集记录', { exact: true }).waitFor()
    await detailDialog.getByRole('button', { name: '关闭', exact: true }).click()
    await detailDialog.waitFor({ state: 'hidden' })
    const notifications = page.locator('.el-notification__closeBtn')
    while (await notifications.count()) {
      await notifications.first().click()
      await page.waitForTimeout(350)
    }
    mkdirSync('logs', { recursive: true })
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      const identities = await page.locator('.external-monitors__identity').evaluateAll(nodes => nodes.map(node => {
        const avatar = node.querySelector('.el-avatar').getBoundingClientRect()
        const name = node.querySelector('strong')
        const text = name.getBoundingClientRect()
        const bounds = node.getBoundingClientRect()
        return { width: avatar.width, height: avatar.height, font: getComputedStyle(name).fontSize,
          ellipsis: getComputedStyle(name).textOverflow, fits: text.right <= bounds.right + 1,
          separate: text.left >= avatar.right, truncated: name.scrollWidth > name.clientWidth }
      }))
      assert(identities.every(item => item.width === 48 && item.height === 48 && item.font === '16px' && item.ellipsis === 'ellipsis' && item.fits && item.separate))
      assert(identities.some(item => item.truncated))
      const boxes = await page.locator('.external-monitors__stat').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { x: r.x, right: r.right, fits: node.scrollWidth <= node.clientWidth } }))
      assert(boxes.every(box => box.x >= 0 && box.right <= width && box.fits))
      assert(await page.locator('.external-collection-progress').evaluateAll(nodes => nodes.every(node => node.scrollWidth <= node.clientWidth)))
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
    console.log('PASS: global counts, filter, selection reset, groups, batch enable/disable/interval/delete, cancellation, collection progress, light/dark/mobile')
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
