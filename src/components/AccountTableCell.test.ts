import { ID_INJECTION_KEY, ZINDEX_INJECTION_KEY } from 'element-plus'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { http } from '@/api/http'
import AccountTableCell from './AccountTableCell.vue'
import crudPageSource from './CrudPage.vue?raw'

vi.mock('element-plus/es/components/base/style/css', () => ({}))
vi.mock('element-plus/es/components/avatar/style/css', () => ({}))
vi.mock('element-plus/es/components/tag/style/css', () => ({}))
vi.mock('element-plus/es/components/tooltip/style/css', () => ({}))
vi.mock('element-plus/es/components/button/style/css', () => ({}))
vi.mock('element-plus/es/components/popover/style/css', () => ({}))

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

describe('共享登录凭据单元格', () => {
  afterEach(() => vi.restoreAllMocks())

  it('凭据列关闭整格溢出提示，避免将两项凭据拼在同一个提示里', () => {
    expect(crudPageSource).toContain(`:show-overflow-tooltip="column.type !== 'accountCredentials'"`)
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
})
