import { http } from '@/api/http'
import type { AnyRecord } from '@/types/api'

export interface SelectionAuthor {
  username?: string
  display_name?: string
  avatar_url?: string
  profile_url?: string
}
export interface SelectionPost {
  id: string
  source_id: string
  business_platform: string
  content_url: string
  text_body: string
  media: string[]
  media_type: string
  author: SelectionAuthor
  published_at: string | null
  updated_at: string
  likes_count: number | null
  comments_count: number | null
  views_count: number | null
}
export interface SelectionSource {
  external_monitor_id?: string | null
  country?: string
  tags?: { id: string; name: string }[]
  profile?: SelectionAuthor
  id: string
  business_platform: string
  profile_url: string
  remark: string
  enabled: boolean
  interval_minutes: number
  version: number
  status: string
  history_complete: boolean
  pages_collected: number
  post_count: number
  last_error?: string
}
export interface SelectionOrder {
  id: string
  post_id: string
  account_id: string
  business_platform: string
  account: SelectionAuthor
  original: { text_body: string; media: string[]; content_url: string }
  draft: { text_body: string; media: string[] }
  status: string
  task_id: string
  error_message?: string
  created_at: string
  attempts?: { task_id: string; status: string; error_message?: string; created_at: string }[]
}
export interface SelectionPage<T> { items: T[]; total: number }
export interface SelectionFeedCursor { id: string; sort_by: string; value: string | null; as_of: string }
export interface SelectionFeedPage {
  items: SelectionPost[]
  total: number | null
  has_more: boolean
  next_cursor: SelectionFeedCursor | null
  index_pending: boolean
}
export interface SelectionAiRequest {
  account_id: string
  source_revision: string
  text_body: string
  action: 'translate' | 'shorten'
  language?: string
}
export interface SelectionAiResult { text_body: string; changed: boolean; message?: string | null }
const base = '/api/content-selection'
export const contentSelection = {
  localScope: () => http.get<{ tenant_id: string; user_id: string }>(`${base}/local-state-scope`),
  queryPosts: (data: AnyRecord, signal?: AbortSignal) => signal
    ? http.postWithSignal<SelectionFeedPage>(`${base}/posts/query`, data, signal)
    : http.post<SelectionFeedPage>(`${base}/posts/query`, data),
  filterOptions: () => http.get<{ countries: string[]; tags: { id: string; name: string }[] }>(`${base}/filter-options`),
  previewText: (id: string, data: SelectionAiRequest) =>
    http.post<SelectionAiResult>(`${base}/posts/${encodeURIComponent(id)}/ai-preview`, data),
  sources: (lightweight = false) => http.get<SelectionSource[]>(`${base}/sources`, { lightweight }),
  createSource: (data: AnyRecord) => http.post<SelectionSource>(`${base}/sources`, data),
  updateSource: (id: string, data: AnyRecord) => http.put<SelectionSource>(`${base}/sources/${encodeURIComponent(id)}`, data),
  posts: (params: AnyRecord) => http.get<SelectionPage<SelectionPost>>(`${base}/posts`, params),
  post: (id: string) => http.get<SelectionPost>(`${base}/posts/${encodeURIComponent(id)}`),
  orders: (params: AnyRecord) => http.get<SelectionPage<SelectionOrder>>(`${base}/orders`, params),
  order: (id: string) => http.get<SelectionOrder>(`${base}/orders/${encodeURIComponent(id)}`),
  publish: (id: string, data: { account_id: string; text_body: string; media_indexes: number[]; source_revision: string; creation_job_id?: string }) =>
    http.post<SelectionOrder>(`${base}/posts/${encodeURIComponent(id)}/dispatch`, data),
  retry: (id: string) => http.post<SelectionOrder>(`${base}/orders/${encodeURIComponent(id)}/retry`, {}),
}
