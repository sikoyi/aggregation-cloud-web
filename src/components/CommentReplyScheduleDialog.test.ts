import { describe, expect, it } from 'vitest'
import source from './CommentReplyScheduleDialog.vue?raw'

describe('集中回复时间设置', () => {
  it('提供多时间点、账号继承以及批量目标', () => {
    expect(source).toContain('account_ids: accountIds.value')
    expect(source).toContain('继承 App 默认时间')
    expect(source).toContain('每日触发时间（北京时间）')
    expect(source).toContain("times.push('09:00')")
    expect(source).toContain('times.splice(index, 1)')
    expect(source).toContain('请选择同一 App 下的账号')
  })
  it('使用现有 HTTP 客户端查询参数约定', () => {
    expect(source).not.toContain('{ params: {')
    expect(source).toContain('account_id: accountIds.value.length === 1')
    expect(source).toContain('if (current !== revision) return')
  })
})
