// Local UI regression with mocked API responses; never writes real templates or dispatches devices.
const assert = require('node:assert/strict')
const { chromium } = require('playwright')

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
    page.setDefaultTimeout(10000)
    const errors = [], mutations = []
    let admin = false, failDetail = false, failScript = false
    page.on('pageerror', error => errors.push(error.message))
    const base = { tenant_id: 'tenant', script_key: 'shared', script_name: 'Shared script',
      business_platform: 'threads', runtime_platform: 'fingerprint_browser', provider: 'morelogin',
      execution_count: 1, execution_mode: 'immediate', status: 'enabled', default_params: { message: 'Example value' },
      created_at: '2026-09-08T01:00:00Z', updated_at: '2026-09-08T01:00:00Z' }
    const records = ['operator', 'other', 'admin', 'legacy'].map((id, index) => ({ ...base, id: String(index + 1),
      name: `${id} template`, created_by: id === 'legacy' ? null : id,
      creator_display_name: id === 'legacy' ? null : `${id} creator`, creator_username: id === 'legacy' ? null : id }))
    const output = record => ({ ...record, can_manage: admin || record.created_by === 'operator' })
    await page.route('**/__template_ownership_smoke', route => route.fulfill({ contentType: 'text/html',
      body: '<html><meta name="viewport" content="width=device-width, initial-scale=1"><body><div id="app"></div></body></html>' }))
    await page.route('**/api/**', async route => {
      const req = route.request(), path = new URL(req.url()).pathname
      if (!path.startsWith('/api/')) return route.continue()
      let data = { items: [], total: 0, page: 1, page_size: 20 }
      if (req.method() !== 'GET') {
        mutations.push({ path, method: req.method(), body: req.postDataJSON() })
        data = output({ ...records[0], id: 'copy', created_by: 'operator' })
      } else if (path === '/api/task-templates') {
        data = { ...data, items: records.map(output), total: records.length }
      } else if (/^\/api\/task-templates\/\d+$/.test(path)) {
        if (failDetail) return route.fulfill({ status: 500, json: { code: 50000, msg: 'Template load failed' } })
        data = output(records.find(record => record.id === path.split('/').pop()))
      } else if (path.includes('/task-script-options/by-key/')) {
        if (failScript) return route.fulfill({ status: 404, json: { code: 40400, msg: 'Script unavailable' } })
        data = { id: '7', script_key: 'shared', name: 'Shared script' }
      } else if (path === '/api/task-script-options/7/params') {
        data = [{ param_key: 'message', name: 'Message parameter', param_type: 'string' }]
      }
      await route.fulfill({ json: { code: 0, msg: 'ok', data } })
    })
    await page.goto(`${process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173'}/__template_ownership_smoke`)
    await page.evaluate(async () => {
      await import('/src/styles.css')
      const entry = await (await fetch('/src/main.ts')).text()
      for (const match of entry.matchAll(/import "([^\"]*(?:message|message-box|notification)[^\"]*)"/g)) await import(match[1])
      const source = await (await fetch('/src/components/CrudPage.vue')).text()
      const { createApp, h, ref } = await import(source.match(/from "(\/node_modules\/\.vite\/deps\/vue\.js[^"]*)"/)[1])
      const authSource = await (await fetch('/src/stores/auth.ts')).text()
      const { createPinia } = await import(authSource.match(/from "(\/node_modules\/\.vite\/deps\/pinia\.js[^"]*)"/)[1])
      const { useAuthStore } = await import('/src/stores/auth.ts')
      const { resources } = await import('/src/config/resources.ts')
      const { default: CrudPage } = await import('/src/components/CrudPage.vue')
      const pinia = createPinia(), auth = useAuthStore(pinia), view = ref(null)
      window.setTemplateRole = role => {
        auth.user = { id: 'operator', tenant_id: 'tenant', username: 'operator', roles: [role],
          permissions: role === 'viewer' ? ['templates.view'] :
            ['templates.view', 'templates.create', 'templates.edit', 'templates.delete', 'tasks.dispatch'] }
      }
      window.setTemplateRole('operator')
      window.reloadTemplates = () => view.value.loadRows()
      createApp({ setup: () => () => h(CrudPage, { ref: view, config: resources.taskTemplates }) }).use(pinia).mount('#app')
    })
    const rows = page.locator('.el-table__body-wrapper .el-table__row')
    await rows.nth(3).waitFor()
    assert.equal(await page.getByRole('columnheader', { name: '创建人', exact: true }).count(), 1)
    for (let i = 0; i < 4; i++) {
      assert.equal(await rows.nth(i).getByRole('button', { name: '编辑', exact: true }).count(), i === 0 ? 1 : 0)
      assert.equal(await rows.nth(i).getByRole('button', { name: '删除', exact: true }).count(), i === 0 ? 1 : 0)
      assert.equal(await rows.nth(i).getByRole('switch').count(), i === 0 ? 1 : 0)
      assert.equal(await rows.nth(i).getByRole('button', { name: '查看模板' }).count(), 1)
      assert.equal(await rows.nth(i).getByRole('button', { name: '克隆模板' }).count(), 1)
    }
    await page.screenshot({ path: 'logs/template-ownership-desktop.png', fullPage: true, animations: 'disabled' })
    await rows.nth(1).getByRole('button', { name: '查看模板' }).click()
    const dialog = page.locator('.el-dialog:visible').last()
    await dialog.getByText('Message parameter', { exact: true }).waitFor()
    assert.equal(await dialog.getByRole('button', { name: '保存', exact: true }).count(), 0)
    assert.equal(await dialog.locator('input, textarea').count(), 0)
    await dialog.getByText('Example value', { exact: true }).waitFor()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(200)
    const bounds = await dialog.boundingBox()
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390)
    await page.screenshot({ path: 'logs/template-ownership-mobile-detail.png', fullPage: true, animations: 'disabled' })
    await dialog.getByRole('button', { name: '关闭', exact: true }).click()
    await page.setViewportSize({ width: 1600, height: 1000 })

    await rows.nth(0).locator('.el-checkbox').click()
    await rows.nth(1).locator('.el-checkbox').click()
    for (const name of ['批量启用模板', '批量禁用模板', '批量删除']) {
      await page.getByRole('button', { name, exact: true }).click()
      await page.waitForTimeout(100)
      assert.equal(mutations.length, 0)
      assert.equal(await page.locator('.el-message-box:visible').count(), 0)
    }
    await page.getByRole('button', { name: '取消选择', exact: true }).click()
    await rows.nth(0).locator('.el-switch').click()
    await page.waitForTimeout(200)
    assert.equal(mutations.length, 1)
    assert.equal(mutations[0].path, '/api/task-templates/1/disable')

    await rows.nth(2).getByRole('button', { name: '克隆模板' }).click()
    await page.locator('.el-dialog:visible').last().getByRole('button', { name: '保存', exact: true }).click()
    await page.waitForTimeout(200)
    assert.equal(mutations.at(-1).path, '/api/task-templates/3/clone')

    failDetail = true
    await rows.nth(1).getByRole('button', { name: '查看模板' }).click()
    await dialog.getByText('Template load failed').waitFor()
    failDetail = false
    failScript = true
    await dialog.getByRole('button', { name: '重试', exact: true }).click()
    await dialog.getByText('脚本定义暂不可用，默认参数按原字段展示').waitFor()
    await dialog.getByText('Example value', { exact: true }).waitFor()
    await dialog.getByRole('button', { name: '关闭', exact: true }).click()

    admin = true
    await page.evaluate(async () => { window.setTemplateRole('super_admin'); await window.reloadTemplates() })
    assert.equal(await rows.getByRole('button', { name: '编辑', exact: true }).count(), 4)
    assert.equal(await rows.getByRole('switch').count(), 4)
    admin = false
    await page.evaluate(async () => { window.setTemplateRole('viewer'); await window.reloadTemplates() })
    assert.equal(await rows.getByRole('button', { name: '编辑', exact: true }).count(), 0)
    assert.equal(await rows.getByRole('switch').count(), 0)
    assert.equal(await rows.getByRole('button', { name: '克隆模板' }).count(), 0)
    assert.deepEqual(errors, [])
    console.log('PASS: creators; owner/admin management; shared read-only details and clone; mixed batches blocked; viewer isolation; load retry; desktop/mobile; no real writes')
  } catch (error) {
    const page = browser.contexts()[0]?.pages()[0]
    if (page) {
      await page.screenshot({ path: 'logs/template-ownership-failure.png', fullPage: true })
      console.error((await page.locator('body').innerText()).slice(-3500))
    }
    throw error
  } finally { await browser.close() }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
