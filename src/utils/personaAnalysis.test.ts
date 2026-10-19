import { describe, expect, it } from 'vitest'
import { emptyPersona, type PersonaJob } from '@/api/accountPersona'
import { jobPersonaAnalysis } from './personaAnalysis'

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
})
