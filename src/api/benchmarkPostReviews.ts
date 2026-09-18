import { http } from '@/api/http'

export interface BenchmarkPostReviewBatchFailure {
  job_id: string
  message: string
}

export interface BenchmarkPostReviewBatchResult {
  requested_count: number
  processed_count: number
  skipped_count: number
  failed_count: number
  processed_job_ids: string[]
  skipped_job_ids: string[]
  failures: BenchmarkPostReviewBatchFailure[]
}

export function batchApproveBenchmarkPostReviews(jobIds: string[]) {
  return http.post<BenchmarkPostReviewBatchResult>('/api/benchmark-trackers/reviews/batch/approve', {
    job_ids: jobIds,
  })
}

export function batchIgnoreBenchmarkPostReviews(jobIds: string[]) {
  return http.post<BenchmarkPostReviewBatchResult>('/api/benchmark-trackers/reviews/batch/ignore', {
    job_ids: jobIds,
  })
}

export function batchDeleteBenchmarkPostReviews(jobIds: string[]) {
  return http.post<BenchmarkPostReviewBatchResult>('/api/benchmark-trackers/reviews/batch/delete', {
    job_ids: jobIds,
  })
}
