import type { RealtimeEventPayload } from '@/composables/useRealtimeEvents'
import type { AnyRecord } from '@/types/api'

export type TaskRealtimePatchResult = 'patched' | 'child' | 'missing' | 'stale' | 'ignored'
export type RuntimeRealtimePatchResult = 'patched' | 'missing' | 'stale' | 'ignored'

const TASK_SUMMARY_FIELDS = [
  'title',
  'task_type',
  'parent_task_run_id',
  'template_id',
  'script_key',
  'status',
  'slot_id',
  'account_id',
  'runtime_instance_id',
  'child_total',
  'child_finished',
  'child_succeeded',
  'child_failed',
  'child_canceled',
  'updated_at',
  'finished_at',
] as const

const RUNTIME_SUMMARY_FIELDS = [
  'runtime_id',
  'runtime_platform',
  'provider',
  'status',
  'lifecycle_status',
  'max_concurrent_slots',
  'slot_total',
  'slot_idle',
  'slot_running',
  'slot_error',
  'last_heartbeat_at',
  'current_version',
  'updated_at',
] as const

export function realtimeTaskSummary(payload: RealtimeEventPayload) {
  if (payload.topic !== 'task' || !payload.data || typeof payload.data !== 'object') return null
  const task = (payload.data as AnyRecord).task
  return task && typeof task === 'object' ? task as AnyRecord : null
}

export function realtimeRuntimeSummary(payload: RealtimeEventPayload) {
  if (payload.topic !== 'runtime' || !payload.data || typeof payload.data !== 'object') return null
  const runtime = (payload.data as AnyRecord).runtime
  return runtime && typeof runtime === 'object' ? runtime as AnyRecord : null
}

export function rowsContainRealtimeValue(
  rows: AnyRecord[],
  rowKeys: string[],
  value: unknown,
) {
  const normalized = String(value || '')
  return Boolean(normalized) && rows.some(
    (row) => rowKeys.some((key) => String(row[key] || '') === normalized),
  )
}

export function realtimeTaskTouchesRows(
  rows: AnyRecord[],
  payload: RealtimeEventPayload,
  rowKeys: string[],
  taskKeys: string[],
) {
  const task = realtimeTaskSummary(payload)
  return Boolean(task) && taskKeys.some(
    (key) => rowsContainRealtimeValue(rows, rowKeys, task?.[key]),
  )
}

function isStale(current: AnyRecord, incoming: AnyRecord) {
  const currentUpdatedAt = Date.parse(String(current.updated_at || ''))
  const incomingUpdatedAt = Date.parse(String(incoming.updated_at || ''))
  return Number.isFinite(currentUpdatedAt)
    && Number.isFinite(incomingUpdatedAt)
    && incomingUpdatedAt < currentUpdatedAt
}

export function patchTaskSummaryRows(
  rows: AnyRecord[],
  payload: RealtimeEventPayload,
): { result: TaskRealtimePatchResult; rows: AnyRecord[] } {
  const task = realtimeTaskSummary(payload)
  const taskId = String(task?.id || payload.resource_id || '')
  if (!task || !taskId) return { result: 'ignored', rows }
  if (task.parent_task_run_id) return { result: 'child', rows }

  const index = rows.findIndex((row) => String(row.id) === taskId)
  if (index < 0) return { result: 'missing', rows }

  if (isStale(rows[index], task)) {
    return { result: 'stale', rows }
  }

  const patched = { ...rows[index] }
  TASK_SUMMARY_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(task, field)) patched[field] = task[field]
  })
  const nextRows = [...rows]
  nextRows[index] = patched
  return { result: 'patched', rows: nextRows }
}

export function patchRuntimeSummaryRows(
  rows: AnyRecord[],
  payload: RealtimeEventPayload,
): { result: RuntimeRealtimePatchResult; rows: AnyRecord[] } {
  const runtime = realtimeRuntimeSummary(payload)
  const runtimeId = String(runtime?.id || payload.resource_id || '')
  if (!runtime || !runtimeId) return { result: 'ignored', rows }

  const index = rows.findIndex((row) => String(row.id) === runtimeId)
  if (index < 0) return { result: 'missing', rows }
  if (isStale(rows[index], runtime)) return { result: 'stale', rows }

  const patched = { ...rows[index] }
  RUNTIME_SUMMARY_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(runtime, field)) patched[field] = runtime[field]
  })
  const nextRows = [...rows]
  nextRows[index] = patched
  return { result: 'patched', rows: nextRows }
}
