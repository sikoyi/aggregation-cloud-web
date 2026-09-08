const assert = require('node:assert/strict')
const { chromium } = require('playwright')

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } })
    page.setDefaultTimeout(10000)
    const errors = [], managementReads = [], requests = [], submissions = []
    page.on('pageerror', error => errors.push(error.message))
    const script = { id: '7', script_key: 'safe_script', name: 'Business script', purpose: 'general_task',
      account_usage_mode: 'none', supported_business_platforms: ['threads'],
      supported_runtime_platforms: ['fingerprint_browser'], supported_providers: ['morelogin'], status: 'enabled' }
    const template = { id: '8', name: 'Operator template', script_key: script.script_key,
      created_by: 'other-operator', can_manage: false,
      business_platform: 'threads', runtime_platform: 'fingerprint_browser', provider: 'morelogin',
      execution_count: 1, execution_mode: 'immediate', default_params: { message: 'Default message' }, status: 'enabled' }
    let rejectScript = false
    await page.route('**/__dispatch_permission_smoke', route => route.fulfill({ contentType: 'text/html',
      body: '<html><meta name="viewport" content="width=device-width, initial-scale=1"><body><div id="app"></div></body></html>' }))
    await page.route('**/api/**', async route => {
      const request = route.request(), url = new URL(request.url()), path = url.pathname
      if (!path.startsWith('/api/')) return route.continue()
      requests.push(path)
      if (path.startsWith('/api/scripts')) {
        managementReads.push(path)
        return route.fulfill({ status: 403, json: { code: 40300, msg: 'No script management permission' } })
      }
      let data = { items: [], total: 0, page: 1, page_size: 20 }
      if (path === '/api/task-templates') data = { ...data, items: [template], total: 1 }
      else if (path === '/api/task-templates/8') data = template
      else if (path === '/api/task-script-options') data = { ...data, items: [script], total: 1 }
      else if (path.includes('/task-script-options/by-key/')) {
        if (rejectScript) return route.fulfill({ status: 403, json: { code: 40300, msg: 'Script option access denied' } })
        data = script
      } else if (path === '/api/task-script-options/7/params') {
        data = [{ id: '9', param_key: 'message', name: 'Message parameter', param_type: 'string',
          required: true, default_value: '', options: [], sort_order: 1 }]
      } else if (path === '/api/execution-slots/selection-groups') {
        data = { groups: [{ id: 'group', name: 'Test devices', device_count: 1 }], total: 1 }
      } else if (path === '/api/execution-slots/selection-page') {
        data = { ...data, items: [{ id: '10', name: 'Test device', provider_slot_id: 'external-10', status: 'idle' }], total: 1 }
      } else if (path === '/api/execution-slots/selection-ids') data = { slot_ids: ['10'] }
      else if (path === '/api/tasks/from-template') {
        submissions.push(request.postDataJSON())
        data = { id: 'mock-task', created_count: 1 }
      } else if (path === '/api/system-settings/defaults') {
        return route.fulfill({ status: 403, json: { code: 40300, msg: 'No system settings permission' } })
      }
      await route.fulfill({ json: { code: 0, msg: 'ok', data } })
    })
    await page.goto(`${process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173'}/__dispatch_permission_smoke`)
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
      window.setDispatchPermission = value => {
        auth.user = { id: 'test', username: 'test', roles: ['operator'],
          permissions: ['tasks.view', 'templates.view', 'devices.view', ...(value ? ['tasks.dispatch'] : [])] }
      }
      window.setDispatchPermission(true)
      window.openDispatch = () => view.value.openCreate()
      createApp({ setup: () => () => h(CrudPage, { ref: view, config: resources.tasks }) }).use(pinia).mount('#app')
    })
    await page.getByRole('button', { name: '下发任务', exact: true }).click()
    const dialog = page.locator('.el-dialog:visible, .el-drawer:visible').last()
    await dialog.locator('.el-form-item').filter({ has: page.getByText('任务模板', { exact: true }) }).getByRole('combobox').click()
    await page.getByRole('option', { name: /Operator template/ }).click()
    await dialog.getByText(/Message parameter/).waitFor()
    await dialog.locator('.template-param-card input').fill('Operator override')
    await dialog.locator('.slot-tree-select .el-checkbox').first().click()
    await page.waitForTimeout(400)
    await page.screenshot({ path: 'logs/task-dispatch-permissions-desktop.png', fullPage: true })
    await dialog.getByRole('button', { name: '确认执行', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    assert.equal(submissions.length, 1)
    assert.equal(submissions[0].template_id, '8')
    assert.deepEqual(submissions[0].slot_ids, ['10'])
    assert.equal(submissions[0].params.message, 'Operator override')
    assert.equal('script_key' in submissions[0], false)
    assert.deepEqual(managementReads, [])
    assert.ok(requests.includes('/api/task-script-options/7/params'))

    await page.getByRole('button', { name: '下发任务', exact: true }).click()
    await page.evaluate(() => window.setDispatchPermission(false))
    await dialog.getByRole('button', { name: '确认执行', exact: true }).click()
    await page.getByText('当前账号没有执行此操作的权限', { exact: true }).waitFor()
    assert.equal(submissions.length, 1)
    await dialog.getByRole('button', { name: '取消', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    await page.evaluate(() => window.openDispatch())
    assert.equal(await page.locator('.el-dialog:visible, .el-drawer:visible').count(), 0)

    await page.evaluate(() => window.setDispatchPermission(true))
    rejectScript = true
    await page.getByRole('button', { name: '下发任务', exact: true }).click()
    await dialog.locator('.el-form-item').filter({ has: page.getByText('任务模板', { exact: true }) }).getByRole('combobox').click()
    await page.getByRole('option', { name: /Operator template/ }).click()
    await page.getByText('Script option access denied', { exact: true }).waitFor()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(350)
    const bounds = await dialog.boundingBox()
    assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390)
    await page.screenshot({ path: 'logs/task-dispatch-permissions-mobile.png', fullPage: true })
    assert.equal(submissions.length, 1)
    assert.deepEqual(errors, [])
    console.log('PASS: operator selects template/parameters/device and submits; no script management reads; permission revocation blocks; failures reported; no real tasks')
  } catch (error) {
    const page = browser.contexts()[0]?.pages()[0]
    if (page) {
      await page.screenshot({ path: 'logs/task-dispatch-permissions-failure.png', fullPage: true })
      console.error((await page.locator('body').innerText()).slice(-3000))
    }
    throw error
  } finally { await browser.close() }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
