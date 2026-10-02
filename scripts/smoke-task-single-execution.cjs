// Local Vite rendering only; all API responses are synthetic.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5175'
const output = process.env.SMOKE_OUTPUT_DIR || 'logs'
const task = { id: 'single', task_type: 'benchmark_content_publish', title: '自动发帖测试',
  execution_scope: 'slot', slot_id: 'slot', slot_name: 'B-22', provider_slot_id: 'provider-22',
  account_id: 'account-1', business_platform: 'x', status: 'failed', child_total: 0,
  error_message: '环境加锁，打开环境失败', params: {}, result: {},
  started_at: '2026-10-02T06:00:00Z', finished_at: '2026-10-02T06:00:02Z' }

async function main() {
  await fs.mkdir(output, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const errors = [], requests = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/__task_single_smoke', route => route.fulfill({ contentType: 'text/html', body: '<html><body><div id="app"></div></body></html>' }))
    await page.route('**/api/**', route => {
      const url = new URL(route.request().url())
      if (!url.pathname.startsWith('/api/')) return route.continue()
      requests.push(url.pathname)
      let data = { items: [], total: 0 }
      if (url.pathname.endsWith('/events')) data = { items: [{ id: 'event', event_type: 'task.result_reported', status_to: 'failed', message: task.error_message, created_at: task.finished_at }] }
      else if (url.pathname === '/api/tasks/single') data = task
      else if (url.pathname === '/api/tasks/parent') data = { ...task, id: 'parent', task_type: 'template_batch', title: '批量任务', child_total: 1, slot_id: null }
      else if (url.pathname === '/api/tasks/parent/children') data = { items: [{ ...task, parent_task_run_id: 'parent' }], total: 1 }
      return route.fulfill({ json: { code: 0, msg: 'ok', data } })
    })
    await page.goto(base + '/__task_single_smoke')
    await page.evaluate(async () => {
      await import('/src/styles.css')
      const source = await (await fetch('/src/components/TaskDetailDrawer.vue')).text()
      const vuePath = source.match(/from "(\/node_modules\/\.vite\/deps\/vue\.js[^\"]*)"/)[1]
      const { createApp, h, ref } = await import(vuePath)
      const { default: Drawer } = await import('/src/components/TaskDetailDrawer.vue')
      const taskId = ref('single')
      window.setSmokeTask = id => { taskId.value = id }
      createApp({ setup: () => () => h(Drawer, { modelValue: true, taskId: taskId.value }) }).mount('#app')
    })
    const dialog = page.getByRole('dialog')
    await page.locator('#pane-basic').getByText('B-22', { exact: true }).waitFor()
    assert.ok((await dialog.innerText()).includes('provider-22'))
    await dialog.getByRole('tab', { name: '设备执行记录' }).click()
    const panel = page.locator('#pane-children')
    await panel.getByText('B-22', { exact: true }).waitFor()
    assert.ok((await panel.innerText()).includes(task.error_message))
    assert.equal(await panel.locator('.el-pagination').count(), 0)
    assert.ok(!requests.includes('/api/tasks/single/children'))
    await page.screenshot({ path: path.join(output, 'task-single-desktop.png'), fullPage: true })
    await panel.getByRole('button', { name: '执行时间线', exact: true }).click()
    await page.locator('#pane-events').getByText(task.error_message, { exact: true }).waitFor()
    assert.equal(requests.filter(p => p === '/api/tasks/single').length, 1)

    await page.evaluate(() => window.setSmokeTask('parent'))
    await dialog.getByRole('heading', { name: '任务详情：批量任务' }).waitFor()
    await dialog.getByRole('tab', { name: '设备执行记录' }).click()
    await panel.getByText('B-22', { exact: true }).waitFor()
    await panel.locator('.el-pagination').waitFor()
    await panel.getByRole('button', { name: '查看', exact: true }).click()
    await dialog.getByRole('tab', { name: '设备执行记录' }).click()
    await panel.getByRole('button', { name: '执行时间线', exact: true }).waitFor()
    await page.setViewportSize({ width: 390, height: 844 })
    const bounds = await dialog.boundingBox()
    assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 391)
    await page.screenshot({ path: path.join(output, 'task-single-mobile.png'), fullPage: true })
    assert.deepEqual(errors, [])
    console.log('PASS: single device, concrete error, own timeline, batch child navigation, mobile dialog')
  } finally {
    await browser.close()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
