import { describe, expect, it } from 'vitest'
import { benchmarkCollectionStatus } from './benchmarkCollection'

describe('对标采集状态', () => {
  it.each([
    ['queued', 'profile', '排队中'], ['starting', 'profile', '正在采集资料'],
    ['running', 'profile', '正在采集资料'], ['running', 'posts', '正在采集帖子'],
    ['succeeded', 'posts', '采集已完成'], ['failed', 'posts', '采集失败'],
    ['canceled', 'posts', '采集已取消'],
  ])('%s/%s 使用实际状态，不以昵称判断', (status, phase, label) => {
    expect(benchmarkCollectionStatus({ enabled: true, collection_run: { status, phase } }).label).toBe(label)
  })
  it('暂停优先于活动批次，重试区别于首次排队', () => {
    expect(benchmarkCollectionStatus({ enabled: false, collection_run: { status: 'running' } }).label).toBe('已关闭')
    expect(benchmarkCollectionStatus({ enabled: true, collection_run: { status: 'queued', attempt_no: 2 } }).label).toBe('等待重试')
  })
  it('兼容旧接口，但无昵称不等于等待采集', () => {
    expect(benchmarkCollectionStatus({ enabled: true, last_success_at: '2026-09-16' }).label).toBe('采集已完成')
    expect(benchmarkCollectionStatus({ enabled: true }).label).toBe('暂无采集记录')
  })
})
