type ReviewPosition = { id?: unknown; created_at?: unknown }

function timestamp(position: ReviewPosition): [number, string] {
  const value = String(position.created_at || '')
  // PostgreSQL timestamps retain microseconds that Date.parse alone would discard.
  return [Date.parse(value), (value.match(/\.(\d+)/)?.[1] || '').padEnd(6, '0')]
}

function follows(row: ReviewPosition, anchor: ReviewPosition): boolean {
  const [time, fraction] = timestamp(row)
  const [anchorTime, anchorFraction] = timestamp(anchor)
  if (!Number.isFinite(time) || !Number.isFinite(anchorTime)) return false
  if (time !== anchorTime) return time < anchorTime
  if (fraction !== anchorFraction) return fraction < anchorFraction
  return String(row.id) < String(anchor.id)
}

// Both review APIs sort by created_at DESC, id DESC. Page numbers can change during review.
export async function findNextReview<T extends ReviewPosition & { status?: unknown }>(options: {
  rows: T[]; currentId: string; page: number; pageSize: number
  list: (page: number) => Promise<{ items: T[]; total: number }>
  detail: (id: string) => Promise<T>
  active: () => boolean
}): Promise<{ job: T; page: number; items: T[]; total: number } | null> {
  const index = options.rows.findIndex(row => String(row.id) === options.currentId)
  if (index < 0) return null
  const anchor = options.rows[index]
  const excluded = new Set(options.rows.slice(0, index + 1).map(row => String(row.id)))
  let previousTotal: number | undefined
  for (let page = 1; options.active(); page++) {
    const result = await options.list(page)
    if (!options.active()) return null
    if (previousTotal !== undefined && result.total < previousTotal && page > 1) {
      previousTotal = result.total
      page = 0
      continue
    }
    previousTotal = result.total
    for (const row of result.items) {
      const id = String(row.id)
      if (excluded.has(id) || row.status !== 'pending_review' || !follows(row, anchor)) continue
      excluded.add(id)
      const current = await options.detail(id)
      if (!options.active()) return null
      if (current.status === 'pending_review') return { job: current, page, ...result }
    }
    if (!result.items.length || page * options.pageSize >= result.total) return null
  }
  return null
}
