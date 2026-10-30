import type { AnyRecord } from '@/types/api'
import { safeMonitorError } from './monitorError'

export type BenchmarkCollectionTracker = AnyRecord & { collection_run?: AnyRecord | null }

export function isBenchmarkCollecting(tracker: BenchmarkCollectionTracker | null) {
  return Boolean(tracker?.enabled && ['queued', 'starting', 'running'].includes(String(tracker.collection_run?.status)))
}

export function benchmarkCollectionStatus(tracker: BenchmarkCollectionTracker | null): { label: string; type: 'info' | 'primary' | 'success' | 'danger' } {
  if (!tracker) return { label: '读取采集状态', type: 'info' }
  if (tracker.status === 'abnormal') return { label: '采集失败', type: 'danger' }
  if (!tracker.enabled || tracker.status === 'paused') return { label: '已关闭', type: 'info' }
  const run = tracker.collection_run
  if (run?.status === 'queued') return { label: Number(run.attempt_no) > 1 ? '等待重试' : '排队中', type: 'info' }
  if (isBenchmarkCollecting(tracker)) return { label: run?.phase === 'posts' ? '正在采集帖子' : '正在采集资料', type: 'primary' }
  if (run?.status === 'failed' || tracker.status === 'abnormal') return { label: '采集失败', type: 'danger' }
  if (run?.status === 'canceled') return { label: '采集已取消', type: 'info' }
  if (run?.status === 'succeeded' || tracker.last_success_at) return { label: '采集已完成', type: 'success' }
  return { label: '暂无采集记录', type: 'info' }
}

export function benchmarkCollectionNotice(
  tracker: BenchmarkCollectionTracker | null,
  readError: string,
  sourceUrl: string,
  sourcePlatform: string,
) {
  if (readError) return { title: '读取对标状态失败', message: safeMonitorError(readError), type: 'error' as const, time: null, runId: null, source: null }
  if (!tracker) return null
  const run = tracker.collection_run
  const failedRun = run?.status === 'failed'
  const message = (failedRun ? run.error_message : null) || tracker.last_error_message
  if (!message) return null
  const profileKey = (value: unknown) => {
    try {
      const url = new URL(String(value))
      const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/^threads\.net$/, 'threads.com').replace(/^(mobile\.)?twitter\.com$/, 'x.com')
      return `${host}${url.pathname.toLowerCase().replace(/\/+$/, '')}`
    } catch { return String(value || '').trim().toLowerCase() }
  }
  const sourceChanged = sourcePlatform !== tracker.source_business_platform || profileKey(sourceUrl) !== profileKey(tracker.source_profile_url)
  const time = (failedRun ? run.finished_at : null) || tracker.last_failed_at || null
  const recovered = !!(time && tracker.last_success_at && Date.parse(String(tracker.last_success_at)) >= Date.parse(String(time)))
  const historical = sourceChanged || !tracker.enabled || tracker.status === 'paused' || isBenchmarkCollecting(tracker) || recovered
  return {
    title: historical ? '历史采集失败' : '当前采集失败',
    message: safeMonitorError(message),
    type: historical ? 'info' as const : 'error' as const,
    time,
    runId: failedRun ? run.id || null : null,
    source: tracker.source_username || tracker.source_profile_url || null,
  }
}
