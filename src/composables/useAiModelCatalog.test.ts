import { effectScope, reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '@/api/http'
import { modelPrice, useAiModelCatalog } from './useAiModelCatalog'

vi.mock('@/api/http', () => ({ http: { post: vi.fn() } }))
const post = vi.mocked(http.post)
function setup() {
  const connection = reactive({ endpoint: '/openai/relay', api_key: '', base_url: 'https://relay.example/v1' })
  const scope = effectScope()
  const state = scope.run(() => useAiModelCatalog(() => ({ ...connection })))!
  return { connection, scope, state }
}
beforeEach(() => post.mockReset())
describe('manual AI catalogue', () => {
  it('does not call upstream until requested', async () => {
    const { state, scope } = setup()
    expect(post).not.toHaveBeenCalled()
    post.mockResolvedValue([{ id: 'future' }])
    await state.fetchModels()
    expect(state.models.value).toEqual([{ id: 'future' }])
    expect(post).toHaveBeenCalledWith('/openai/relay/models', { api_key: null, base_url: 'https://relay.example/v1' })
    scope.stop()
  })
  it('keeps fetched choices on failure', async () => {
    const { state, scope } = setup()
    post.mockResolvedValueOnce([{ id: 'future' }]).mockRejectedValueOnce(new Error('HTTP 401'))
    await state.fetchModels()
    await state.fetchModels()
    expect(state.models.value).toEqual([{ id: 'future' }])
    expect(state.error.value).toBe('HTTP 401')
    scope.stop()
  })
  it('drops stale results when endpoint or credentials change', async () => {
    const { state, connection, scope } = setup()
    let resolve!: (data: unknown) => void
    post.mockReturnValue(new Promise(done => { resolve = done }))
    const pending = state.fetchModels()
    connection.api_key = 'changed'
    resolve([{ id: 'old' }])
    await pending
    expect(state.models.value).toBeNull()
    expect(state.loading.value).toBe(false)
    scope.stop()
  })
  it('prevents duplicate probes and clears stale tests', async () => {
    const { state, connection, scope } = setup()
    let resolve!: (data: unknown) => void
    post.mockReturnValue(new Promise(done => { resolve = done }))
    const pending = state.testModel('future')
    await state.testModel('future')
    expect(post).toHaveBeenCalledTimes(1)
    connection.endpoint = '/claude/relay'
    resolve({ model: 'future', input_tokens: 3 })
    await pending
    expect(state.tests.value).toEqual({})
    scope.stop()
  })
  it('shows unknown prices without guessing and preserves free quotes', () => {
    expect(modelPrice({ id: 'future' })).toBe('价格未知')
    expect(modelPrice({ id: 'future', input_price: 1 })).toBe('价格未知')
    expect(modelPrice({ id: 'future', input_price: 0, output_price: 2, currency: 'USD' })).toContain('输入 0 · 输出 2')
  })
})
