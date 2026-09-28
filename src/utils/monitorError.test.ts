import { describe, expect, it } from 'vitest'
import { monitorErrorDetails, safeMonitorError } from './monitorError'
import { benchmarkCollectionStatus } from './benchmarkCollection'

describe('监听异常详情', () => {
  it('保留完整多行原因，不把成功时间当作失败时间', () => {
    const result = monitorErrorDetails({ last_error_message: '采集失败\n身份冲突', last_success_at: '2026-09-28' })
    expect(result.reason).toBe('采集失败\n身份冲突')
    expect(result.time).toBeFalsy()
    expect(result.runId).toBeNull()
  })
  it('提取失败批次的阶段、时间和记录 ID', () => {
    expect(monitorErrorDetails({ collection_run: { id: '12', status: 'failed', phase: 'posts', finished_at: '2026-09-28', error_message: '超时' } })).toMatchObject({
      reason: '超时', phase: 'posts', time: '2026-09-28', runId: '12',
    })
  })
  it('脱敏代理认证、Token、密码和 2FA', () => {
    const result = safeMonitorError('http://user:pass@example.com password="secret" token=abcdef 2fa=123456 Authorization: Bearer abc.def')
    for (const value of ['user:pass', 'secret', 'abcdef', '123456', 'abc.def']) expect(result).not.toContain(value)
    expect(result).toContain('example.com')
  })
  it('异常自动停用仍显示失败，主动暂停仍显示关闭', () => {
    expect(benchmarkCollectionStatus({ enabled: false, status: 'abnormal' }).type).toBe('danger')
    expect(benchmarkCollectionStatus({ enabled: false, status: 'paused' }).label).toBe('已关闭')
  })
})
