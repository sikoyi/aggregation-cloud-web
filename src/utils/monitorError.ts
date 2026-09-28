import type { AnyRecord } from '@/types/api'

export function safeMonitorError(value: unknown): string {
  return String(value || '未记录详细原因')
    .replace(/(https?:\/\/)[^\s/@]+@/gi, '$1***@')
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9+/=._-]+/gi, '$1 ***')
    .replace(/((?:password|passwd|pwd|token|api[_-]?key|secret|authorization|cookie|2fa)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s&,;]+)/gi, '$1***')
}

export function monitorErrorDetails(data: AnyRecord) {
  const run = (data.collection_run || {}) as AnyRecord
  return {
    reason: safeMonitorError(run.error_message || data.last_error_message || data.last_error),
    time: data.last_failed_at || (run.status === 'failed' ? run.finished_at : null),
    phase: run.phase || data.error_phase || null,
    runId: run.id || null,
    taskId: data.task_run_id || null,
  }
}
