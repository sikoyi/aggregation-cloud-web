import { http } from '@/api/http'
import type { AnyRecord } from '@/types/api'

interface CacheEntry {
  expiresAt: number
  data?: AnyRecord[]
  pending?: Promise<AnyRecord[]>
}

const CACHE_TTL_MS = 15_000
const slotCache = new Map<string, CacheEntry>()
const accountCache = new Map<string, CacheEntry>()

function normalizedFilters(filters: AnyRecord = {}) {
  return {
    business_platform: String(filters.business_platform || '') || undefined,
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
  const params = normalizedFilters(filters)
  return loadCached(
    slotCache,
    cacheKey(filters),
    () => http.get<AnyRecord[]>('/api/execution-slots/selection-options', params),
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

export function clearSelectionOptionsCache() {
  slotCache.clear()
  accountCache.clear()
}
