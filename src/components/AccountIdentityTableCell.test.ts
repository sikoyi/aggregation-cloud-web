import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it, vi } from 'vitest'

import AccountIdentityTableCell from './AccountIdentityTableCell.vue'

vi.mock('element-plus/es/components/base/style/css', () => ({}))
vi.mock('element-plus/es/components/tag/style/css', () => ({}))

async function renderCell(kind: 'loginIdentity' | 'identityPlatforms', row: Record<string, unknown>) {
  return renderToString(createSSRApp(AccountIdentityTableCell, { kind, row }))
}

describe('账号身份列表单元格', () => {
  const row = {
    id: 'identity-1',
    display_name: 'operator@example.com',
    login_username: 'operator@example.com',
    account_count: 2,
    platform_summaries: [
      {
        account_id: 'account-1',
        business_platform: 'shopify',
        display_name: 'Chelsea Perez',
        username: 'shopify-login',
        health_status: 'unknown',
        login_status: 'not_logged_in',
      },
      {
        account_id: 'account-2',
        business_platform: 'threads',
        display_name: 'Threads Nickname',
        username: 'threads-login',
        health_status: 'normal',
        login_status: 'logged_in',
      },
    ],
  }

  it('身份名称与邮箱重复时使用平台昵称，并且邮箱只展示一次', async () => {
    const html = await renderCell('loginIdentity', row)

    expect(html).toContain('>Chelsea Perez</strong>')
    expect(html.match(/operator@example\.com/g)).toHaveLength(1)
    expect(html).toContain('2 个平台账号')
  })

  it('优先保留身份自身的非重复昵称', async () => {
    const html = await renderCell('loginIdentity', { ...row, display_name: 'Identity Nickname' })

    expect(html).toContain('>Identity Nickname</strong>')
    expect(html).toContain('>operator@example.com</small>')
  })

  it('没有昵称时只展示一次登录邮箱', async () => {
    const html = await renderCell('loginIdentity', {
      ...row,
      platform_summaries: [{ ...row.platform_summaries[0], display_name: null, username: 'operator@example.com' }],
    })

    expect(html.match(/operator@example\.com/g)).toHaveLength(1)
  })

  it('主表平台状态不重复展示各平台昵称', async () => {
    const html = await renderCell('identityPlatforms', row)

    expect(html).toContain('Shopify')
    expect(html).toContain('Threads')
    expect(html).not.toContain('Chelsea Perez')
    expect(html).not.toContain('Threads Nickname')
  })
})
