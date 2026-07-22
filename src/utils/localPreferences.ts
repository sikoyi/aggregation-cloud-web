export function buildUserPreferenceKey(userId: unknown, preferenceKey: unknown) {
  const normalizedUserId = String(userId || '').trim()
  const normalizedPreferenceKey = String(preferenceKey || '').trim()
  if (!normalizedUserId || !normalizedPreferenceKey) return ''
  // 使用管理员 ID 隔离同一浏览器中的个人操作偏好。
  return `aggregation-cloud:user:${normalizedUserId}:${normalizedPreferenceKey}`
}

export function readStringListPreference(storage: Storage, key: string) {
  if (!key) return []
  try {
    const value = JSON.parse(storage.getItem(key) || '[]')
    if (!Array.isArray(value)) return []
    return [...new Set(value.map(String).filter(Boolean))]
  } catch {
    return []
  }
}

export function writeStringListPreference(storage: Storage, key: string, value: string[]) {
  if (!key) return
  const normalizedValue = [...new Set(value.map(String).filter(Boolean))]
  storage.setItem(key, JSON.stringify(normalizedValue))
}
