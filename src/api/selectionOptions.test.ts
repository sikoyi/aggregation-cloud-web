import { beforeEach, describe, expect, it, vi } from 'vitest'

import { http } from '@/api/http'
import {
  clearSelectionOptionsCache,
  loadAccountSelectionOptions,
  loadMonitoredAccountSelectionOptions,
  loadPublishSlotSelectionOptions,
  loadSlotSelectionGroups,
  loadSlotSelectionIds,
  loadSlotSelectionPage,
  loadSlotSelectionPages,
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
    expect(http.get).toHaveBeenCalledWith('/api/execution-slots/selection-options', {
      runtime_platform: 'fingerprint_browser',
      provider: 'morelogin',
    })
  })

  it('loads monitoring accounts from the compact selection endpoint', async () => {
    vi.mocked(http.get).mockResolvedValueOnce([{
      id: '12',
      public_username: 'target-account',
      bound_slot_group_id: '3',
      bound_slot_group_name: '韩国账号',
    }])

    const accounts = await loadMonitoredAccountSelectionOptions({
      business_platform: 'threads',
    })

    expect(http.get).toHaveBeenCalledWith('/api/accounts/selection-options', {
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

  it('loads device groups first and only requests a group page when expanded', async () => {
    vi.mocked(http.get)
      .mockResolvedValueOnce({
        groups: [{ id: 'group-1', name: '韩国设备', device_count: 120 }],
        total: 120,
      })
      .mockResolvedValueOnce({
        items: [{ id: 'slot-1' }],
        total: 120,
        page: 1,
        page_size: 50,
      })

    const filters = { runtime_platform: 'fingerprint_browser', provider: 'morelogin' }
    const query = { accountPresence: 'bound' as const, keyword: '设备-1,设备-2' }
    const groups = await loadSlotSelectionGroups(filters, query)
    const page = await loadSlotSelectionPage(filters, query, 'group-1', 1)

    expect(groups.total).toBe(120)
    expect(page.items).toEqual([{ id: 'slot-1' }])
    expect(http.get).toHaveBeenNthCalledWith(1, '/api/execution-slots/selection-groups', {
      runtime_platform: 'fingerprint_browser',
      provider: 'morelogin',
      account_presence: 'bound',
      publish_usage: undefined,
      content_id: undefined,
      keyword: '设备-1,设备-2',
    })
    expect(http.get).toHaveBeenNthCalledWith(2, '/api/execution-slots/selection-page', {
      runtime_platform: 'fingerprint_browser',
      provider: 'morelogin',
      account_presence: 'bound',
      publish_usage: undefined,
      content_id: undefined,
      keyword: '设备-1,设备-2',
      group_id: 'group-1',
      ungrouped: undefined,
      page: 1,
      page_size: 50,
    })
  })

  it('loads every page for one expanded device group', async () => {
    vi.mocked(http.get)
      .mockResolvedValueOnce({ items: Array.from({ length: 100 }, (_, index) => ({ id: `slot-${index + 1}` })), total: 205, page: 1, page_size: 100 })
      .mockResolvedValueOnce({ items: Array.from({ length: 100 }, (_, index) => ({ id: `slot-${index + 101}` })), total: 205, page: 2, page_size: 100 })
      .mockResolvedValueOnce({ items: Array.from({ length: 5 }, (_, index) => ({ id: `slot-${index + 201}` })), total: 205, page: 3, page_size: 100 })

    const receivedPages: number[] = []
    const result = await loadSlotSelectionPages(
      { runtime_platform: 'fingerprint_browser', provider: 'morelogin' },
      { accountPresence: 'bound' },
      'group-1',
      {
        pageSize: 100,
        onPage: (page) => { receivedPages.push(page.page) },
      },
    )

    expect(receivedPages).toEqual([1, 2, 3])
    expect(result).toEqual({ loaded: 205, total: 205, lastPage: 3 })
    expect(http.get).toHaveBeenCalledTimes(3)
  })

  it('stops loading an expanded group after it is collapsed', async () => {
    vi.mocked(http.get).mockResolvedValueOnce({
      items: Array.from({ length: 100 }, (_, index) => ({ id: `slot-${index + 1}` })),
      total: 300,
      page: 1,
      page_size: 100,
    })
    let expanded = true

    const result = await loadSlotSelectionPages(
      {},
      {},
      'group-1',
      {
        pageSize: 100,
        shouldContinue: () => expanded,
        onPage: () => { expanded = false },
      },
    )

    expect(result).toEqual({ loaded: 100, total: 300, lastPage: 1 })
    expect(http.get).toHaveBeenCalledTimes(1)
  })

  it('loads only ids when selecting a complete publish device group', async () => {
    vi.mocked(http.get).mockResolvedValueOnce({ slot_ids: ['slot-1', 'slot-2'] })

    const result = await loadSlotSelectionIds(
      { runtime_platform: 'fingerprint_browser', provider: 'morelogin' },
      {
        publish: true,
        publishUsage: 'content_not_sent',
        contentId: 'content-8',
        keyword: '设备-1，设备-2',
      },
      'ungrouped',
    )

    expect(result.slot_ids).toEqual(['slot-1', 'slot-2'])
    expect(http.get).toHaveBeenCalledWith(
      '/api/interaction-center/published-dispatches/slot-ids',
      {
        runtime_platform: 'fingerprint_browser',
        provider: 'morelogin',
        account_presence: undefined,
        publish_usage: 'content_not_sent',
        content_id: 'content-8',
        keyword: '设备-1，设备-2',
        group_id: undefined,
        ungrouped: true,
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
