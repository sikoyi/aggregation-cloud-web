const assert = require('node:assert/strict')
const { mkdirSync } = require('node:fs')
const { chromium } = require('playwright')

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const errors = [], queries = []
    let stability = false
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/__summary_smoke', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><meta name="viewport" content="width=device-width, initial-scale=1"><body><div id="app"></div></body></html>' }))
    await page.route('**/api/**', route => {
      const url = new URL(route.request().url())
      if (!url.pathname.startsWith('/api/')) return route.continue()
      queries.push(url.href)
      let data = { items: [], total: 0 }
      if (url.pathname.endsWith('/data-overview')) {
        data.summary = { total_accounts: 3200, monitoring_accounts: 1, paused_accounts: 0, abnormal_accounts: 7, unmonitored_accounts: 3192 }
        if (stability) {
          const count = { monitoring: 1, paused: 0, abnormal: 7, not_configured: 20 }[url.searchParams.get('monitor_state')] ?? 20
          data.items = Array.from({ length: count }, (_, index) => ({ account_id: String(index + 1),
            display_name: `Account ${index + 1}`, username: `account_${index + 1}`, business_platform: 'x',
            followers_count: 100, total_post_views: 200, total_likes: 30 }))
          data.total = count
        }
      }
      else if (url.pathname.endsWith('/summary')) data = { total: 3200, active: 1, pending: 0, retrying: 7, paused: 3192 }
      else if (url.pathname.endsWith('/groups')) data = []
      else if (url.pathname.includes('options')) data = []
      return route.fulfill({ json: { code: 0, msg: 'ok', data } })
    })
    await page.goto((process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173') + '/__summary_smoke')
    await page.evaluate(async () => {
      await import('/node_modules/element-plus/dist/index.css')
      await import('/node_modules/element-plus/theme-chalk/dark/css-vars.css')
      await import('/src/styles.css')
      await import('/src/theme.css')
      const source = await (await fetch('/src/views/AccountDataView.vue')).text()
      const vuePath = source.match(/from "(\/node_modules\/\.vite\/deps\/vue\.js[^"]*)"/)[1]
      const authSource = await (await fetch('/src/stores/auth.ts')).text()
      const piniaPath = authSource.match(/from "(\/node_modules\/\.vite\/deps\/pinia\.js[^"]*)"/)[1]
      const { createApp, h } = await import(vuePath)
      const { createPinia } = await import(piniaPath)
      const { useAuthStore } = await import('/src/stores/auth.ts')
      const { default: Owned } = await import('/src/views/AccountDataView.vue')
      const { default: External } = await import('/src/components/ExternalAccountMonitors.vue')
      const pinia = createPinia()
      const app = createApp({ setup: () => () => h('main', [h(Owned), h(External)]) })
      app.use(pinia)
      useAuthStore(pinia).user = { id: 'preview', roles: [], permissions: ['operations.view'], status: 'active' }
      app.mount('#app')
    })
    const owned = page.locator('.account-data__summary')
    await owned.getByText('3,200', { exact: true }).waitFor()
    assert.equal(await owned.locator('.summary-item--total').getAttribute('aria-pressed'), 'true')
    const filterGeometry = () => page.locator('.account-data__filters').evaluate(node => {
      const title = node.querySelector('.filter-title').getBoundingClientRect()
      const grid = node.querySelector('.filter-grid').getBoundingClientRect()
      const bounds = node.getBoundingClientRect()
      return { titleHeight: title.height, gridTop: grid.top, height: bounds.height, width: bounds.width }
    })
    const unfilteredGeometry = await filterGeometry()
    await owned.getByRole('button', { name: /监听异常/ }).click()
    await page.waitForFunction(() => document.querySelector('.summary-item--danger')?.getAttribute('aria-pressed') === 'true')
    assert.deepEqual(await filterGeometry(), unfilteredGeometry)
    assert(queries.some(url => url.includes('monitor_state=abnormal')))
    await owned.getByRole('button', { name: /账号总数/ }).click()
    const styles = selector => page.locator(selector).first().evaluate(node => {
      const css = getComputedStyle(node), text = getComputedStyle(node.querySelector('strong'))
      return { height: css.height, padding: css.padding, radius: css.borderRadius, border: css.borderColor, font: text.fontSize, line: text.lineHeight }
    })
    assert.deepEqual(await styles('.summary-item'), await styles('.external-monitors__stat'))
    const notifications = page.locator('.el-notification__closeBtn')
    while (await notifications.count()) {
      await notifications.first().click()
      await page.waitForTimeout(350)
    }
    mkdirSync('logs', { recursive: true })
    for (const dark of [false, true]) {
      await page.evaluate(value => document.documentElement.classList.toggle('dark', value), dark)
      for (const width of [1440, 900, 390]) {
        await page.setViewportSize({ width, height: 1000 })
        await page.mouse.move(0, 0)
        const boxes = await owned.locator('button').evaluateAll(nodes => nodes.map(node => {
          const r = node.getBoundingClientRect()
          return { x: r.x, right: r.right, top: r.top, fits: node.scrollWidth <= node.clientWidth }
        }))
        assert(boxes.every(box => box.x >= 0 && box.right <= width && box.fits))
        assert.equal(boxes.filter(box => box.top === boxes[0].top).length, width > 1000 ? 5 : width > 600 ? 3 : 2)
        await owned.screenshot({ path: `logs/monitor-summary-${width}-${dark ? 'dark' : 'light'}.png` })
      }
    }
    stability = true
    await page.evaluate(() => { document.querySelector('.external-monitors').style.display = 'none' })
    await page.setViewportSize({ width: 1440, height: 1000 })
    const samples = []
    for (const [label, count] of [['账号总数', 20], ['已关闭', 0], ['监听中', 1], ['监听异常', 7], ['未开启', 20]]) {
      await owned.getByRole('button', { name: new RegExp(label) }).click()
      await page.waitForFunction(count => document.querySelectorAll('.account-overview .el-table__body-wrapper .el-table__row').length === count, count)
      samples.push({ label, ...await filterGeometry(), ...await page.evaluate(() => ({
        scrollHeight: document.documentElement.scrollHeight, viewport: document.documentElement.clientHeight,
        gutter: getComputedStyle(document.documentElement).scrollbarGutter,
      })) })
    }
    const baseline = samples[0]
    assert(samples.some(sample => sample.scrollHeight > sample.viewport))
    assert(samples.some(sample => sample.scrollHeight === sample.viewport))
    for (const sample of samples) {
      for (const key of ['titleHeight', 'gridTop', 'height', 'width']) assert.equal(sample[key], baseline[key], `${sample.label}: ${key}`)
      assert.equal(sample.gutter, 'stable')
    }
    assert.deepEqual(errors, [])
    console.log('PASS: matching card styles, stable filter geometry across 20/0/1/7 rows, reserved scrollbar gutter, desktop/tablet/mobile, light/dark')
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
