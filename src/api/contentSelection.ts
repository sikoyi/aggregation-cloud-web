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
}
export interface SelectionSource {
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
const base = '/api/content-selection'
export const contentSelection = {
  sources: () => http.get<SelectionSource[]>(`${base}/sources`),
  createSource: (data: AnyRecord) => http.post<SelectionSource>(`${base}/sources`, data),
  updateSource: (id: string, data: AnyRecord) => http.put<SelectionSource>(`${base}/sources/${encodeURIComponent(id)}`, data),
  posts: (params: AnyRecord) => http.get<SelectionPage<SelectionPost>>(`${base}/posts`, params),
  post: (id: string) => http.get<SelectionPost>(`${base}/posts/${encodeURIComponent(id)}`),
  orders: (params: AnyRecord) => http.get<SelectionPage<SelectionOrder>>(`${base}/orders`, params),
  order: (id: string) => http.get<SelectionOrder>(`${base}/orders/${encodeURIComponent(id)}`),
  publish: (id: string, data: { account_id: string; text_body: string; media_indexes: number[]; source_revision: string }) =>
    http.post<SelectionOrder>(`${base}/posts/${encodeURIComponent(id)}/dispatch`, data),
  retry: (id: string) => http.post<SelectionOrder>(`${base}/orders/${encodeURIComponent(id)}/retry`, {}),
}
