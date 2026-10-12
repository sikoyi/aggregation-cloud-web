import { effectScope, reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { contentSelection, type SelectionAiResult } from '@/api/contentSelection'
import { useSelectionAiPreview } from './useSelectionAiPreview'

vi.mock('@/api/contentSelection', () => ({ contentSelection: { previewText: vi.fn() } }))

function setup() {
  const context = reactive({ postId: 'post', revision: 'revision', accountId: 'account', text: 'Original draft', platform: 'x' })
  const scope = effectScope()
  const state = scope.run(() => useSelectionAiPreview(() => ({ ...context })))!
  return { context, scope, state }
}

describe('manual selection AI preview', () => {
  beforeEach(() => vi.clearAllMocks())
  it('never calls AI on open or overwrites draft on completion', async () => {
    const { context, scope, state } = setup()
    expect(contentSelection.previewText).not.toHaveBeenCalled()
    vi.mocked(contentSelection.previewText).mockResolvedValue({ text_body: 'Translated', changed: true })
    await state.generate('translate', 'zh-TW')
    expect(state.result.value?.text_body).toBe('Translated')
    expect(context.text).toBe('Original draft')
    expect(contentSelection.previewText).toHaveBeenCalledWith('post', expect.objectContaining({ language: 'zh-TW', action: 'translate', text_body: 'Original draft' }))
    scope.stop()
  })
  it.each(['text', 'accountId', 'postId', 'revision'] as const)('discards stale response after %s changes', async key => {
    const { context, scope, state } = setup()
    let resolve!: (result: SelectionAiResult) => void
    vi.mocked(contentSelection.previewText).mockReturnValue(new Promise(r => { resolve = r }))
    const pending = state.generate('shorten')
    context[key] = 'changed'
    resolve({ text_body: 'Old result', changed: true })
    await pending
    expect(state.result.value).toBeNull()
    expect(state.busy.value).toBe(false)
    scope.stop()
  })
  it('blocks double clicks and discards responses after closing', async () => {
    const { scope, state } = setup()
    let resolve!: (result: SelectionAiResult) => void
    vi.mocked(contentSelection.previewText).mockReturnValue(new Promise(r => { resolve = r }))
    const pending = state.generate('shorten')
    await state.generate('shorten')
    expect(contentSelection.previewText).toHaveBeenCalledTimes(1)
    scope.stop()
    resolve({ text_body: 'Old result', changed: true })
    await pending
    expect(state.result.value).toBeNull()
  })
  it('retains draft on failure and allows retry', async () => {
    const { context, scope, state } = setup()
    vi.mocked(contentSelection.previewText).mockRejectedValueOnce(new Error('failed'))
    await state.generate('shorten')
    expect(state.error.value).toBe('failed')
    expect(context.text).toBe('Original draft')
    expect(state.busy.value).toBe(false)
    vi.mocked(contentSelection.previewText).mockResolvedValue({ text_body: 'Short', changed: true })
    await state.generate('shorten')
    expect(state.error.value).toBe('')
    expect(state.result.value?.text_body).toBe('Short')
    scope.stop()
  })
})
