import { beforeEach, describe, expect, it, vi } from 'vitest'
import { accountPersona, emptyPersona, personaFields } from './accountPersona'
import { http } from './http'

vi.mock('./http', () => ({ http: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }))
describe('account persona API', () => {
  beforeEach(() => vi.clearAllMocks())
  it('creates independent editable personas', () => {
    const first = emptyPersona()
    first.positioning = 'changed'
    expect(emptyPersona().positioning).toBe('')
    expect(personaFields.map(f => f.key).sort()).toEqual(Object.keys(first).sort())
  })
  it('encodes account and job IDs', () => {
    accountPersona.job('a/b', 'job?1')
    expect(http.get).toHaveBeenCalledWith('/api/account-personas/a%2Fb/jobs/job%3F1')
  })
  it('requires explicit confirmation with expected version', () => {
    const data = { document: emptyPersona(), expected_version: 4, analysis_job_id: 'analysis' }
    accountPersona.confirm('a', data)
    expect(http.post).toHaveBeenCalledWith('/api/account-personas/a/confirm', data)
  })
  it('passes the selected source and persona, never dispatches', () => {
    const data = { request_key: 'request', post_id: 'p', persona_id: 'v', language: 'zh-CN', direction: 'short' }
    accountPersona.generate('a', data)
    expect(http.post).toHaveBeenCalledExactlyOnceWith('/api/account-personas/a/generate', data)
  })
  it('saves manual drafts with optimistic version', () => {
    accountPersona.save('a', 'j', 'manual text', 3)
    expect(http.put).toHaveBeenCalledWith('/api/account-personas/a/jobs/j/draft', { text_body: 'manual text', expected_version: 3 })
  })
  it('keeps the source author distinct from the publishing account', () => {
    const data = { request_key: 'request', post_id: 'p', persona_id: 'source-v1', language: 'zh-CN', direction: '', target_account_id: '5822' }
    accountPersona.generate('source:author-1', data)
    expect(http.post).toHaveBeenCalledExactlyOnceWith('/api/account-personas/source%3Aauthor-1/generate', data)
    accountPersona.overview('source:author-1')
    expect(http.get).toHaveBeenCalledWith('/api/account-personas/source%3Aauthor-1')
  })
  it('can generate directly from the source without a persona version', () => {
    const data = { request_key: 'simple-request', post_id: 'p', language: 'zh-CN', direction: '', target_account_id: '5822' }
    accountPersona.generate('source:author-1', data)
    expect(http.post).toHaveBeenCalledExactlyOnceWith('/api/account-personas/source%3Aauthor-1/generate', data)
    expect(data).not.toHaveProperty('persona_id')
  })
})
