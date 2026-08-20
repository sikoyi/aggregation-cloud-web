import { getAllPages, http } from '@/api/http'
import type { AnyRecord } from '@/types/api'

interface CacheEntry {
  expiresAt: number
  data?: AnyRecord[]
  pending?: Promise<AnyRecord[]>
}

const CACHE_TTL_MS = 15_000
const slotCache = new Map<string, CacheEntry>()
const publishSlotCache = new Map<string, CacheEntry>()
const accountCache = new Map<string, CacheEntry>()
const monitoredAccountCache = new Map<string, CacheEntry>()

function normalizedFilters(filters: AnyRecord = {}) {
  return {
    business_platform: String(filters.business_platform || '') || undefined,
    runtime_platform: String(filters.runtime_platform || '') || undefined,
    provider: String(filters.provider || '') || undefined,
  }
}

function normalizedSlotFilters(filters: AnyRecord = {}) {
  return {
    runtime_platform: String(filters.runtime_platform || '') || undefined,
    provider: String(filters.provider || '') || undefined,
  }
}

function cacheKey(filters: AnyRecord, extra: AnyRecord = {}) {
  return JSON.stringify({ ...normalizedFilters(filters), ...extra })
}

async function loadCached(
  cache: Map<string, CacheEntry>,
  key: string,
  loader: () => Promise<AnyRecord[]>,
) {
  const now = Date.now()
  const existing = cache.get(key)
  if (existing?.data && existing.expiresAt > now) return existing.data
  if (existing?.pending) return existing.pending

  const pending = loader()
    .then((data) => {
      cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS })
      return data
    })
    .catch((error) => {
      cache.delete(key)
      throw error
    })
  cache.set(key, { expiresAt: 0, pending })
  return pending
}

export function loadSlotSelectionOptions(filters: AnyRecord = {}) {
  const params = normalizedSlotFilters(filters)
  return loadCached(
    slotCache,
    JSON.stringify(params),
    () => http.get<AnyRecord[]>('/api/execution-slots/selection-options', params),
  )
}

export function loadPublishSlotSelectionOptions(
  filters: AnyRecord = {},
  contentId?: unknown,
) {
  const params = {
    ...normalizedSlotFilters(filters),
    content_id: String(contentId || '') || undefined,
  }
  return loadCached(
    publishSlotCache,
    JSON.stringify(params),
    () => http.get<AnyRecord[]>('/api/interaction-center/published-dispatches/slot-options', params),
  )
}

export function loadAccountSelectionOptions(
  filters: AnyRecord = {},
  options: { associationOnly?: boolean } = {},
) {
  const loginStatus = options.associationOnly
    ? undefined
    : 'logged_in,logged_in_dm_unavailable'
  const params = {
    ...normalizedFilters(filters),
    login_status: loginStatus,
  }
  return loadCached(
    accountCache,
    cacheKey(filters, { login_status: loginStatus || '' }),
    () => http.get<AnyRecord[]>('/api/accounts/selection-options', params),
  )
}

export function loadMonitoredAccountSelectionOptions(filters: AnyRecord = {}) {
  const params = {
    business_platform: normalizedFilters(filters).business_platform,
    monitor_state: 'monitoring',
  }
  return loadCached(
    monitoredAccountCache,
    cacheKey(params),
    async () => {
      const accounts = await getAllPages<AnyRecord>('/api/accounts/data-overview', params)
      return accounts.map((account) => ({
        ...account,
        id: String(account.account_id),
        bound_slot_group_id: account.slot_group_id,
        bound_slot_group_name: account.slot_group_name,
      }))
    },
  )
}

export function clearSelectionOptionsCache() {
  slotCache.clear()
  publishSlotCache.clear()
  accountCache.clear()
  monitoredAccountCache.clear()
}
