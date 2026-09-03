import type { AnyRecord } from '@/types/api'

export interface RuntimeSyncFailure {
  key: string
  title: string
  message: string
  retryPath: string
}

const terminalFailureStatuses = new Set(['failed', 'expired'])

function value(record: AnyRecord, ...keys: string[]) {
  for (const key of keys) {
    const current = String(record[key] || '').trim()
    if (current) return current
  }
  return ''
}

function failureForRecord(resourceKey: string, record: AnyRecord): RuntimeSyncFailure | null {
  const status = value(record, 'group_sync_status', 'sync_status')
  if (!terminalFailureStatuses.has(status)) return null

  const batchId = value(record, 'group_control_batch_id', 'control_batch_id')
  const commandId = value(record, 'group_control_command_id', 'control_command_id')
  if (!batchId && !commandId) return null

  const isGroup = resourceKey === 'slotGroups'
  const subject = isGroup
    ? `设备组“${value(record, 'name') || record.id || '-'}”`
    : `设备“${value(record, 'display_name', 'provider_slot_no', 'provider_slot_id') || record.id || '-'}”`
  const reason = value(record, 'group_sync_error', 'sync_error')
    || (status === 'expired' ? '同步等待超时，请重新提交' : '供应商同步失败')
  const operationKey = batchId ? `batch:${batchId}` : `command:${commandId}`
  const retryPath = batchId
    ? `/api/runtime-controls/batches/${encodeURIComponent(batchId)}/retry`
    : `/api/runtime-controls/${encodeURIComponent(commandId)}/retry`

  return {
    key: operationKey,
    title: status === 'expired' ? '设备组同步已过期' : '设备组同步失败',
    message: `${subject}：${reason}`,
    retryPath,
  }
}

export function collectRuntimeSyncFailures(resourceKey: string, rows: AnyRecord[]) {
  if (!['slots', 'slotGroups'].includes(resourceKey)) return []

  const failures = new Map<string, RuntimeSyncFailure>()
  for (const record of rows) {
    const failure = failureForRecord(resourceKey, record)
    if (failure && !failures.has(failure.key)) failures.set(failure.key, failure)
  }
  return [...failures.values()]
}
