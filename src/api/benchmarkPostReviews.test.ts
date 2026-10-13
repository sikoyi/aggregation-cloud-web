import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  batchApproveBenchmarkPostReviews,
  batchDeleteBenchmarkPostReviews,
  batchIgnoreBenchmarkPostReviews,
  getPendingPostReviewCount,
} from '@/api/benchmarkPostReviews'
import { http } from '@/api/http'

vi.mock('@/api/http', () => ({
  http: {
    post: vi.fn(),
    getWithSignal: vi.fn(),
  },
}))

describe('帖子审核批量 API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('菜单只查询待审核总数，不带页面筛选或拉取全部帖子', async () => {
    const controller = new AbortController()
    vi.mocked(http.getWithSignal).mockResolvedValue({ total: 105, items: [{}] })
    expect(await getPendingPostReviewCount(controller.signal)).toBe(105)
    expect(http.getWithSignal).toHaveBeenCalledExactlyOnceWith(
      '/api/benchmark-trackers/reviews?status=pending_review&page=1&page_size=1', controller.signal,
    )
  })

  it.each([
    ['approve', batchApproveBenchmarkPostReviews],
    ['ignore', batchIgnoreBenchmarkPostReviews],
    ['delete', batchDeleteBenchmarkPostReviews],
  ])('uses the %s endpoint and sends selected job ids', async (action, request) => {
    vi.mocked(http.post).mockResolvedValue({
      requested_count: 2,
      processed_count: 2,
      skipped_count: 0,
      failed_count: 0,
      processed_job_ids: ['1', '2'],
      skipped_job_ids: [],
      failures: [],
    })

    await request(['1', '2'])

    expect(http.post).toHaveBeenCalledExactlyOnceWith(
      `/api/benchmark-trackers/reviews/batch/${action}`,
      { job_ids: ['1', '2'] },
    )
  })
})
