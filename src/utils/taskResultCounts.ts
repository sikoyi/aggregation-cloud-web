import type { AnyRecord } from '@/types/api'

// Keep parent-only task types aligned with app/services/task_aggregation.py.
const parentTypes = new Set(['template_batch', 'interaction_session', 'publish_content_batch', 'account_registration_batch', 'account_warmup_batch'])
const successfulStatuses = new Set(['succeeded', 'completed'])
const failedStatuses = new Set(['all_failed', 'failed', 'expired', 'lost'])

export type TaskResultAlertType = 'success' | 'warning' | 'info' | 'error'

export function taskResultAlertType(status: unknown): TaskResultAlertType {
  const value = String(status || '')
  if (failedStatuses.has(value)) return 'error'
  if (value === 'canceled') return 'info'
  if (successfulStatuses.has(value)) return 'success'
  return 'warning'
}

export function taskResultCounts(row: AnyRecord) {
  if (parentTypes.has(String(row.task_type)) || Number(row.child_total || 0) > 0) {
    return {
      succeeded: Number(row.child_succeeded || 0),
      failed: Number(row.child_failed || 0),
      canceled: Number(row.child_canceled || 0),
    }
  }
  return {
    succeeded: row.status === 'succeeded' ? 1 : 0,
    failed: ['failed', 'expired', 'lost'].includes(String(row.status)) ? 1 : 0,
    canceled: row.status === 'canceled' ? 1 : 0,
  }
}
