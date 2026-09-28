import type { AnyRecord } from '@/types/api'

const benchmarkTaskTypes = new Set(['benchmark_content_publish', 'benchmark_content_delete', 'account_profile_sync'])

export function taskOperator(row: AnyRecord) {
  if (row.dispatch_source === 'system') return { name: '系统自动下发', secondary: '' }
  if (!row.dispatch_source && benchmarkTaskTypes.has(String(row.task_type))) {
    return { name: '下发来源未记录', secondary: '' }
  }
  const explicit = Boolean(row.dispatch_source)
  const displayName = String((explicit ? row.dispatcher_display_name : row.creator_display_name) || '').trim()
  const username = String((explicit ? row.dispatcher_username : row.creator_username) || '').trim()
  const id = explicit ? row.dispatched_by : row.created_by
  return {
    name: displayName || username || (id ? `ID ${id}` : '-'),
    secondary: username && username !== displayName ? `@${username}` : '',
  }
}
