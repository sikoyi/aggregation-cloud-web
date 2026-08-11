export interface DashboardQuickEntryPreference {
  id: string
  visible: boolean
}

export function buildDefaultQuickEntryPreferences(
  defaultIds: readonly string[],
): DashboardQuickEntryPreference[] {
  return defaultIds.map((id) => ({ id, visible: true }))
}

export function normalizeQuickEntryPreferences(
  defaultIds: readonly string[],
  storedValue: unknown,
): DashboardQuickEntryPreference[] {
  const storedEntries = (
    storedValue
    && typeof storedValue === 'object'
    && !Array.isArray(storedValue)
    && Array.isArray((storedValue as { entries?: unknown }).entries)
  )
    ? (storedValue as { entries: unknown[] }).entries
    : []
  const validIds = new Set(defaultIds)
  const seenIds = new Set<string>()
  const normalized: DashboardQuickEntryPreference[] = []

  for (const item of storedEntries) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const id = String((item as { id?: unknown }).id || '').trim()
    if (!validIds.has(id) || seenIds.has(id)) continue
    normalized.push({
      id,
      visible: (item as { visible?: unknown }).visible !== false,
    })
    seenIds.add(id)
  }

  for (const id of defaultIds) {
    if (!seenIds.has(id)) normalized.push({ id, visible: true })
  }
  return normalized
}

export function moveQuickEntryPreference(
  entries: readonly DashboardQuickEntryPreference[],
  id: string,
  direction: -1 | 1,
) {
  const nextEntries = entries.map((item) => ({ ...item }))
  const currentIndex = nextEntries.findIndex((item) => item.id === id)
  const targetIndex = currentIndex + direction
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= nextEntries.length) {
    return nextEntries
  }
  const [movingEntry] = nextEntries.splice(currentIndex, 1)
  if (movingEntry) nextEntries.splice(targetIndex, 0, movingEntry)
  return nextEntries
}
