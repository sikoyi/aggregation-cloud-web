export interface SelectionMarks { read: string[]; saved: string[] }
export function selectionStorageKey(tenant: string, user: string) {
  return `selection-marks:v1:${encodeURIComponent(tenant)}:${encodeURIComponent(user)}`
}
export function parseSelectionMarks(value: string | null): SelectionMarks {
  try {
    const data = JSON.parse(value || '{}')
    const ids = (items: unknown) => Array.isArray(items) ? [...new Set(items.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 100))] : []
    return { read: ids(data?.read), saved: ids(data?.saved) }
  } catch { return { read: [], saved: [] } }
}
export function selectionMarkQuery(marks: SelectionMarks, status: string, hideRead: boolean) {
  hideRead = hideRead && status !== 'read'
  const read = new Set(marks.read)
  const included = status === 'saved' ? marks.saved : status === 'read' ? marks.read : null
  return {
    include_ids: included?.filter(id => !hideRead || !read.has(id)) ?? null,
    exclude_ids: status === 'unread' || hideRead ? marks.read : [],
  }
}
export function selectionDateRange(preset: string, now = new Date()): [string, string] | null {
  if (!preset) return null
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(now)
  if (preset === 'yesterday') {
    end.setTime(start.getTime() - 1)
    start.setDate(start.getDate() - 1)
  } else {
    const days = Number(preset)
    if (![1, 3, 7, 30].includes(days)) return null
    start.setDate(start.getDate() - days + 1)
  }
  return [start.toISOString(), end.toISOString()]
}
