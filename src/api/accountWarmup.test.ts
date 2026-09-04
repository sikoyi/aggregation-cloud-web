import { beforeEach, describe, expect, it, vi } from 'vitest'

import { deleteWarmupPlan, isWarmupPlanDeletable } from '@/api/accountWarmup'
import { http } from '@/api/http'

vi.mock('@/api/http', () => ({
  http: {
    delete: vi.fn(),
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
})
