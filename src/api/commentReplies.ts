import { http } from '@/api/http'
import type { AnyRecord } from '@/types/api'

export interface CommentReplyPage {
  items: AnyRecord[]
  total: number
  page: number
  page_size: number
}

export interface CommentReplyFilters {
  business_platform?: string
  status?: string
  account_id?: string
  account_tag_id?: string
  reply_mode?: string
  created_from?: string
  created_to?: string
  keyword?: string
  page: number
  page_size: number
}

export interface CommentReplyBatchFailure {
  job_id: string
  message: string
}

export interface CommentReplyBatchResult {
  requested_count: number
  processed_count: number
  skipped_count: number
  failed_count: number
  processed_job_ids: string[]
  skipped_job_ids: string[]
  failures: CommentReplyBatchFailure[]
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

export function batchApproveCommentReplies(jobIds: string[]) {
  return http.post<CommentReplyBatchResult>('/api/interaction-center/comment-replies/batch/approve', {
    job_ids: jobIds,
  })
}

export function batchIgnoreCommentReplies(jobIds: string[]) {
  return http.post<CommentReplyBatchResult>('/api/interaction-center/comment-replies/batch/ignore', {
    job_ids: jobIds,
  })
}

export function batchRetryCommentReplies(jobIds: string[]) {
  return http.post<CommentReplyBatchResult>('/api/interaction-center/comment-replies/batch/retry', {
    job_ids: jobIds,
  })
}

export function batchDeleteCommentReplies(jobIds: string[]) {
  return http.post<CommentReplyBatchResult>('/api/interaction-center/comment-replies/batch/delete', {
    job_ids: jobIds,
  })
}
