import { describe, expect, it } from 'vitest'
import { emptyPersona, type PersonaJob } from '@/api/accountPersona'
import { jobPersonaAnalysis, personaProgress } from './personaAnalysis'

const profile = { suggested_persona: { ...emptyPersona(), positioning: 'AI 作者定位' }, observations: [], limitations: '样本有限' }
const job = (values: Partial<PersonaJob>) => ({ account_id: 'source:s', kind: 'generate', status: 'running', result: {}, ...values }) as PersonaJob
describe('source author AI analysis', () => {
  it.each(['running', 'queued', 'failed', 'succeeded'] as const)('reads saved analysis while generation is %s', status => {
    expect(jobPersonaAnalysis(job({ status, result: { author_analysis: profile } }))).toEqual(profile)
  })
  it('keeps completed standalone analysis compatible', () => {
    expect(jobPersonaAnalysis(job({ kind: 'analyze', status: 'succeeded', result: profile }))?.suggested_persona).toEqual(profile.suggested_persona)
  })
  it('does not mistake empty, incomplete or publisher jobs for an author analysis', () => {
    expect(jobPersonaAnalysis(null)).toBeNull()
    expect(jobPersonaAnalysis(job({}))).toBeNull()
    expect(jobPersonaAnalysis(job({ kind: 'analyze', result: profile }))).toBeNull()
    expect(jobPersonaAnalysis(job({ account_id: 'publishing-account', result: { author_analysis: profile } }))).toBeNull()
  })
  it('shows stage and completed batches for running, retrying and failed jobs', () => {
    for (const status of ['running', 'queued', 'failed'] as const) {
      expect(personaProgress(job({ status, result: { progress: { stage: 'analysis_batch', label: '历史分析 · 第 2/3 批', completed_batches: 1, total_batches: 3 } } })))
        .toBe('历史分析 · 第 2/3 批 · 已完成 1/3 批')
    }
  })
  it('keeps old and completed records compatible without fabricating progress', () => {
    expect(personaProgress(null)).toBe('')
    expect(personaProgress(job({}))).toBe('')
    expect(personaProgress(job({ status: 'succeeded', result: { progress: { stage: 'analysis_merge', label: '画像汇总', completed_batches: 3, total_batches: 3 } } }))).toBe('')
    expect(personaProgress(job({ result: { progress: { stage: 'author_analysis', label: '原作者人设分析', completed_batches: 0, total_batches: 0 } } }))).toBe('原作者人设分析')
    expect(personaProgress(job({ result: { progress: { stage: 'analysis_batch', label: '历史分析', completed_batches: 9, total_batches: 3 } } }))).toBe('历史分析')
  })
})
