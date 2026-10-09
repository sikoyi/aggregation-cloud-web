import { http } from '@/api/http'

export type PreparationAction = 'shorten' | 'images' | 'translate'
export interface PreparationResult {
  id: string
  status: 'processed' | 'skipped' | 'failed'
  message: string
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
