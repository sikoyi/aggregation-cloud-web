import type { PersonaJob } from '@/api/accountPersona'

export function personaMetrics(jobs: Pick<PersonaJob, 'result'>[]) {
  const stages = new Map<string, { stage: string; attempts: number; succeeded: number; duration_ms: number; pending: number }>()
  const row = (stage: string) => {
    if (!stages.has(stage)) stages.set(stage, { stage, attempts: 0, succeeded: 0, duration_ms: 0, pending: 0 })
    return stages.get(stage)!
  }
  for (const job of jobs) {
    for (const [stage, value] of Object.entries(job.result.stage_metrics || {})) {
      const item = row(stage)
      item.attempts += value.attempts
      item.succeeded += value.succeeded
      item.duration_ms += value.duration_ms
    }
    for (const call of job.result.model_calls || []) {
      const item = row(`模型响应 · ${call.stage.replace(/第 \d+\/\d+ 批/, '分批')}`)
      item.attempts++
      item.succeeded += Number(call.status === 'succeeded')
      item.pending += Number(call.status === 'pending')
      item.duration_ms += call.duration_ms || 0
    }
  }
  return [...stages.values()].map(item => ({ ...item,
    rate: item.attempts ? `${Math.round(item.succeeded / item.attempts * 100)}%` : '--',
    seconds: (item.duration_ms / 1000).toFixed(1),
  }))
}
