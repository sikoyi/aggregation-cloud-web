const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const { mkdirSync } = require('node:fs')
const { join } = require('node:path')
const { tmpdir } = require('node:os')

async function main() {
  const origin = process.env.R12_UI_ORIGIN || 'http://127.0.0.1:5173'
  assert.equal(new URL(origin).hostname, '127.0.0.1')
  const output = join(tmpdir(), 'shopify-r12-ui')
  mkdirSync(output, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  let page
  const errors = []
  try {
    page = await browser.newPage({ viewport: { width: 1920, height: 900 } })
    page.setDefaultTimeout(10000)
    const writes = []
    const queries = []
    let failWrite = false
    let failList = false
    let empty = false
    let releaseWrite
    let pendingWrite
    const records = [
      { account_id: 'active', username: 'Active', state: 'active', can_recheck: true },
      { account_id: 'retry', username: 'Retry', state: 'retrying', can_recheck: true, failures: 3 },
      { account_id: 'system', username: 'System', state: 'stopped_banned', can_recheck: true, ban_source: 'system_rule', failures: 6 },
      { account_id: 'exported', username: 'Exported', state: 'stopped_exported', can_recheck: false, recheck_disabled_reason: '账号或登录身份已导出，不能恢复监听' },
      { account_id: 'manual', username: 'Manual', state: 'stopped_banned', can_recheck: false, ban_source: 'other_or_unknown', recheck_disabled_reason: '非店铺监听系统判封，请先核实账号状态' },
      { account_id: 'denied', username: 'View only', state: 'active', can_recheck: false, recheck_disabled_reason: '没有修改账号的权限' },
      { account_id: 'missing', username: 'Missing URL', state: 'missing_url', can_recheck: false, recheck_disabled_reason: '请先补充店铺链接', profile_url: '' },
    ].map(row => ({ profile_url: 'https://example.test', failures: 0, version: 'a'.repeat(64),
      last_checked_at: '2026-09-07T08:00:00Z', next_check_at: '2026-09-07T14:00:00Z', ...row }))
    page.on('pageerror', error => errors.push(error.message))
    // Every API is synthetic; all nonlocal HTTP requests are blocked.
    await page.route('**/*', async route => {
      const request = route.request()
      const url = new URL(request.url())
      if (url.origin !== origin) return route.abort()
      if (url.pathname === '/__r12_monitor_test') {
        return route.fulfill({ contentType: 'text/html', body: '<html><meta name="viewport" content="width=device-width, initial-scale=1"><body><div id="app"></div></body></html>' })
      }
      if (!url.pathname.startsWith('/api/')) return route.continue()
      if (request.method() === 'PUT' && /^\/api\/accounts\/shopify-monitors\/[^/]+\/recheck$/.test(url.pathname)) {
        writes.push({ path: url.pathname, body: request.postDataJSON() })
        if (pendingWrite) await pendingWrite
        if (failWrite) return route.fulfill({ status: 409, json: { code: 40900, msg: '监听或账号状态已变化，请刷新后重新确认', data: null } })
        const row = records.find(row => url.pathname.includes(`/${row.account_id}/`))
        row.state = 'active'
        row.ban_source = null
        row.failures = 0
        row.version = 'b'.repeat(64)
        return route.fulfill({ json: { code: 0, msg: 'queued', data: { account_id: row.account_id, queued: true } } })
      }
      if (request.method() === 'GET' && url.pathname === '/api/accounts/shopify-monitors') {
        queries.push(Object.fromEntries(url.searchParams))
        if (failList) return route.fulfill({ status: 503, json: { code: 50000, msg: '模拟列表失败', data: null } })
        return route.fulfill({ json: { code: 0, data: { items: empty ? [] : records, total: empty ? 0 : 65 } } })
      }
      throw new Error(`Unexpected API: ${request.method()} ${url.pathname}`)
    })
    await page.goto(`${origin}/__r12_monitor_test`)
    await page.evaluate(async () => {
      await import('/src/styles.css')
      const main = await (await fetch('/src/main.ts')).text()
      for (const match of main.matchAll(/import "([^"]*message[^"]*)"/g)) await import(match[1])
      const source = await (await fetch('/src/components/ShopifyStoreMonitors.vue')).text()
      const vuePath = source.match(/from "(\/node_modules\/\.vite\/deps\/vue\.js[^"]*)"/)[1]
      const { createApp, h } = await import(vuePath)
      const { default: Component } = await import('/src/components/ShopifyStoreMonitors.vue')
      createApp({ setup: () => () => h(Component) }).mount('#app')
    })
    const row = name => page.locator('.el-table__body tr').filter({ hasText: new RegExp(`^${name}\\s*ID `) })
    const modal = () => page.locator('.el-message-box')
    await row('System').getByRole('button', { name: '恢复监听' }).waitFor()
    for (const name of ['Exported', 'Manual', 'View only', 'Missing URL']) {
      assert.ok(await row(name).getByRole('button').isDisabled(), `${name} must be disabled`)
    }
    await row('System').getByText('系统访问规则判定').hover()
    await page.getByRole('tooltip').filter({ hasText: '不代表 Shopify 官方确认' }).waitFor()
    await row('Manual').locator('.shopify-monitors__action').hover()
    await page.getByRole('tooltip').filter({ hasText: '先核实账号状态' }).waitFor()
    await page.screenshot({ path: join(output, 'provenance-desktop.png') })
    await row('System').getByRole('button', { name: '恢复监听' }).click()
    assert.match(await modal().innerText(), /登录状态置为未知/)
    await modal().getByRole('button', { name: '取消', exact: true }).click()
    assert.equal(writes.length, 0)

    async function refreshAction(action) {
      const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/accounts/shopify-monitors')
      await action()
      await response
      await page.locator('.el-loading-mask').waitFor({ state: 'hidden' })
    }
    await refreshAction(() => page.locator('.btn-next').click())
    assert.equal(queries.at(-1).page, '2')
    await page.locator('.el-pagination .el-select').click()
    await refreshAction(() => page.getByRole('option').filter({ hasText: '50' }).click())
    assert.equal(queries.at(-1).page, '1')
    assert.equal(queries.at(-1).page_size, '50')
    await refreshAction(() => page.locator('.btn-next').click())

    pendingWrite = new Promise(resolve => { releaseWrite = resolve })
    const restore = row('System').getByRole('button', { name: '恢复监听' })
    await restore.evaluate(button => { button.click(); button.click() })
    assert.equal(await modal().count(), 1)
    const submitted = page.waitForRequest(r => r.method() === 'PUT')
    await modal().getByRole('button', { name: '确认排队' }).click()
    await submitted
    assert.ok(await row('Active').getByRole('button').isDisabled())
    const refreshed = page.waitForResponse(r => new URL(r.url()).pathname === '/api/accounts/shopify-monitors')
    releaseWrite()
    await refreshed
    pendingWrite = null
    await page.getByText('已排队重新检测，尚未获得新的检测结果', { exact: true }).waitFor()
    assert.equal(writes.length, 1)
    assert.deepEqual(writes[0].body, { expected_version: 'a'.repeat(64) })
    assert.equal(queries.at(-1).page, '2')
    assert.equal(queries.at(-1).page_size, '50')

    failWrite = true
    await row('Retry').getByRole('button', { name: '重新检测' }).click()
    await refreshAction(() => modal().getByRole('button', { name: '确认排队' }).click())
    await page.getByText('监听或账号状态已变化，请刷新后重新确认', { exact: true }).waitFor()
    assert.equal(writes.length, 2)
    assert.equal(queries.at(-1).page, '2')
    failWrite = false
    await page.getByPlaceholder('账号 / 店铺链接').fill('demo')
    await refreshAction(() => page.getByRole('button', { name: '查询', exact: true }).click())
    assert.equal(queries.at(-1).keyword, 'demo')
    assert.equal(queries.at(-1).page_size, '50')
    await page.screenshot({ path: join(output, 'desktop.png') })
    failList = true
    await refreshAction(() => page.getByRole('button', { name: '刷新监听' }).click())
    await page.getByRole('alert').getByText('模拟列表失败').waitFor()
    failList = false
    empty = true
    await refreshAction(() => page.getByRole('button', { name: '刷新监听' }).click())
    await page.getByText('暂无 Shopify 账号', { exact: true }).waitFor()
    empty = false
    await refreshAction(() => page.getByRole('button', { name: '刷新监听' }).click())
    await page.locator('.el-message').last().waitFor({ state: 'hidden' })
    await page.mouse.move(1000, 800)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: join(output, 'mobile.png') })
    await row('Active').getByRole('button', { name: '重新检测' }).click()
    await modal().getByRole('button', { name: '确认排队' }).waitFor()
    await page.waitForTimeout(400)
    const box = await modal().boundingBox()
    assert.ok(box && box.x >= 0 && box.x + box.width <= 390)
    await page.screenshot({ path: join(output, 'confirmation-mobile.png') })
    await modal().getByRole('button', { name: '取消', exact: true }).click()
    assert.ok(await page.locator('.el-pagination.is-background').count())
    assert.deepEqual(errors, [])
    console.log('PASS: capabilities, provenance/tooltips, confirmation/cancel, duplicate guard, queued success/failure, pagination, filter, empty/error recovery, desktop/mobile')
    console.log(`Screenshots: ${output}`)
  } catch (error) {
    console.error('Browser errors:', errors)
    console.error('Page:', await page.locator('body').innerText())
    await page.screenshot({ path: join(output, 'failure.png') })
    throw error
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
