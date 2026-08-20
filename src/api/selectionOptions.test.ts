import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getAllPages, http } from '@/api/http'
import {
  clearSelectionOptionsCache,
  loadAccountSelectionOptions,
  loadMonitoredAccountSelectionOptions,
  loadPublishSlotSelectionOptions,
  loadSlotSelectionOptions,
} from '@/api/selectionOptions'

vi.mock('@/api/http', () => ({
  getAllPages: vi.fn(),
  http: {
    get: vi.fn(),
  },
}))

describe('selection options cache', () => {
  beforeEach(() => {
    clearSelectionOptionsCache()
    vi.mocked(http.get).mockReset()
    vi.mocked(getAllPages).mockReset()
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
    expect(http.get).toHaveBeenCalledWith('/api/execution-slots/selection-options', {
      runtime_platform: 'fingerprint_browser',
      provider: 'morelogin',
    })
  })

  it('loads monitoring accounts and normalizes device group fields', async () => {
    vi.mocked(getAllPages).mockResolvedValueOnce([{
      account_id: '12',
      account_name: 'target-account',
      slot_group_id: '3',
      slot_group_name: '韩国账号',
    }])

    const accounts = await loadMonitoredAccountSelectionOptions({
      business_platform: 'threads',
    })

    expect(getAllPages).toHaveBeenCalledWith('/api/accounts/data-overview', {
      business_platform: 'threads',
      monitor_state: 'monitoring',
    })
    expect(accounts).toEqual([expect.objectContaining({
      id: '12',
      bound_slot_group_id: '3',
      bound_slot_group_name: '韩国账号',
    })])
  })

  it('loads publish hints with the selected content in an independent cache', async () => {
    vi.mocked(http.get).mockResolvedValueOnce([{
      id: 'slot-1',
      today_publish_count: 2,
      selected_content_succeeded_count: 1,
    }])

    const options = await loadPublishSlotSelectionOptions({
      runtime_platform: 'fingerprint_browser',
      provider: 'morelogin',
    }, 'content-8')

    expect(options).toEqual([expect.objectContaining({ id: 'slot-1' })])
    expect(http.get).toHaveBeenCalledWith(
      '/api/interaction-center/published-dispatches/slot-options',
      {
        runtime_platform: 'fingerprint_browser',
        provider: 'morelogin',
        content_id: 'content-8',
      },
    )
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
