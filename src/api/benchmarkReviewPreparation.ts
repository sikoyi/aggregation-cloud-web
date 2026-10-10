import { http } from '@/api/http'

export type PreparationAction = 'shorten' | 'images' | 'translate'
export interface PreparationResult {
  id: string
  status: 'processed' | 'skipped' | 'failed'
  message: string
}

export async function retryFailedPreparations(
  jobs: { id: string; revision: string }[], results: PreparationResult[], action: PreparationAction,
  onResult: (result: PreparationResult) => void, shouldContinue: () => boolean = () => true,
) {
  const failed = new Set(results.filter(item => item.status === 'failed').map(item => item.id))
  for (const job of jobs.filter(item => failed.has(item.id))) {
    if (!shouldContinue()) break
    try {
      const current = await http.get<{ revision: string; status: string }>(
        `/api/benchmark-trackers/reviews/${encodeURIComponent(job.id)}`,
      )
      if (!shouldContinue()) break
      if (current.status !== 'pending_review' || current.revision !== job.revision) {
        onResult({ id: job.id, status: 'skipped', message: '工单状态或内容已变化，请查看最新工单后重新选择' })
        continue
      }
      await prepareSelectedReviews([job], action, onResult, shouldContinue)
    } catch (error) {
      onResult({ id: job.id, status: 'failed', message: error instanceof Error ? error.message : '读取最新工单失败' })
    }
  }
}

export async function prepareSelectedReviews(
  jobs: { id: string; revision: string }[],
  action: PreparationAction,
  onResult: (result: PreparationResult) => void,
  shouldContinue: () => boolean = () => true,
) {
  // Sequential requests keep AI concurrency bounded and report each item immediately.
  for (const job of jobs) {
    if (!shouldContinue()) break
    try {
      const result = await http.post<Omit<PreparationResult, 'id'>>(
        `/api/benchmark-trackers/reviews/${encodeURIComponent(job.id)}/prepare/${action}`,
        { revision: job.revision },
      )
      onResult({ ...result, id: job.id })
    } catch (error) {
      onResult({ id: job.id, status: 'failed', message: error instanceof Error ? error.message : '处理失败，请刷新工单后查看' })
    }
  }
}
