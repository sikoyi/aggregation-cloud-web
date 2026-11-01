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

export function monitorErrorTime(value: unknown): string {
  const date = value ? new Date(String(value)) : null
  return date && Number.isFinite(date.getTime())
    ? date.toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' })
    : '未记录'
}

export function monitorRuleLabel(state: unknown): string {
  return ({ monitoring: '监听已开启', paused: '监听已关闭', abnormal: '异常已停用', not_configured: '未配置监听' } as Record<string, string>)[String(state)] || '未配置监听'
}

export function monitorCollectionResult(data: AnyRecord) {
  const stamp = (value: unknown) => {
    if (!value) return null
    const time = Date.parse(String(value))
    return Number.isFinite(time) ? time : null
  }
  const success = stamp(data.last_success_at)
  const failure = stamp(data.last_failed_at)
  const error = String(data.last_error_message || '')
  const failed = (failure !== null && (success === null || failure > success))
    || (!!error && (failure === null || success === null || failure >= success))
  if (failed) return {
    failed: true, label: '最近采集失败', type: 'danger' as const,
    time: failure === null ? null : String(data.last_failed_at),
    reason: safeMonitorError(error || '采集未成功，未记录详细原因'),
  }
  if (success !== null) return {
    failed: false, label: '最近采集成功', type: 'success' as const,
    time: String(data.last_success_at), reason: '',
  }
  return { failed: false, label: '尚未采集成功', type: 'info' as const, time: null, reason: '' }
}

type MonitorSummaryItem = { label: string; type: 'primary' | 'info' | 'danger' | 'success'; count: number }

export function monitorGroupSummary(accounts: AnyRecord[]) {
  const rules = new Map<string, MonitorSummaryItem>()
  const collections = new Map<string, MonitorSummaryItem>()
  const states: Record<string, Omit<MonitorSummaryItem, 'count'>> = {
    monitoring: { label: '已开启', type: 'primary' },
    paused: { label: '已关闭', type: 'info' },
    abnormal: { label: '异常停用', type: 'danger' },
    not_configured: { label: '未配置', type: 'info' },
  }
  const add = (items: Map<string, MonitorSummaryItem>, item: Omit<MonitorSummaryItem, 'count'>) => {
    const previous = items.get(item.label)
    items.set(item.label, { ...item, count: (previous?.count || 0) + 1 })
  }
  for (const account of accounts) {
    const state = ['monitoring', 'paused', 'abnormal'].includes(String(account.monitor_state))
      ? String(account.monitor_state) : 'not_configured'
    add(rules, states[state]!)
    if (!account.monitor_setting_id && state === 'not_configured') continue
    const result = monitorCollectionResult(account)
    add(collections, { label: result.failed ? '失败' : result.type === 'success' ? '成功' : '暂无成功', type: result.type })
  }
  const priority = { danger: 0, primary: 1, success: 2, info: 3 }
  return [
    { key: 'rules', label: '监听', items: [...rules.values()] },
    { key: 'collections', label: '采集', items: [...collections.values()] },
  ].filter(group => group.items.length).map(group => ({
    ...group, items: group.items.sort((a, b) => priority[a.type] - priority[b.type]),
  }))
}
