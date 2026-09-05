import { http } from '@/api/http'
import type { AnyRecord, PageResult } from '@/types/api'

interface CacheEntry {
  expiresAt: number
  data?: AnyRecord[]
  pending?: Promise<AnyRecord[]>
}

interface ValueCacheEntry<T> {
  expiresAt: number
  data?: T
  pending?: Promise<T>
}

export interface SlotSelectionTreeQuery {
  accountPresence?: 'all' | 'bound' | 'unbound'
  warmupBusinessPlatform?: string
  taskBusinessPlatform?: string
  keyword?: string
  publish?: boolean
  publishUsage?: 'all' | 'today_not_sent' | 'today_sent' | 'content_not_sent' | 'content_sent'
  contentId?: unknown
}

export interface SlotSelectionPagesOptions {
  startPage?: number
  pageSize?: number
  shouldContinue?: () => boolean
  onPage?: (result: PageResult<AnyRecord>) => void | Promise<void>
}

const CACHE_TTL_MS = 15_000
const slotCache = new Map<string, CacheEntry>()
const publishSlotCache = new Map<string, CacheEntry>()
const accountCache = new Map<string, CacheEntry>()
const monitoredAccountCache = new Map<string, CacheEntry>()
const slotGroupCache = new Map<string, ValueCacheEntry<AnyRecord>>()
const slotPageCache = new Map<string, ValueCacheEntry<PageResult<AnyRecord>>>()

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

async function loadValueCached<T>(
  cache: Map<string, ValueCacheEntry<T>>,
  key: string,
  loader: () => Promise<T>,
) {
  const now = Date.now()
  const existing = cache.get(key)
  if (existing?.data !== undefined && existing.expiresAt > now) return existing.data
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

function slotTreeParams(filters: AnyRecord, query: SlotSelectionTreeQuery = {}) {
  return {
    ...normalizedSlotFilters(filters),
    business_platform: query.publish
      ? String(filters.business_platform || '') || undefined
      : undefined,
    ...(query.warmupBusinessPlatform && !query.publish
      ? { warmup_business_platform: query.warmupBusinessPlatform }
      : {}),
    ...(query.taskBusinessPlatform && !query.publish
      ? { task_business_platform: query.taskBusinessPlatform }
      : {}),
    account_presence: query.publish ? undefined : query.accountPresence || 'all',
    publish_usage: query.publish ? query.publishUsage || 'all' : undefined,
    content_id: query.publish ? String(query.contentId || '') || undefined : undefined,
    keyword: String(query.keyword || '').trim() || undefined,
  }
}

function slotTreePath(query: SlotSelectionTreeQuery, suffix: 'groups' | 'page' | 'ids') {
  return query.publish
    ? `/api/interaction-center/published-dispatches/slot-${suffix}`
    : `/api/execution-slots/selection-${suffix}`
}

export function loadSlotSelectionGroups(
  filters: AnyRecord = {},
  query: SlotSelectionTreeQuery = {},
) {
  const params = slotTreeParams(filters, query)
  const path = slotTreePath(query, 'groups')
  const key = JSON.stringify({ path, ...params })
  return loadValueCached(
    slotGroupCache,
    key,
    () => http.get<AnyRecord>(path, params),
  )
}

export function loadSlotSelectionPage(
  filters: AnyRecord,
  query: SlotSelectionTreeQuery,
  groupId: string,
  page: number,
  pageSize = 50,
) {
  const params = {
    ...slotTreeParams(filters, query),
    group_id: groupId === 'ungrouped' ? undefined : groupId,
    ungrouped: groupId === 'ungrouped' || undefined,
    page,
    page_size: pageSize,
  }
  const path = slotTreePath(query, 'page')
  const key = JSON.stringify({ path, ...params })
  return loadValueCached(
    slotPageCache,
    key,
    () => http.get<PageResult<AnyRecord>>(path, params),
  )
}

export async function loadSlotSelectionPages(
  filters: AnyRecord,
  query: SlotSelectionTreeQuery,
  groupId: string,
  options: SlotSelectionPagesOptions = {},
) {
  const pageSize = Math.max(1, Number(options.pageSize || 100))
  let page = Math.max(1, Number(options.startPage || 1))
  let lastLoadedPage = page - 1
  let total = 0
  let loaded = 0

  while (options.shouldContinue?.() !== false) {
    const result = await loadSlotSelectionPage(filters, query, groupId, page, pageSize)
    lastLoadedPage = page
    total = Number(result.total || 0)
    loaded += result.items.length
    await options.onPage?.(result)
    if (!result.items.length || page * pageSize >= total) break
    page += 1
  }

  return { loaded, total, lastPage: lastLoadedPage }
}

export function loadSlotSelectionIds(
  filters: AnyRecord,
  query: SlotSelectionTreeQuery,
  groupId: string,
) {
  const params = {
    ...slotTreeParams(filters, query),
    group_id: groupId === 'ungrouped' ? undefined : groupId,
    ungrouped: groupId === 'ungrouped' || undefined,
  }
  return http.get<{ slot_ids: string[] }>(slotTreePath(query, 'ids'), params)
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
    business_platform: String(filters.business_platform || '') || undefined,
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
  options: { associationOnly?: boolean; publishPool?: boolean } = {},
) {
  const includeAllLoginStatuses = options.associationOnly || options.publishPool
  const loginStatus = includeAllLoginStatuses
    ? undefined
    : 'logged_in,logged_in_dm_unavailable'
  const normalized = normalizedFilters(filters)
  const params = {
    ...normalized,
    // 帐号池依靠数据包轮换帐号，不要求帐号当前绑定在所选执行平台/供应商下。
    runtime_platform: options.publishPool ? undefined : normalized.runtime_platform,
    provider: options.publishPool ? undefined : normalized.provider,
    login_status: loginStatus,
  }
  return loadCached(
    accountCache,
    JSON.stringify(params),
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
    () => http.get<AnyRecord[]>('/api/accounts/selection-options', params),
  )
}

export function clearSelectionOptionsCache() {
  slotCache.clear()
  publishSlotCache.clear()
  accountCache.clear()
  monitoredAccountCache.clear()
  slotGroupCache.clear()
  slotPageCache.clear()
}
