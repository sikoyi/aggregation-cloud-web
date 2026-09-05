import { ID_INJECTION_KEY, ZINDEX_INJECTION_KEY } from 'element-plus'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it, vi } from 'vitest'

import AccountIdentityTableCell from './AccountIdentityTableCell.vue'

vi.mock('element-plus/es/components/base/style/css', () => ({}))
vi.mock('element-plus/es/components/tag/style/css', () => ({}))
vi.mock('element-plus/es/components/tooltip/style/css', () => ({}))

async function renderCell(kind: 'loginIdentity' | 'identityTags' | 'identityPlatforms', row: Record<string, unknown>) {
  const app = createSSRApp(AccountIdentityTableCell, { kind, row })
  app.provide(ID_INJECTION_KEY, { prefix: 0, current: 0 })
  app.provide(ZINDEX_INJECTION_KEY, { current: 0 })
  return renderToString(app)
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
        tag_names: ['客户', '新号'],
      },
      {
        account_id: 'account-2',
        business_platform: 'threads',
        display_name: 'Threads Nickname',
        username: 'threads-login',
        health_status: 'normal',
        login_status: 'logged_in',
        tag_names: ['新号', '重点账号'],
      },
    ],
  }

  it('登录身份只展示邮箱，并在同一列展示身份 ID 和平台账号数', async () => {
    const html = await renderCell('loginIdentity', row)

    expect(html).toContain('>operator@example.com</strong>')
    expect(html.match(/operator@example\.com/g)).toHaveLength(1)
    expect(html).toContain('身份 ID identity-1 · 2 个平台账号')
    expect(html).toContain('2 个平台账号')
    expect(html).not.toContain('Chelsea Perez')
    expect(html).not.toContain('Threads Nickname')
  })

  it('主表平台状态不重复展示各平台昵称', async () => {
    const html = await renderCell('identityPlatforms', row)

    expect(html).toContain('Shopify')
    expect(html).toContain('Threads')
    expect(html).toContain('未知')
    expect(html).toContain('正常')
    expect(html).not.toContain('未登录')
    expect(html).not.toContain('已登录')
    expect(html).not.toContain('Chelsea Perez')
    expect(html).not.toContain('Threads Nickname')
  })

  it('主表按当前可见平台账号去重展示标签并集', async () => {
    const html = await renderCell('identityTags', row)

    expect(html.match(/>新号<\/span>/g)).toHaveLength(1)
    expect(html).toContain('>客户</span>')
    expect(html).toContain('+1')
  })

  it('没有平台账号标签时明确显示暂无标签', async () => {
    const html = await renderCell('identityTags', {
      ...row,
      platform_summaries: row.platform_summaries.map((item) => ({ ...item, tag_names: [] })),
    })

    expect(html).toContain('暂无标签')
  })
})
