import { describe, expect, it } from 'vitest'

import {
  buildCommentReplyQuery,
  createDefaultCommentReplyFilters,
  hasActiveCommentReplyFilters,
} from '@/config/commentReplyFilters'

describe('回复审核筛选', () => {
  it('默认只查询待审核工单', () => {
    const filters = createDefaultCommentReplyFilters()

    expect(filters.status).toBe('pending_review')
    expect(buildCommentReplyQuery(filters, 1, 20)).toEqual({
      status: 'pending_review',
      page: 1,
      page_size: 20,
    })
    expect(hasActiveCommentReplyFilters(filters)).toBe(false)
  })

  it('提交平台、具体账号、标签、处理方式、状态、时间与关键词', () => {
    const filters = {
      businessPlatform: 'threads',
      accountId: 'account-8',
      accountTagId: 'tag-3',
      replyMode: 'review',
      status: 'failed',
      createdRange: ['2026-09-01T00:00:00+08:00', '2026-09-08T23:59:59+08:00'],
      keyword: '  customer  ',
    }

    expect(buildCommentReplyQuery(filters, 3, 50)).toEqual({
      business_platform: 'threads',
      account_id: 'account-8',
      account_tag_id: 'tag-3',
      reply_mode: 'review',
      status: 'failed',
      created_from: '2026-09-01T00:00:00+08:00',
      created_to: '2026-09-08T23:59:59+08:00',
      keyword: 'customer',
      page: 3,
      page_size: 50,
    })
    expect(hasActiveCommentReplyFilters(filters)).toBe(true)
  })
})
