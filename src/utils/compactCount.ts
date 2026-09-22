export function formatCompactCount(value: unknown) {
  const number = typeof value === 'number' || (typeof value === 'string' && value.trim()) ? Number(value) : NaN
  if (!Number.isFinite(number) || number < 0) return { compact: '--', full: '--', expandable: false }
  const full = number.toLocaleString('zh-CN')
  return {
    compact: number < 1000 ? full : new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(number).toLowerCase(),
    full,
    expandable: number >= 1000,
  }
}

export function formatCompactSignedCount(value: unknown) {
  const number = typeof value === 'number' || (typeof value === 'string' && value.trim()) ? Number(value) : NaN
  if (!Number.isFinite(number)) return { compact: '--', full: '--', expandable: false }

  const sign = number > 0 ? '+' : number < 0 ? '-' : ''
  const absolute = formatCompactCount(Math.abs(number))
  return {
    compact: `${sign}${absolute.compact}`,
    full: `${sign}${absolute.full}`,
    expandable: absolute.expandable,
  }
}
