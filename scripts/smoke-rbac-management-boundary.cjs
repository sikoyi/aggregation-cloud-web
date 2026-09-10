// Synthetic users and mocked APIs only; never writes to the running backend.
const assert = require('node:assert/strict')
const { chromium } = require('playwright')

const writes = ['users.create', 'users.edit', 'users.disable', 'users.reset_password', 'users.assign_roles',
  'roles.create', 'roles.edit', 'roles.disable', 'roles.delete']
const common = { status: 'active', version: 1, created_at: '2026-09-10T00:00:00Z', updated_at: '2026-09-10T00:00:00Z',
  business_platform_scope: null, runtime_platform_scope: null, provider_scope: null }
const users = [
  { ...common, id: 'root', username: 'admin', display_name: 'System admin', is_system_admin: true,
    roles: ['super_admin'], role_ids: ['root-role'], role_names: ['Super admin'], permissions: [], last_login_at: null },
  { ...common, id: 'operator', username: 'operator', display_name: 'Test operator', is_system_admin: false,
    roles: ['custom_operator'], role_ids: ['operator-role'], role_names: ['Operator'], permissions: writes, last_login_at: null },
]
const roles = [
  { ...common, id: 'root-role', code: 'super_admin', name: 'Super admin', is_system: true, permission_codes: [], user_count: 1 },
  { ...common, id: 'operator-role', code: 'custom_operator', name: 'Operator', is_system: false,
    permission_codes: [...writes, 'tasks.dispatch'], user_count: 1 },
]

async function mount(browser, view) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  page.setDefaultTimeout(10000)
  const errors = [], mutations = [], reads = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/__rbac_smoke', route => route.fulfill({ contentType: 'text/html',
    body: '<html><meta name="viewport" content="width=device-width, initial-scale=1"><body><div id="app"></div></body></html>' }))
  await page.route('**/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    if (req.method() === 'GET') reads.push(path)
    let data
    if (req.method() !== 'GET') {
      mutations.push({ path, body: req.postDataJSON() })
      data = { ...roles[1], ...req.postDataJSON(), id: 'created', version: 2 }
    } else if (path === '/api/users') data = { items: users, total: 2, page: 1, page_size: 20 }
    else if (path === '/api/roles') data = { items: roles, total: 2, page: 1, page_size: 20 }
    else if (path === '/api/permissions') data = [{ module: 'test', module_name: 'Test permissions', items:
      [...writes, 'accounts.credentials', 'registration_resources.reveal', 'tasks.dispatch'].map(code => ({ code, name: code })) }]
    else throw new Error(`Unexpected API ${path}`)
    await route.fulfill({ json: { code: 0, msg: 'ok', data } })
  })
  await page.goto(`${process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173'}/__rbac_smoke`)
  await page.evaluate(async ({ view, writes }) => {
    await import('/src/styles.css')
    const entry = await (await fetch('/src/main.ts')).text()
    for (const match of entry.matchAll(/import "([^\"]*(?:message|message-box|notification)[^\"]*)"/g)) await import(match[1])
    const source = await (await fetch(`/src/views/${view}.vue`)).text()
    const { createApp, h } = await import(source.match(/from "(\/node_modules\/\.vite\/deps\/vue\.js[^"]*)"/)[1])
    const authSource = await (await fetch('/src/stores/auth.ts')).text()
    const { createPinia } = await import(authSource.match(/from "(\/node_modules\/\.vite\/deps\/pinia\.js[^"]*)"/)[1])
    const { useAuthStore } = await import('/src/stores/auth.ts')
    const { default: View } = await import(`/src/views/${view}.vue`)
    const pinia = createPinia(), auth = useAuthStore(pinia)
    window.setRbacRole = (admin, status = 'active') => {
      auth.user = { id: 'other-admin', username: 'other-admin', roles: [admin ? 'super_admin' : 'operator'],
        status, is_system_admin: false, permissions: [...writes, 'users.view', ...(view === 'RoleManagementView' ? ['roles.view'] : []), 'tasks.dispatch', 'accounts.totp'] }
    }
    window.setRbacRole(false)
    createApp({ setup: () => () => h(View) }).use(pinia).mount('#app')
  }, { view, writes })
  await page.locator('.el-table__row').nth(1).waitFor()
  return { page, mutations, errors, reads }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const user = await mount(browser, 'UserManagementView')
    const { page } = user
    assert.equal(await page.getByRole('button', { name: '新增用户', exact: true }).count(), 0)
    assert.equal(await page.locator('.row-actions button').count(), 0)
    assert.equal(user.reads.includes('/api/roles'), false)
    await page.screenshot({ path: 'logs/rbac-users-readonly.png', fullPage: true, animations: 'disabled' })
    await page.evaluate(() => window.setRbacRole(true))
    const rootRow = page.locator('.el-table__row').first()
    assert.equal(await rootRow.locator('.row-actions button').count(), 2)
    assert.equal(await rootRow.getByRole('button', { name: '禁用', exact: true }).isDisabled(), true)
    await rootRow.locator('.row-actions button').first().click()
    let dialog = page.locator('.el-dialog:visible')
    assert.equal(await dialog.getByRole('combobox').isDisabled(), true)
    await dialog.getByRole('button', { name: '取消', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: '新增用户', exact: true }).click()
    await dialog.locator('input[type=password]').fill('DraftPassword123')
    await page.evaluate(() => window.setRbacRole(false))
    await dialog.waitFor({ state: 'hidden' })
    assert.equal(user.mutations.length, 0)
    await page.evaluate(() => window.setRbacRole(true))
    await page.getByRole('button', { name: '新增用户', exact: true }).click()
    assert.equal(await dialog.locator('input[type=password]').inputValue(), '')
    await dialog.getByRole('button', { name: '取消', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    const operatorRow = page.locator('.el-table__row').nth(1)
    await operatorRow.getByRole('button', { name: '禁用', exact: true }).click()
    await page.locator('.el-message-box:visible').waitFor()
    await page.evaluate(() => window.setRbacRole(false))
    await page.locator('.el-message-box:visible').getByRole('button', { name: '禁用', exact: true }).click()
    await page.locator('.el-message-box:visible').waitFor({ state: 'hidden' })
    assert.equal(user.mutations.length, 0)
    await page.evaluate(() => window.setRbacRole(true))
    await operatorRow.locator('.row-actions button').nth(1).click()
    await dialog.locator('input[type=password]').first().fill('ResetDraft123')
    await page.evaluate(() => window.setRbacRole(true, 'disabled'))
    await dialog.waitFor({ state: 'hidden' })
    assert.equal(user.mutations.length, 0)
    assert.deepEqual(user.errors, [])

    const role = await mount(browser, 'RoleManagementView')
    assert.equal(await role.page.getByRole('button', { name: '新增角色', exact: true }).count(), 0)
    assert.equal(await role.page.locator('.row-actions button').count(), 0)
    await role.page.evaluate(() => window.setRbacRole(true))
    await role.page.locator('.el-table__row').nth(1).locator('.row-actions button').first().click()
    dialog = role.page.locator('.el-dialog:visible')
    await dialog.getByText('tasks.dispatch', { exact: true }).waitFor()
    for (const code of [...writes, 'accounts.credentials', 'registration_resources.reveal']) {
      assert.equal(await dialog.getByText(code, { exact: true }).count(), 0)
    }
    await role.page.screenshot({ path: 'logs/rbac-role-admin-editor.png', fullPage: true, animations: 'disabled' })
    await role.page.evaluate(() => window.setRbacRole(false))
    await dialog.waitFor({ state: 'hidden' })
    assert.equal(role.mutations.length, 0)
    await role.page.evaluate(() => window.setRbacRole(true))
    await role.page.locator('.el-table__row').nth(1).locator('.row-actions button').first().click()
    await dialog.getByRole('button', { name: '确认', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    assert.equal(role.mutations.length, 1)
    assert.deepEqual(role.mutations[0].body.permission_codes, ['tasks.dispatch'])
    await role.page.locator('.el-table__row').nth(1).getByRole('button', { name: '禁用', exact: true }).click()
    await role.page.locator('.el-message-box:visible').waitFor()
    await role.page.evaluate(() => window.setRbacRole(false))
    await role.page.locator('.el-message-box:visible').getByRole('button', { name: '禁用', exact: true }).click()
    await role.page.locator('.el-message-box:visible').waitFor({ state: 'hidden' })
    assert.equal(role.mutations.length, 1)
    assert.deepEqual(role.errors, [])
    console.log('PASS: legacy grants denied, admin controls, bootstrap protection, draft cleanup, post-confirmation revocation and grantable permission filtering')
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
