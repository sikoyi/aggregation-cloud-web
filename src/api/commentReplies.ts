import { http } from '@/api/http'
import type { AnyRecord } from '@/types/api'

export interface CommentReplyPage {
  items: AnyRecord[]
  total: number
  page: number
  page_size: number
}

export interface CommentReplyFilters {
  status?: string
  account_id?: string
  keyword?: string
  page: number
  page_size: number
}

export function listCommentReplies(filters: CommentReplyFilters) {
  return http.get<CommentReplyPage>('/api/interaction-center/comment-replies', { ...filters })
}

export function getCommentReply(id: string) {
  return http.get<AnyRecord>(`/api/interaction-center/comment-replies/${encodeURIComponent(id)}`)
}

export function approveCommentReply(id: string, finalContent?: string) {
  return http.post<AnyRecord>(`/api/interaction-center/comment-replies/${encodeURIComponent(id)}/approve`, {
    final_content: finalContent?.trim() || null,
  })
}

export function regenerateCommentReply(id: string) {
  return http.post<AnyRecord>(`/api/interaction-center/comment-replies/${encodeURIComponent(id)}/regenerate`, {})
}

export function ignoreCommentReply(id: string) {
  return http.post<AnyRecord>(`/api/interaction-center/comment-replies/${encodeURIComponent(id)}/ignore`, {})
}

export function retryCommentReply(id: string) {
  return http.post<AnyRecord>(`/api/interaction-center/comment-replies/${encodeURIComponent(id)}/retry`, {})
}
