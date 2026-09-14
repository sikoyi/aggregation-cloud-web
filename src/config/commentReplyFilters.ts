import type { CommentReplyFilters } from '@/api/commentReplies'

export interface CommentReplyFilterState {
  [key: string]: unknown
  businessPlatform: string
  accountId: string
  accountTagId: string
  replyMode: string
  status: string
  createdRange: string[]
  keyword: string
}

export function createDefaultCommentReplyFilters(): CommentReplyFilterState {
  return {
    businessPlatform: '',
    accountId: '',
    accountTagId: '',
    replyMode: '',
    status: 'pending_review',
    createdRange: [],
    keyword: '',
  }
}

export function buildCommentReplyQuery(
  filters: CommentReplyFilterState,
  page: number,
  pageSize: number,
): CommentReplyFilters {
  const [createdFrom, createdTo] = filters.createdRange || []
  return {
    business_platform: filters.businessPlatform || undefined,
    account_id: filters.accountId || undefined,
    account_tag_id: filters.accountTagId || undefined,
    reply_mode: filters.replyMode || undefined,
    status: filters.status || undefined,
    created_from: createdFrom || undefined,
    created_to: createdTo || undefined,
    keyword: filters.keyword.trim() || undefined,
    page,
    page_size: pageSize,
  }
}

export function hasActiveCommentReplyFilters(filters: CommentReplyFilterState) {
  const defaults = createDefaultCommentReplyFilters()
  return filters.businessPlatform !== defaults.businessPlatform
    || filters.accountId !== defaults.accountId
    || filters.accountTagId !== defaults.accountTagId
    || filters.replyMode !== defaults.replyMode
    || Boolean(filters.status)
    || filters.createdRange.length > 0
    || filters.keyword.trim() !== defaults.keyword
}
