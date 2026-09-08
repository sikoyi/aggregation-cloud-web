// Reuses a running Vite server. All business APIs are mocked; no real exports or remote preparation.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173'
const output = process.env.SMOKE_OUTPUT_DIR || 'logs'
const recordId = '00000000-0000-4000-8000-000000000011'
const stamp = '2026-09-07T00:00:00Z'
const expiry = '2026-10-07T00:00:00Z'
const limitation = '邮箱微服务未提供只读交付验证接口；未验证邮箱资源、Shopify 验证码记录、邮箱凭据或预留状态，正式提交仍可能失败。'
const original = Buffer.from('synthetic-original-artifact-001234')

function preflight(blocked) {
  const items = ['101', '102'].map((id, index) => ({
    selected_id: id, identity_id: id, export_platforms: ['shopify'], lock_platforms: index ? ['instagram', 'shopify'] : ['shopify', 'threads'],
    hidden_locked_account_count: 0, file_row_count: 1, local_eligible: !blocked, email_check: 'unverified',
    blocking_reasons: blocked ? (index ? [{ code: 'email_format', message: 'Shopify 登录账号不是有效的邮箱地址格式' }] : [
      { code: 'already_exported', message: '登录身份或关联平台已导出，不能重复导出' },
      { code: 'login_status', message: '关联账号尚未确认未登录，请完成下号并确认状态' },
      { code: 'bound', message: '关联账号仍绑定设备或有活动设备会话' },
      { code: 'active_task', message: '关联身份或账号仍有排队中或执行中的任务' },
    ]) : [],
    warnings: [{ code: 'missing_field', message: '主页链接缺失，现有导出规则允许留空', field: 'profile_url', business_platform: 'shopify' }],
  }))
  return { checked_at: stamp, source: 'identities', file_format: 'xlsx', selected_count: 2,
    local_eligible_count: blocked ? 0 : 2, blocked_count: blocked ? 2 : 0, unverified_count: 2,
    file_row_count: 2, can_submit: !blocked, fully_verified: false, email_check: 'unverified', limitations: [limitation], items }
}
function status(state = 'confirming') {
  return { id: recordId, state, pending: state === 'confirming', expired: state === 'expired',
    download_available: state === 'ready', recovery_overdue: state === 'confirming', filename: 'original.xlsx',
    row_count: 2, created_at: stamp, expires_at: expiry }
}

async function mount(page, denied = false) {
  await page.goto(`${base}/__export_preflight_smoke`)
  await page.evaluate(async denied => {
    await import('/src/styles.css')
    const dialogSource = await (await fetch('/src/components/AccountExportPreflightDialog.vue')).text()
    const authSource = await (await fetch('/src/stores/auth.ts')).text()
    const vuePath = dialogSource.match(/from "(\/node_modules\/\.vite\/deps\/vue\.js[^\"]*)"/)[1]
    const piniaPath = authSource.match(/from "(\/node_modules\/\.vite\/deps\/pinia\.js[^\"]*)"/)[1]
    const { createApp, h, ref } = await import(vuePath)
    const { createPinia } = await import(piniaPath)
    const { useAuthStore } = await import('/src/stores/auth.ts')
    const { default: Dialog } = await import('/src/components/AccountExportPreflightDialog.vue')
    const { default: Records } = await import('/src/components/AccountExportRecords.vue')
    const pinia = createPinia()
    const auth = useAuthStore(pinia)
    auth.user = { id: 'mock-user', roles: denied ? ['operator'] : ['super_admin'], permissions: ['accounts.export'], display_name: 'Mock user' }
    const mode = ref('dialog')
    window.exportSmoke = { changed: 0, openedRecord: '', mode, auth }
    const records = [{ id: '101', platform_summaries: [
      { account_id: '11', business_platform: 'shopify' }, { account_id: '12', business_platform: 'threads' },
    ] }, { id: '102', platform_summaries: [
      { account_id: '21', business_platform: 'shopify' }, { account_id: '22', business_platform: 'instagram' },
    ] }]
    createApp({ setup: () => () => mode.value === 'dialog' ? h(Dialog, {
      source: 'identities', records,
      onClose: () => { mode.value = 'closed' },
      onChanged: () => { window.exportSmoke.changed++ },
      onRecords: id => { window.exportSmoke.openedRecord = id; mode.value = 'records' },
    }) : mode.value === 'records' ? h(Records) : h('div', 'closed') }).use(pinia).mount('#app')
  }, denied)
}

async function verifyLayout(page, name) {
  const dialog = page.locator('.el-dialog:visible')
  const box = await dialog.boundingBox()
  assert.ok(box && box.x >= 0 && box.width + box.x <= page.viewportSize().width + 1)
  assert.ok(box.y >= 0 && box.y + box.height <= page.viewportSize().height + 1)
  const buttons = await dialog.locator('.export-preflight__footer .el-button').all()
  const boxes = await Promise.all(buttons.map(button => button.boundingBox()))
  for (const button of boxes) {
    assert.ok(button && button.x >= box.x && button.x + button.width <= box.x + box.width + 1)
  }
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j]
    assert.ok(a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1 || a.y + a.height <= b.y + 1 || b.y + b.height <= a.y + 1)
  }
  await page.screenshot({ path: path.join(output, `account-export-preflight-${name}.png`), fullPage: true })
}

async function main() {
  await fs.mkdir(output, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  page.setDefaultTimeout(12000)
  const errors = [], unexpected = [], requests = []
  let blocked = true, formalMode = 'reject', ready = false
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin !== new URL(base).origin) { unexpected.push(url.origin); return route.abort() }
    if (url.pathname === '/__export_preflight_smoke') return route.fulfill({ contentType: 'text/html', body: '<html><meta name="viewport" content="width=device-width, initial-scale=1"><body><div id="app"></div></body></html>' })
    if (!url.pathname.startsWith('/api/')) return route.continue()
    requests.push({ path: url.pathname, method: route.request().method(), body: route.request().postDataJSON() })
    const success = data => route.fulfill({ json: { code: 0, msg: 'ok', data } })
    if (url.pathname === '/api/accounts/export/preflight') return success(preflight(blocked))
    if (url.pathname === '/api/accounts/export') {
      if (formalMode === 'reject') return route.fulfill({ status: 409, json: { code: 40900, msg: '预检后账号出现新任务，请重新预检', data: null } })
      return route.fulfill({ status: 409, json: { code: 40900, msg: '导出记录已保存，邮箱正在后台确认',
        data: { export_record_id: recordId, state: 'confirming', committed: true } } })
    }
    if (url.pathname.endsWith('/status')) return success(status(ready ? 'ready' : 'confirming'))
    if (url.pathname.endsWith('/download')) return route.fulfill({ body: original,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      headers: { 'Content-Disposition': 'attachment; filename="original.xlsx"' } })
    if (url.pathname === '/api/accounts/export-records') return success({ items: [status(ready ? 'ready' : 'confirming')], total: 1 })
    unexpected.push(url.pathname)
    return route.fulfill({ status: 500, json: { code: 50000, msg: 'Unexpected mock request' } })
  })
  try {
    await mount(page)
    const dialog = page.locator('.el-dialog:visible')
    await dialog.waitFor()
    const submit = dialog.getByRole('button', { name: '确认导出', exact: true })
    assert.equal(await submit.isDisabled(), true)
    assert.equal(await dialog.getByRole('button', { name: '只读预检', exact: true }).isDisabled(), true)
    await dialog.getByText('请选择业务平台', { exact: true }).click()
    await page.getByRole('option', { name: 'Shopify', exact: true }).click()
    await dialog.locator('.el-dialog__header').click()
    await dialog.getByRole('button', { name: '只读预检', exact: true }).click()
    await dialog.locator('.export-preflight__table').getByText('登录身份或关联平台已导出，不能重复导出', { exact: true }).waitFor()
    await dialog.locator('.export-preflight__table').getByText('Shopify 登录账号不是有效的邮箱地址格式', { exact: true }).waitFor()
    assert.equal(await submit.isDisabled(), true)
    assert.equal(requests.filter(r => r.path === '/api/accounts/export').length, 0)
    assert.deepEqual(requests[0].body, { source: 'identities', ids: ['101', '102'], business_platforms: ['shopify'] })
    await verifyLayout(page, 'blocked-desktop')
    await page.setViewportSize({ width: 390, height: 844 })
    await verifyLayout(page, 'blocked-mobile')
    blocked = false
    await dialog.getByRole('button', { name: '重新预检', exact: true }).click()
    await dialog.locator('.export-preflight__mobile-items').getByText('本地条件满足，邮箱待验证', { exact: true }).first().waitFor()
    await dialog.locator('.export-preflight__confirm .el-checkbox').nth(0).click()
    assert.equal(await submit.isDisabled(), true)
    await dialog.locator('.export-preflight__confirm .el-checkbox').nth(1).click()
    assert.equal(await submit.isEnabled(), true)
    await verifyLayout(page, 'confirmation-mobile')
    await submit.click()
    await dialog.getByText('预检后账号出现新任务，请重新预检', { exact: true }).waitFor()
    assert.equal(await submit.isDisabled(), true)
    assert.equal(await dialog.getByRole('checkbox').count(), 0)
    await dialog.getByRole('button', { name: '只读预检', exact: true }).click()
    await dialog.locator('.export-preflight__confirm .el-checkbox').nth(0).click()
    await dialog.locator('.export-preflight__confirm .el-checkbox').nth(1).click()
    formalMode = 'pending'
    await submit.click()
    await dialog.getByTestId('export-record-id').getByText(recordId, { exact: true }).waitFor()
    const downloadButton = dialog.getByRole('button', { name: '下载原文件', exact: true })
    assert.equal(await downloadButton.isDisabled(), true)
    await dialog.getByText('邮箱确认已超过 10 分钟，请联系管理员核对原批次；不要重新导出或解除导出锁。', { exact: true }).waitFor()
    assert.equal(await page.evaluate(() => window.exportSmoke.changed), 1)
    await verifyLayout(page, 'pending-mobile')
    ready = true
    await page.waitForFunction(() => [...document.querySelectorAll('.el-dialog button')].some(button => button.textContent.includes('下载原文件') && !button.disabled))
    await page.setViewportSize({ width: 1440, height: 1000 })
    await verifyLayout(page, 'ready-desktop')
    const downloadEvent = page.waitForEvent('download')
    await downloadButton.click()
    const download = await downloadEvent
    assert.equal(download.suggestedFilename(), 'original.xlsx')
    assert.deepEqual(await fs.readFile(await download.path()), original)
    assert.equal(requests.filter(r => r.path === '/api/accounts/export').length, 2)
    await dialog.getByRole('button', { name: '查看导出记录', exact: true }).click()
    await page.getByRole('button', { name: '刷新导出记录', exact: true }).waitFor()
    assert.equal(await page.evaluate(() => window.exportSmoke.openedRecord), recordId)
    ready = false
    await page.getByRole('button', { name: '刷新导出记录', exact: true }).click()
    await page.getByText('部分邮箱确认已超过 10 分钟，请联系管理员核对原批次；账号导出锁保留，请勿重复导出。', { exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: '下载原文件', exact: true }).isDisabled(), true)
    ready = true
    await page.getByRole('button', { name: '刷新导出记录', exact: true }).click()
    await page.waitForFunction(() => [...document.querySelectorAll('button[aria-label="下载原文件"]')].some(button => !button.disabled))
    const beforeDenied = requests.length
    await mount(page, true)
    await page.getByText('当前账号没有导出权限', { exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: '只读预检', exact: true }).isDisabled(), true)
    assert.equal(requests.length, beforeDenied)
    assert.deepEqual(unexpected, [])
    assert.deepEqual(errors, [])
    console.log(JSON.stringify({ result: 'passed', scenarios: ['full-report', 'blocked-submit', 'email-acknowledgement',
      'submit-recheck', 'pending-receipt', 'status-poll', 'original-download-bytes', 'records-refresh', 'export-permission', 'desktop-mobile-layout'],
      preflights: requests.filter(r => r.path.endsWith('/preflight')).length,
      submissions: requests.filter(r => r.path === '/api/accounts/export').length,
      statusReads: requests.filter(r => r.path.endsWith('/status')).length,
      screenshots: 5, realExports: 0 }))
  } finally {
    await browser.close()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
