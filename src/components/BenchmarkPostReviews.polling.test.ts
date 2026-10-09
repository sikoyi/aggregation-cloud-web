import { expect, it, vi } from 'vitest'
import { transpile, ScriptTarget } from 'typescript'
import source from './BenchmarkPostReviews.vue?raw'

function setup() {
  const state: Record<string, any> = { disposed: false, document: { hidden: false }, request: 0,
    filters: {}, http: { get: vi.fn() }, notifyError: vi.fn(), buildPostReviewQuery: vi.fn() }
  for (const key of ['visible', 'preparationVisible', 'batchLoading', 'saving', 'uploading', 'regenerating', 'deletingId', 'retryingId', 'loading', 'refreshing']) state[key] = { value: false }
  state.selectedRows = { value: [] }; state.rows = { value: [{ id: 'one' }] }; state.page = { value: 1 }; state.total = { value: 1 }
  const code = source.slice(source.indexOf('function pollingPaused()'), source.indexOf('function searchRows()'))
  const load = new Function(...Object.keys(state), transpile(code, { target: ScriptTarget.ES2022 }) + '; return load;')(...Object.values(state))
  return { ...state, load }
}

it('polls without loading mask or replacing unchanged rows', async () => {
  const s = setup(); const previous = s.rows.value
  let complete!: (value: unknown) => void
  s.http.get.mockImplementation(() => new Promise(resolve => { complete = resolve }))
  const pending = s.load(true)
  expect(s.loading.value).toBe(false); expect(s.refreshing.value).toBe(true)
  await s.load(true); expect(s.http.get).toHaveBeenCalledTimes(1)
  complete({ items: [{ id: 'one' }], total: 1 }); await pending
  expect(s.rows.value).toBe(previous); expect(s.refreshing.value).toBe(false)
})

it('does not apply a polling response after selection starts', async () => {
  const s = setup()
  s.http.get.mockImplementation(async () => { s.selectedRows.value = [{ id: 'one' }]; return { items: [], total: 0 } })
  await s.load(true)
  expect(s.rows.value).toEqual([{ id: 'one' }])
  await s.load(true); expect(s.http.get).toHaveBeenCalledTimes(1)
})

it('quiet failures retain rows without repeated notifications; manual requests show errors', async () => {
  const s = setup(); s.http.get.mockRejectedValue(new Error('offline'))
  await s.load(true); expect(s.notifyError).not.toHaveBeenCalled()
  expect(s.rows.value).toEqual([{ id: 'one' }])
  await s.load(); expect(s.notifyError).toHaveBeenCalledTimes(1)
})

it('manual requests supersede older polling results', async () => {
  const s = setup(); let complete!: (value: unknown) => void
  s.http.get.mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
    .mockResolvedValueOnce({ items: [{ id: 'new' }], total: 1 })
  const pending = s.load(true); await s.load()
  complete({ items: [], total: 0 }); await pending
  expect(s.rows.value).toEqual([{ id: 'new' }])
})
