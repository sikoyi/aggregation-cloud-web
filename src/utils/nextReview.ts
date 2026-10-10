// Re-read the same filtered pages after approval; pending-only lists may shift by one row.
export async function findNextReview<T extends { id?: unknown; status?: unknown }>(options: {
  rows: T[]; currentId: string; page: number; pageSize: number
  list: (page: number) => Promise<{ items: T[]; total: number }>
  detail: (id: string) => Promise<T>
  active: () => boolean
}): Promise<{ job: T; page: number; items: T[]; total: number } | null> {
  const index = options.rows.findIndex(row => String(row.id) === options.currentId)
  if (index < 0) return null
  const excluded = new Set(options.rows.slice(0, index + 1).map(row => String(row.id)))
  for (let page = options.page; options.active(); page++) {
    const result = await options.list(page)
    if (!options.active()) return null
    for (const row of result.items) {
      const id = String(row.id)
      if (excluded.has(id) || row.status !== 'pending_review') continue
      excluded.add(id)
      const current = await options.detail(id)
      if (!options.active()) return null
      if (current.status === 'pending_review') return { job: current, page, ...result }
    }
    if (!result.items.length || page * options.pageSize >= result.total) return null
  }
  return null
}
