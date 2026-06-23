import type { AnyRecord } from '@/types/api'
import type { ColumnConfig } from '@/types/crud'

export function formatDate(value: unknown) {
  if (!value) return '-'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString()
}

export function formatCell(row: AnyRecord, column: ColumnConfig) {
  const value = row[column.key]
  if (value === undefined || value === null || value === '') return '-'
  if (column.type === 'datetime') return formatDate(value)
  if (column.type === 'list') return Array.isArray(value) ? value.join(', ') : String(value)
  if (column.type === 'json') return JSON.stringify(value)
  if (column.type === 'boolean') return value ? '是' : '否'
  return String(value)
}

export function truncateId(value: unknown) {
  const text = String(value || '')
  if (text.length <= 12) return text || '-'
  return `${text.slice(0, 6)}...${text.slice(-4)}`
}

export function statusTone(status: unknown) {
  const value = String(status || '').toLowerCase()
  if (['enabled', 'normal', 'idle', 'online', 'queued', 'succeeded', 'logged_in'].includes(value)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }
  if (['running', 'dispatching', 'starting', 'waiting_slot', 'waiting_runtime'].includes(value)) {
    return 'border-blue-200 bg-blue-50 text-blue-700'
  }
  if (['disabled', 'offline', 'archived', 'canceled'].includes(value)) {
    return 'border-slate-200 bg-slate-50 text-slate-600'
  }
  if (['failed', 'error', 'expired', 'lost', 'restricted'].includes(value)) {
    return 'border-red-200 bg-red-50 text-red-700'
  }
  return 'border-amber-200 bg-amber-50 text-amber-700'
}
