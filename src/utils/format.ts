import type { AnyRecord } from '@/types/api'
import type { ColumnConfig } from '@/types/crud'

const STATUS_LABELS: Record<string, string> = {
  active: '生效',
  acknowledged: '已确认',
  assigned: '已分配',
  banned: '封禁',
  canceled: '已取消',
  challenge: '封禁',
  connecting: '连接中',
  all_failed: '全部失败',
  completed: '已完成',
  disabled: '已禁用',
  dispatching: '下发中',
  draft: '草稿',
  enabled: '已启用',
  error: '异常',
  expired: '已超时',
  failed: '失败',
  idle: '空闲',
  login_pending: '登录中',
  login_required: '未登录',
  logged_in: '已登录',
  lost: '已丢失',
  normal: '正常',
  not_logged_in: '未登录',
  offline: '离线',
  online: '在线',
  pending: '待处理',
  partial_completed: '部分完成',
  queued: '排队中',
  rate_limited: '限流中',
  ready: '可使用',
  restricted: '封禁',
  retry_wait: '等待重试',
  running: '运行中',
  starting: '启动中',
  stopping: '停止中',
  succeeded: '成功',
  twofa_required: '需要 2FA',
  unused: '未使用',
  used: '已使用',
  unbound: '已解绑',
  unknown: '未知',
  waiting_runtime: '等待 Runtime',
  waiting_slot: '等待设备',
}

const SUCCESS_STATUSES = ['enabled', 'normal', 'idle', 'online', 'queued', 'succeeded', 'completed', 'logged_in', 'active', 'ready', 'used']
const PRIMARY_STATUSES = ['running', 'dispatching', 'starting', 'waiting_slot', 'waiting_runtime', 'connecting', 'login_pending']
const INFO_STATUSES = ['disabled', 'offline', 'canceled', 'unbound', 'pending', 'unknown', 'not_logged_in', 'unused']
const DANGER_STATUSES = ['failed', 'all_failed', 'error', 'expired', 'lost', 'restricted', 'banned']

export function getCellValue(row: AnyRecord, key: string) {
  if (!key.includes('.')) return row[key]
  return key.split('.').reduce<unknown>((value, part) => {
    if (value && typeof value === 'object' && part in value) {
      return (value as Record<string, unknown>)[part]
    }
    return undefined
  }, row)
}

export function formatDate(value: unknown) {
  if (!value) return '-'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString()
}

export function statusLabel(status: unknown) {
  const value = String(status || '').toLowerCase()
  return STATUS_LABELS[value] || String(status || '-')
}

export function statusTagType(status: unknown) {
  const value = String(status || '').toLowerCase()
  if (SUCCESS_STATUSES.includes(value)) return 'success'
  if (PRIMARY_STATUSES.includes(value)) return 'primary'
  if (INFO_STATUSES.includes(value)) return 'info'
  if (DANGER_STATUSES.includes(value)) return 'danger'
  return 'warning'
}

export function formatCell(row: AnyRecord, column: ColumnConfig) {
  const value = getCellValue(row, column.key)
  if (value === undefined || value === null || value === '') return '-'
  if (column.options?.length) {
    const option = column.options.find((item) => String(item.value) === String(value))
    if (option) return option.label
  }
  if (column.type === 'status') return statusLabel(value)
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
