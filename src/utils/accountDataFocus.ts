export function accountDataFocus(value: unknown): string {
  return typeof value === 'string' && value.trim().length <= 100 ? value.trim() : ''
}

export function accountDataQuery(id: string, filters: Record<string, unknown>, page: number, pageSize: number) {
  return id ? { account_id: id, group_by_identity: true, page: 1, page_size: 20 }
    : { ...filters, group_by_identity: true, page, page_size: pageSize }
}
