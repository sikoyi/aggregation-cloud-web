import { describe, expect, it } from 'vitest'
import { lastPostElapsed } from './lastPostElapsed'

describe('last post elapsed', () => {
  const now = Date.parse('2026-09-20T12:00:00Z')
  it('handles missing and invalid timestamps', () => {
    for (const value of [null, undefined, '', 'invalid']) expect(lastPostElapsed(value, now)).toBe('暂无发帖数据')
  })
  it('formats minute, hour and day boundaries', () => {
    for (const [minutes, expected] of [[0, '刚刚'], [0.5, '刚刚'], [1, '1 分钟'], [35, '35 分钟'], [59, '59 分钟'], [60, '1 小时'], [180, '3 小时'], [1439, '23 小时'], [1440, '1 天'], [2880, '2 天']] as const) {
      expect(lastPostElapsed(new Date(now - minutes * 60_000).toISOString(), now)).toBe(expected)
    }
  })
  it('compares timezone-aware timestamps and tolerates client clock skew', () => {
    expect(lastPostElapsed('2026-09-20T19:00:00+08:00', now)).toBe('1 小时')
    expect(lastPostElapsed('2026-09-20T12:00:05Z', now)).toBe('刚刚')
  })
})
