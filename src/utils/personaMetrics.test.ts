import { describe, expect, it } from 'vitest'
import type { PersonaJob } from '@/api/accountPersona'
import { personaMetrics } from './personaMetrics'

describe('persona stage metrics', () => {
  it('leaves legacy records without invented successes', () => {
    expect(personaMetrics([{ result: {} }])).toEqual([])
  })
  it('counts failed and unconfirmed requests and groups batches', () => {
    const job: Pick<PersonaJob, 'result'> = { result: { model_calls: [
      { id: '1', stage: '图文分析 · 第 1/3 批', status: 'succeeded', duration_ms: 1000 },
      { id: '2', stage: '图文分析 · 第 2/3 批', status: 'failed', duration_ms: 3000 },
      { id: '3', stage: '图文分析 · 第 2/3 批', status: 'pending' },
    ], stage_metrics: { 图片准备: { attempts: 2, succeeded: 1, duration_ms: 500 } } } }
    const rows = personaMetrics([job])
    expect(rows[0]).toMatchObject({ attempts: 2, succeeded: 1, rate: '50%', seconds: '0.5' })
    expect(rows[1]).toMatchObject({ attempts: 3, succeeded: 1, pending: 1, rate: '33%', seconds: '4.0' })
  })
})
