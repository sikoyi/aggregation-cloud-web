import { describe, expect, it } from 'vitest'

import { normalizeThreadsPostUrl } from '@/utils/platformUrls'


describe('Threads 帖子链接校验', () => {
  it('接受 threads.com 和 threads.net 的明确帖子链接', () => {
    expect(normalizeThreadsPostUrl('https://www.threads.com/@demo.user/post/ABC_123?xmt=1'))
      .toBe('https://www.threads.com/@demo.user/post/ABC_123')
    expect(normalizeThreadsPostUrl('https://threads.net/@demo/post/xyz-789/'))
      .toBe('https://threads.net/@demo/post/xyz-789')
  })

  it('拒绝主页、短链接和其他平台链接', () => {
    expect(() => normalizeThreadsPostUrl('https://www.threads.com/@demo.user')).toThrow()
    expect(() => normalizeThreadsPostUrl('https://www.threads.com/t/ABC_123')).toThrow()
    expect(() => normalizeThreadsPostUrl('https://example.com/@demo/post/ABC_123')).toThrow()
  })
})
