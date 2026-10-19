import type { PersonaAnalysis, PersonaJob } from '@/api/accountPersona'

export function jobPersonaAnalysis(job: PersonaJob | null | undefined): PersonaAnalysis | null {
  if (job?.account_id.startsWith('source:') && job.kind === 'generate' && job.result.author_analysis) return job.result.author_analysis
  if (job?.kind === 'analyze' && job.status === 'succeeded' && job.result.suggested_persona) {
    return { observations: job.result.observations || [], suggested_persona: job.result.suggested_persona,
      limitations: job.result.limitations || '', sample_count: job.result.sample_count, available_posts: job.result.available_posts }
  }
  return null
}
