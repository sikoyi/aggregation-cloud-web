import { ID_INJECTION_KEY, ZINDEX_INJECTION_KEY } from 'element-plus'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it, vi } from 'vitest'

import DeviceTableCell from './DeviceTableCell.vue'

vi.mock('element-plus/es/components/base/style/css', () => ({}))
vi.mock('element-plus/es/components/tag/style/css', () => ({}))
vi.mock('element-plus/es/components/button/style/css', () => ({}))
vi.mock('element-plus/es/components/tooltip/style/css', () => ({}))

async function renderCell(kind: 'deviceState' | 'deviceAccount' | 'deviceGroup', row: Record<string, unknown>) {
  const app = createSSRApp(DeviceTableCell, { kind, row, column: { key: 'status', label: '状态' } })
  app.provide(ID_INJECTION_KEY, { prefix: 0, current: 0 })
  app.provide(ZINDEX_INJECTION_KEY, { current: 0 })
  return renderToString(app)
}

describe('设备状态与账号状态分列', () => {
  it('有冲突但没有正式绑定的设备仍提供冲突入口', async () => {
    const html = await renderCell('deviceAccount', { id: 'slot-1', binding_conflict_count: 2 })
    expect(html).toContain('绑定冲突 2')
    expect(html).toContain('未绑定账号')
    expect(await renderCell('deviceAccount', { binding_conflict_count: 0 })).not.toContain('绑定冲突')
  })

  it('已生效分组传播中不再显示执行转圈或旧目标名称', async () => {
    const html = await renderCell('deviceGroup', { group_name: '正式分组', pending_group_name: '待同步名称', group_sync_status: 'propagating' })
    expect(html).toContain('正式分组')
    expect(html).toContain('其他 Agent 待同步')
    expect(html).not.toContain('device-group__spinner')
    expect(html).not.toContain('同步至 待同步名称')
  })

  it.each(['queued', 'sent', 'acknowledged'])('%s 保留待确认执行状态', async group_sync_status => {
    const html = await renderCell('deviceGroup', { group_name: '原分组', pending_group_name: '新分组', group_sync_status })
    expect(html).toContain('原分组')
    expect(html).toContain('同步至 新分组')
    expect(html).toContain('device-group__spinner')
    expect(html).not.toContain('其他 Agent 待同步')
  })
  const sessions = [
    { id: '1', account_id: '1', business_platform: 'instagram', login_status: 'logged_in' },
    { id: '2', account_id: '2', business_platform: 'threads', login_status: 'unknown' },
  ]

  it.each([
    {},
    { bound_account_id: '1', bound_account_login_status: 'logged_in' },
    { account_sessions: sessions },
  ])('状态列仅展示设备状态 %j', async (account) => {
    const html = await renderCell('deviceState', { status: 'offline', ...account })
    expect(html).toContain('离线')
    expect(html).not.toContain('>设备</span>')
    expect(html).not.toContain('已登录')
    expect(html).not.toContain('未知')
    expect(html).not.toContain('Instagram')
    expect(html).not.toContain('Threads')
  })

  it('账号列保留各平台登录状态', async () => {
    const html = await renderCell('deviceAccount', { account_sessions: sessions })
    for (const value of ['Instagram', 'Threads', '已登录', '未知']) expect(html).toContain(value)
  })

  it('平台独立一行，优先用户名且不再单独展示 ID 行', async () => {
    const html = await renderCell('deviceAccount', { account_sessions: sessions.map((session, i) => ({
      ...session, account_username: `user-${i}`, account_display_name: `昵称-${i}`,
    })) })
    expect(html.match(/class="device-account-session"/g)).toHaveLength(2)
    expect(html).toContain('user-0')
    expect(html).toContain('user-1')
    expect(html).not.toContain('昵称-0')
    expect(html).not.toContain('<small')
  })

  it('没有绑定时保留空状态', async () => {
    expect(await renderCell('deviceAccount', {})).toContain('未绑定账号')
  })

  it('旧版绑定数据也在账号列展示登录状态', async () => {
    const html = await renderCell('deviceAccount', { bound_account_id: '1', bound_account_login_status: 'logged_in' })
    expect(html).toContain('已登录')
  })
})
