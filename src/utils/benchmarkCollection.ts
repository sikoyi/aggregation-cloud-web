import type { AnyRecord } from '@/types/api'

export type BenchmarkCollectionTracker = AnyRecord & { collection_run?: AnyRecord | null }

export function isBenchmarkCollecting(tracker: BenchmarkCollectionTracker | null) {
  return Boolean(tracker?.enabled && ['queued', 'starting', 'running'].includes(String(tracker.collection_run?.status)))
}

export function benchmarkCollectionStatus(tracker: BenchmarkCollectionTracker | null): { label: string; type: 'info' | 'primary' | 'success' | 'danger' } {
  if (!tracker) return { label: '读取采集状态', type: 'info' }
  if (!tracker.enabled || tracker.status === 'paused') return { label: '已关闭', type: 'info' }
  const run = tracker.collection_run
  if (run?.status === 'queued') return { label: Number(run.attempt_no) > 1 ? '等待重试' : '排队中', type: 'info' }
  if (isBenchmarkCollecting(tracker)) return { label: run?.phase === 'posts' ? '正在采集帖子' : '正在采集资料', type: 'primary' }
  if (run?.status === 'failed' || tracker.status === 'abnormal') return { label: '采集失败', type: 'danger' }
  if (run?.status === 'canceled') return { label: '采集已取消', type: 'info' }
  if (run?.status === 'succeeded' || tracker.last_success_at) return { label: '采集已完成', type: 'success' }
  return { label: '暂无采集记录', type: 'info' }
}
