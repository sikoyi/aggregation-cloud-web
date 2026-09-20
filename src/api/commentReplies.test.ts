import { describe, expect, it, vi } from 'vitest'

import { batchRetryCommentReplies } from '@/api/commentReplies'
import { http } from '@/api/http'

vi.mock('@/api/http', () => ({ http: { post: vi.fn() } }))

describe('回复审核批量重试 API', () => {
  it('发送所选工单并保留部分失败结果', async () => {
    const result = {
      requested_count: 3, processed_count: 1, skipped_count: 1, failed_count: 1,
      processed_job_ids: ['1'], skipped_job_ids: ['2'],
      failures: [{ job_id: '3', message: '处理失败' }],
    }
    vi.mocked(http.post).mockResolvedValue(result)
    expect(await batchRetryCommentReplies(['1', '2', '3'])).toEqual(result)
    expect(http.post).toHaveBeenCalledExactlyOnceWith(
      '/api/interaction-center/comment-replies/batch/retry', { job_ids: ['1', '2', '3'] },
    )
  })
})
