import { describe, expect, it } from 'vitest'

import { proxyProtocolOptions } from './options'
import { resources } from './resources'


describe('互动会话操作', () => {
  const retryAction = resources.interactionSessions.rowActions?.find((action) => action.key === 'retry')
  const cancelAction = resources.interactionSessions.rowActions?.find((action) => action.key === 'cancel')

  it('仅在会话结束且存在失败结果时提供重试入口', () => {
    expect(retryAction).toBeDefined()
    expect(retryAction?.visible?.({ status: 'completed', step_failed: 1 })).toBe(true)
    expect(retryAction?.visible?.({ status: 'all_failed' })).toBe(true)
    expect(retryAction?.visible?.({ status: 'failed' })).toBe(true)
    expect(retryAction?.visible?.({ status: 'running' })).toBe(false)
    expect(retryAction?.visible?.({ status: 'completed', step_failed: 0 })).toBe(false)
  })

  it('仅允许取消排队中或运行中的会话', () => {
    expect(cancelAction).toBeDefined()
    expect(cancelAction?.visible?.({ status: 'queued' })).toBe(true)
    expect(cancelAction?.visible?.({ status: 'running' })).toBe(true)
    expect(cancelAction?.visible?.({ status: 'completed' })).toBe(false)
    expect(cancelAction?.visible?.({ status: 'canceled' })).toBe(false)
  })
})

describe('代理协议选项', () => {
  it('分别提供 Socks5、HTTP 和 HTTPS', () => {
    expect(proxyProtocolOptions.map((option) => option.value)).toEqual(['socks5', 'http', 'https'])
  })
})
