import { ID_INJECTION_KEY, ZINDEX_INJECTION_KEY } from 'element-plus'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { http } from '@/api/http'
import { hasPermission } from '@/utils/permissions'
import AccountTableCell from './AccountTableCell.vue'
import crudPageSource from './CrudPage.vue?raw'

const permissions = vi.hoisted(() => new Set<string>())
const authState = vi.hoisted(() => ({ user: null as Parameters<typeof hasPermission>[0] }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({
  get user() { return authState.user },
  can: (code: string) => authState.user ? hasPermission(authState.user, code) : permissions.has(code),
}) }))

vi.mock('element-plus/es/components/base/style/css', () => ({}))
vi.mock('element-plus/es/components/avatar/style/css', () => ({}))
vi.mock('element-plus/es/components/tag/style/css', () => ({}))
vi.mock('element-plus/es/components/tooltip/style/css', () => ({}))
vi.mock('element-plus/es/components/button/style/css', () => ({}))
vi.mock('element-plus/es/components/popover/style/css', () => ({}))
vi.mock('element-plus/es/components/alert/style/css', () => ({}))
vi.mock('element-plus/es/components/dialog/style/css', () => ({}))
vi.mock('element-plus/es/components/form/style/css', () => ({}))
vi.mock('element-plus/es/components/form-item/style/css', () => ({}))
vi.mock('element-plus/es/components/input/style/css', () => ({}))

async function renderCredentials(row: Record<string, unknown>, sharedCredentials = false) {
  const app = createSSRApp(AccountTableCell, {
    kind: 'accountCredentials',
    row,
    column: { key: 'password_secret_ref', label: '登录凭证', type: 'accountCredentials' },
    sharedCredentials,
  })
  app.provide(ID_INJECTION_KEY, { prefix: 0, current: 0 })
  app.provide(ZINDEX_INJECTION_KEY, { current: 0 })
  return renderToString(app)
}

async function renderIdentity(row: Record<string, unknown>) {
  const app = createSSRApp(AccountTableCell, {
    kind: 'accountIdentity',
    row,
    column: { key: 'login_username', label: '账号信息', type: 'accountIdentity' },
  })
  app.provide(ID_INJECTION_KEY, { prefix: 0, current: 0 })
  app.provide(ZINDEX_INJECTION_KEY, { current: 0 })
  return renderToString(app)
}

describe('共享登录凭据单元格', () => {
  beforeEach(() => {
    authState.user = null
    permissions.clear()
    permissions.add('accounts.credentials')
    permissions.add('accounts.totp')
  })
  afterEach(() => vi.restoreAllMocks())

  it.each([true, false])('独立授权超管直接展示原文，不提供密码验证入口 %s', async (shared) => {
    authState.user = { roles: ['super_admin'], permissions: [], status: 'active',
      is_system_admin: false, account_credential_reveal_allowed: true }
    const html = await renderCredentials({ id: '1', password_secret_ref: 'granted-password',
      totp_secret_ref: 'granted-secret', can_read_credentials: true }, shared)
    expect(html).toContain('granted-password')
    expect(html).toContain('granted-secret')
    expect(html).not.toContain('无凭据读取权限')
    expect(html).not.toContain('aria-label="验证密码查看当前账号凭据"')
    if (shared) {
      expect(html).toContain('aria-label="复制密码"')
      expect(html).toContain('aria-label="复制 2FA"')
    }
    authState.user = { ...authState.user, account_credential_reveal_allowed: false }
    const revoked = await renderCredentials({ id: '1', password_secret_ref: 'granted-password',
      totp_secret_ref: 'granted-secret', can_read_credentials: true }, shared)
    expect(revoked).not.toContain('granted-password')
    expect(revoked).not.toContain('granted-secret')
    expect(revoked).toContain('无凭据读取权限')
  })

  it('基础查看即使收到旧凭据也不显示原值，不触发取码请求', async () => {
    permissions.clear()
    permissions.add('accounts.view')
    const get = vi.spyOn(http, 'getWithSignal')
    const html = await renderCredentials({ id: '1', password_secret_ref: 'old-password', totp_secret_ref: 'old-secret' }, true)
    expect(html).not.toContain('old-password')
    expect(html).not.toContain('old-secret')
    expect(html).toContain('无凭据读取权限')
    expect(html.match(/ disabled/g)).toHaveLength(3)
    expect(get).not.toHaveBeenCalled()
  })

  it('验证码权限不依赖密钥是否返回，两个凭据复制仍禁用', async () => {
    permissions.clear()
    permissions.add('accounts.totp')
    const html = await renderCredentials({ id: '1', has_totp: true, totp_secret_ref: null, can_read_credentials: false }, true)
    expect(html).toContain('无凭据读取权限')
    expect(html.match(/ disabled/g)).toHaveLength(2)
    expect(html).toContain('aria-label="查看 2FA 验证码"')
  })

  it('有密钥读取权限不自动允许验证码', async () => {
    permissions.delete('accounts.totp')
    const html = await renderCredentials({ id: '1', password_secret_ref: 'visible-password', totp_secret_ref: 'visible-secret', has_totp: true }, true)
    expect(html).toContain('visible-password')
    expect(html).toContain('visible-secret')
    expect(html.match(/ disabled/g)).toHaveLength(1)
  })

  it('服务端行级禁止读取时即使有全局凭据权限也隐藏原值', async () => {
    const html = await renderCredentials({ password_secret_ref: 'out-of-scope-password', can_read_credentials: false }, true)
    expect(html).not.toContain('out-of-scope-password')
    expect(html).toContain('无凭据读取权限')
  })

  it('凭据列和登录身份列关闭整格溢出提示，避免拼接多项内容', () => {
    expect(crudPageSource).toContain(
      `:show-overflow-tooltip="!['accountCredentials', 'loginIdentity'].includes(column.type || '')"`,
    )
  })

  it.each([true, false])('完整凭据提示仅绑定值文字，不绑定整行 %s', async (shared) => {
    const html = await renderCredentials({ password_secret_ref: 'password-only', totp_secret_ref: 'totp-only' }, shared)
    const rows = [...html.matchAll(/<div\b[^>]*class="account-credential-row\b[^>]*>/g)].map(match => match[0])
    const values = [...html.matchAll(/<code\b[^>]*>/g)].map(match => match[0])
    expect(rows).toHaveLength(2)
    expect(values).toHaveLength(2)
    for (const row of rows) expect(row).not.toContain('el-tooltip__trigger')
    for (const value of values) expect(value).toContain('el-tooltip__trigger')
  })

  it.each([true, false])('有账号 ID 时显示验证码入口，但渲染不触发请求 %s', async (shared) => {
    const get = vi.spyOn(http, 'getWithSignal')
    const html = await renderCredentials({ id: '1', totp_secret_ref: 'JBSWY3DPEHPK3PXP' }, shared)
    expect(html).toContain('aria-label="查看 2FA 验证码"')
    expect(get).not.toHaveBeenCalled()
  })

  it('父行显示密码和 2FA 原值以及两个复制按钮，不逐行请求详情', async () => {
    const get = vi.spyOn(http, 'get')
    const html = await renderCredentials({ password_secret_ref: 'visible-password', totp_secret_ref: '001234' }, true)
    expect(html).toContain('visible-password')
    expect(html).toContain('001234')
    expect(html.match(/<code[ >]/g)).toHaveLength(2)
    expect(html).toContain('aria-label="复制密码"')
    expect(html).toContain('aria-label="复制 2FA"')
    expect(html).not.toContain(' disabled')
    expect(get).not.toHaveBeenCalled()
  })

  it.each([{}, { password_secret_ref: null, totp_secret_ref: '' }])('缺失字段显示未设置并禁用复制', async (row) => {
    const html = await renderCredentials(row, true)
    expect(html.match(/>未设置<\/code>/g)).toHaveLength(2)
    expect(html.match(/ disabled/g)).toHaveLength(2)
  })

  it('普通账号列表保持原有两行展示，不添加复制按钮或修改缺失文案', async () => {
    const html = await renderCredentials({})
    expect(html.match(/>-<\/code>/g)).toHaveLength(2)
    expect(html).not.toContain('未设置')
    expect(html).not.toContain('aria-label="复制')
  })

  it('账号信息仅在凭据已经导出时展示已导出标识', async () => {
    const exported = await renderIdentity({
      login_username: 'account@example.com',
      credentials_exported_at: '2026-09-05T08:00:00Z',
    })
    const unexported = await renderIdentity({ login_username: 'account@example.com' })

    expect(exported).toContain('已导出')
    expect(unexported).not.toContain('已导出')
  })
})
