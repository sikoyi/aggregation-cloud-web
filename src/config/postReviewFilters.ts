export function createDefaultPostReviewFilters() {
  return { businessPlatform: '', accountId: '', accountTagId: '', status: '', createdRange: [] as string[], keyword: '' }
}

export function buildPostReviewQuery(filters: ReturnType<typeof createDefaultPostReviewFilters>, page: number) {
  const [from, to] = filters.createdRange || []
  return { business_platform: filters.businessPlatform || undefined, account_id: filters.accountId || undefined,
    account_tag_id: filters.accountTagId || undefined, status: filters.status || undefined,
    created_from: from || undefined, created_to: to || undefined, keyword: filters.keyword.trim() || undefined,
    page, page_size: 20 }
}
