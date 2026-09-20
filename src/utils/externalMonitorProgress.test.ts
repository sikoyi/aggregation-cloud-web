import { describe, expect, it } from 'vitest'
import { externalMonitorProgress, externalMonitorStatus } from './externalMonitorProgress'

describe('外部监听采集进度', () => {
  it('区分阶段等待和实际正在请求，并兼容旧服务端', () => {
    expect(externalMonitorStatus({ status: 'collecting', activity_status: 'waiting' })).toBe('等待调度')
    expect(externalMonitorStatus({ status: 'pending', activity_status: 'collecting' })).toBe('采集中')
    expect(externalMonitorStatus({ status: 'retrying' })).toBe('等待重试')
    expect(externalMonitorStatus({ status: 'paused' })).toBe('已暂停')
  })
  it('展示已保存的帖子和评论进度，不将未知值误写为已采集零条', () => {
    expect(externalMonitorProgress({ phase: 'posts', posts_collected: 24 })).toBe('帖子已采集 24 条')
    expect(externalMonitorProgress({ phase: 'posts' })).toBe('帖子采集')
    expect(externalMonitorProgress({ phase: 'comments', comments_completed: 3, comments_total: 21 })).toBe('评论采集 3 / 21 帖')
    expect(externalMonitorProgress()).toBe('')
  })
})
