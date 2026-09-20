export function lastPostElapsed(value: unknown, now: number): string {
  if (!value || typeof value !== 'string') return '暂无发帖数据'
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return '暂无发帖数据'
  const minutes = Math.floor(Math.max(0, now - timestamp) / 60_000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟`
  if (minutes < 1440) return `${Math.floor(minutes / 60)} 小时`
  return `${Math.floor(minutes / 1440)} 天`
}
