// API-isolated UI regression: no real Agent configuration or device dispatch.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright')

async function main() {
  const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5187'
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
  const output = process.env.SMOKE_OUTPUT_DIR || 'logs/runtime-task-policy'
  fs.mkdirSync(output, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  page.setDefaultTimeout(10000)
  const errors = [], mutations = []
  let editable = true, failSave = false
  const runtime = { id: '1', runtime_id: 'Agent A', tenant_id: 'test', runtime_platform: 'fingerprint_browser',
    provider: 'morelogin', status: 'online', lifecycle_status: 'active', task_policy_mode: 'general',
    dedicated_task_purposes: [], max_concurrent_slots: 25, slot_total: 200, slot_idle: 190, slot_running: 10 }
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => localStorage.setItem('access_token', 'ui-test-not-a-real-token'))
  await page.route('**/api/**', async route => {
    const request = route.request(), pathname = new URL(request.url()).pathname
    let data = { items: [], total: 0 }
    if (pathname === '/api/auth/me') {
      data = { id: 'operator', tenant_id: 'test', username: 'operator', display_name: 'Test operator',
        roles: ['operator'], permissions: ['runtimes.view', ...(editable ? ['runtimes.configure'] : [])] }
    } else if (pathname === '/api/runtimes/1/task-policy' && request.method() === 'PUT') {
      if (failSave) return route.fulfill({ status: 500, json: { code: 50000, msg: 'Test save failed' } })
      const payload = request.postDataJSON()
      mutations.push(payload)
      Object.assign(runtime, payload)
      data = runtime
    } else if (pathname === '/api/runtimes') {
      data = { items: [runtime], total: 1, page: 1, page_size: 20 }
    }
    await route.fulfill({ json: { code: 0, msg: 'ok', data } })
  })
  try {
    await page.goto(base + '/runtimes')
    const button = () => page.getByRole('button', { name: '任务分工', exact: true })
    await button().click()
    const dialog = page.locator('.el-dialog:visible').last()
    await dialog.locator('.el-select').first().click()
    await page.getByRole('option', { name: '专用任务', exact: true }).click()
    const save = () => dialog.getByRole('button', { name: '保存', exact: true })
    await save().click()
    assert.equal(mutations.length, 0)
    assert.equal(await page.locator('.el-message-box:visible').count(), 0)
    await dialog.locator('.el-select').nth(1).click()
    await page.getByRole('option', { name: '账号养号', exact: true }).click()
    await page.keyboard.press('Escape')
    await page.locator('.el-select-dropdown:visible').waitFor({ state: 'hidden' })
    await page.locator('.el-message:visible').waitFor({ state: 'hidden' })
    await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    const bounds = await dialog.boundingBox()
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 391)
    await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true })
    await page.setViewportSize({ width: 1600, height: 1000 })
    await save().click()
    await page.locator('.el-message-box:visible').getByRole('button', { name: '确认', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    assert.deepEqual(mutations, [{ task_policy_mode: 'dedicated', dedicated_task_purposes: ['account_warmup'] }])
    await page.getByText('账号养号', { exact: true }).waitFor()
    await page.screenshot({ path: path.join(output, 'configured-list.png'), fullPage: true })
    await button().click()
    await dialog.getByText('账号养号', { exact: true }).waitFor()
    await dialog.locator('.el-select').first().click()
    await page.getByRole('option', { name: '通用任务', exact: true }).click()
    failSave = true
    await save().click()
    await page.locator('.el-message-box:visible').getByRole('button', { name: '确认', exact: true }).click()
    await page.getByText('Test save failed', { exact: true }).waitFor()
    assert.equal(await dialog.isVisible(), true)
    assert.equal(mutations.length, 1)
    failSave = false
    await save().click()
    await page.locator('.el-message-box:visible').getByRole('button', { name: '确认', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    assert.deepEqual(mutations[1], { task_policy_mode: 'general', dedicated_task_purposes: [] })
    editable = false
    await page.reload()
    await page.getByText('Agent A', { exact: true }).waitFor()
    assert.equal(await button().count(), 0)
    assert.deepEqual(errors, [])
    console.log('PASS: business-only editor; validation; save; reload; clear; error recovery; permission; desktop/mobile')
  } catch (error) {
    await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true })
    console.error((await page.locator('body').innerText()).slice(-4500))
    throw error
  } finally {
    await browser.close()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
