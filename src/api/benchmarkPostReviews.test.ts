import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  batchApproveBenchmarkPostReviews,
  batchDeleteBenchmarkPostReviews,
  batchIgnoreBenchmarkPostReviews,
} from '@/api/benchmarkPostReviews'
import { http } from '@/api/http'

vi.mock('@/api/http', () => ({
  http: {
    post: vi.fn(),
  },
}))

describe('帖子审核批量 API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
