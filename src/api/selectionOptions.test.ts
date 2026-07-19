import { beforeEach, describe, expect, it, vi } from 'vitest'

import { http } from '@/api/http'
import {
  clearSelectionOptionsCache,
  loadAccountSelectionOptions,
  loadSlotSelectionOptions,
} from '@/api/selectionOptions'

vi.mock('@/api/http', () => ({
  http: {
    get: vi.fn(),
  },
}))

describe('selection options cache', () => {
  beforeEach(() => {
    clearSelectionOptionsCache()
    vi.mocked(http.get).mockReset()
  })

  it('deduplicates simultaneous slot requests from interaction selectors', async () => {
    vi.mocked(http.get).mockResolvedValueOnce([{ id: '1' }])
    const filters = {
      business_platform: 'threads',
      runtime_platform: 'fingerprint_browser',
      provider: 'morelogin',
    }

    const [mainOptions, commentOptions] = await Promise.all([
      loadSlotSelectionOptions(filters),
      loadSlotSelectionOptions({ ...filters }),
    ])

    expect(mainOptions).toEqual([{ id: '1' }])
    expect(commentOptions).toBe(mainOptions)
    expect(http.get).toHaveBeenCalledTimes(1)
  })

  it('keeps logged-in and association account candidates in separate caches', async () => {
    vi.mocked(http.get)
      .mockResolvedValueOnce([{ id: 'logged-in' }])
      .mockResolvedValueOnce([{ id: 'all' }])

    await loadAccountSelectionOptions({ business_platform: 'threads' })
    await loadAccountSelectionOptions(
      { business_platform: 'threads' },
      { associationOnly: true },
    )

    expect(http.get).toHaveBeenCalledTimes(2)
  })
})
