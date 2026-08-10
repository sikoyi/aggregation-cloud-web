export function buildUserPreferenceKey(userId: unknown, preferenceKey: unknown) {
  const normalizedUserId = String(userId || '').trim()
  const normalizedPreferenceKey = String(preferenceKey || '').trim()
  if (!normalizedUserId || !normalizedPreferenceKey) return ''
  // 使用管理员 ID 隔离同一浏览器中的个人操作偏好。
  return `aggregation-cloud:user:${normalizedUserId}:${normalizedPreferenceKey}`
}

export function readRecordPreference(storage: Storage, key: string) {
  if (!key) return null
  try {
    const value = JSON.parse(storage.getItem(key) || 'null')
    if (!value || Array.isArray(value) || typeof value !== 'object') return null
    return value as Record<string, unknown>
  } catch {
    return null
  }
}

export function writeRecordPreference(
  storage: Storage,
  key: string,
  value: Record<string, unknown>,
) {
  if (!key) return
  storage.setItem(key, JSON.stringify(value))
}