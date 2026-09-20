import { describe, expect, it } from 'vitest'
import { buildPostReviewQuery, createDefaultPostReviewFilters } from './postReviewFilters'

describe('帖子审核联合筛选', () => {
  it('默认查询全部，不加入回复模式', () => {
    const query = buildPostReviewQuery(createDefaultPostReviewFilters(), 1)
    expect(query.status).toBeUndefined()
    expect(query).not.toHaveProperty('reply_mode')
    expect(query.page_size).toBe(20)
  })
  it('联合传入账号、标签、时间与去空白关键词', () => {
    expect(buildPostReviewQuery({ businessPlatform: 'x', accountId: '1', accountTagId: '2', status: 'failed',
      createdRange: ['2026-09-20T08:00:00+08:00', '2026-09-21T08:00:00+08:00'], keyword: ' hello ' }, 3))
      .toEqual({ business_platform: 'x', account_id: '1', account_tag_id: '2', status: 'failed',
        created_from: '2026-09-20T08:00:00+08:00', created_to: '2026-09-21T08:00:00+08:00', keyword: 'hello', page: 3, page_size: 20 })
  })
  it('清空后不保留时间或关键词', () => {
    const query = buildPostReviewQuery({ ...createDefaultPostReviewFilters(), keyword: '  ' }, 1)
    expect(query.created_from).toBeUndefined()
    expect(query.created_to).toBeUndefined()
    expect(query.keyword).toBeUndefined()
  })
})
