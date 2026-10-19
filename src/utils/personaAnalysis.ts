import type { PersonaAnalysis, PersonaJob } from '@/api/accountPersona'

export function personaProgress(job: PersonaJob | null | undefined): string {
  const progress = job?.result.progress
  if (!progress || job?.status === 'succeeded') return ''
  const counts = Number.isInteger(progress.completed_batches) && Number.isInteger(progress.total_batches)
    && progress.completed_batches >= 0 && progress.total_batches > 0 && progress.completed_batches <= progress.total_batches
  return progress.label + (counts ? ` · 已完成 ${progress.completed_batches}/${progress.total_batches} 批` : '')
}

export function latestPersonaJob(jobs: PersonaJob[]): PersonaJob | null {
  const analyzedAt = (job: PersonaJob) => {
    const timestamp = Date.parse(job.result.analysis_reference?.analyzed_at || '')
    return Number.isFinite(timestamp) ? timestamp : Date.parse(job.created_at)
  }
  return jobs.filter(job => !!jobPersonaAnalysis(job)).sort((a, b) => analyzedAt(b) - analyzedAt(a))[0] || null
}

export function jobPersonaAnalysis(job: PersonaJob | null | undefined): PersonaAnalysis | null {
  if (job?.account_id.startsWith('source:') && job.kind === 'generate' && job.result.author_analysis) return job.result.author_analysis
  if (job?.kind === 'analyze' && job.status === 'succeeded' && job.result.suggested_persona) {
    return { observations: job.result.observations || [], suggested_persona: job.result.suggested_persona,
      limitations: job.result.limitations || '', sample_count: job.result.sample_count, available_posts: job.result.available_posts }
  }
  return null
}
