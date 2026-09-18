import { beforeEach, describe, expect, it, vi } from 'vitest'

import { batchOperateWarmupPlans, deleteWarmupPlan, isWarmupPlanDeletable } from '@/api/accountWarmup'
import { http } from '@/api/http'

vi.mock('@/api/http', () => ({
  http: {
    delete: vi.fn(),
    post: vi.fn(),
  },
}))

describe('accountWarmup API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes a warmup plan through the plan endpoint', async () => {
    vi.mocked(http.delete).mockResolvedValue(undefined)

    await deleteWarmupPlan('plan-1')

    expect(http.delete).toHaveBeenCalledWith('/api/account-warmup/plans/plan-1')
  })

  it.each([
    ['completed', true],
    ['canceled', true],
    ['draft', false],
    ['active', false],
    ['paused', false],
  ])('recognizes whether status %s can be deleted', (status, expected) => {
    expect(isWarmupPlanDeletable(status)).toBe(expected)
  })

  it.each(['activate', 'pause', 'cancel'] as const)(
    'posts batch %s requests to the static batch endpoint',
    async (action) => {
      vi.mocked(http.post).mockResolvedValue({
        requested_count: 2,
        processed_count: 2,
        skipped_count: 0,
        failed_count: 0,
        processed_plan_ids: ['plan-1', 'plan-2'],
        skipped_plan_ids: [],
        failures: [],
      })

      await batchOperateWarmupPlans(action, ['plan-1', 'plan-2'])

      expect(http.post).toHaveBeenCalledWith(
        `/api/account-warmup/plans/batch/${action}`,
        { plan_ids: ['plan-1', 'plan-2'] },
      )
    },
  )
})
