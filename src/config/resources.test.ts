import { describe, expect, it } from 'vitest'

import { proxyProtocolOptions } from './options'
import { resources } from './resources'


describe('互动会话操作', () => {
  const retryAction = resources.interactionSessions.rowActions?.find((action) => action.key === 'retry')

  it('仅在会话结束且存在失败结果时提供重试入口', () => {
    expect(retryAction).toBeDefined()
    expect(retryAction?.visible?.({ status: 'partial_completed' })).toBe(true)
    expect(retryAction?.visible?.({ status: 'all_failed' })).toBe(true)
    expect(retryAction?.visible?.({ status: 'failed' })).toBe(true)
    expect(retryAction?.visible?.({ status: 'running' })).toBe(false)
    expect(retryAction?.visible?.({ status: 'completed' })).toBe(false)
  })
})

describe('代理协议选项', () => {
  it('分别提供 Socks5、HTTP 和 HTTPS', () => {
    expect(proxyProtocolOptions.map((option) => option.value)).toEqual(['socks5', 'http', 'https'])
  })
})
