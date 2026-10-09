export const processingReplyStatuses = [
  'pending_dispatch', 'generating', 'queued', 'waiting_slot', 'waiting_runtime',
  'dispatching', 'running', 'retry_wait', 'rate_limited',
]

export const commentReplyStatusOptions = [
  { label: '待审核', value: 'pending_review', type: 'warning' },
  { label: '处理中', value: 'operator_processing', type: 'primary' },
  { label: '已成功', value: 'succeeded', type: 'success' },
  { label: '失败', value: 'operator_failed', type: 'danger' },
  { label: '已忽略', value: 'ignored', type: 'info' },
  { label: '已取消', value: 'canceled', type: 'info' },
] as const

export function operatorReplyStatus(value: unknown) {
  const status = String(value || '')
  if (processingReplyStatuses.includes(status)) return 'operator_processing'
  if (['failed', 'blocked'].includes(status)) return 'operator_failed'
  return status
}

export function operatorReplyStatusMeta(value: unknown) {
  return commentReplyStatusOptions.find(option => option.value === operatorReplyStatus(value))
    || { label: String(value || '-'), type: 'info' as const }
}
