import { describe, expect, it, vi } from 'vitest'
import { ScriptTarget, transpile } from 'typescript'
import { ref, watch } from 'vue'
import postSource from './BenchmarkPostReviews.vue?raw'
import replySource from '../views/CommentReplyReviewView.vue?raw'

describe.each([
  ['post', postSource, 'open', 'async function continueAfterReview(', 'visible'],
  ['reply', replySource, 'openJob', 'function openTaskDetail(', 'dialogVisible'],
])('%s detail requests', (_kind, source, name, end, visibleName) => {
  function setup() {
    const get = vi.fn()
    const notifyError = vi.fn()
    const state: Record<string, any> = { http: { get }, getCommentReply: get, notifyError, watch }
    for (const key of ['selected', 'content', 'mediaUrls', 'imageUrlInput', 'regenerationError', 'visible',
      'activeJob', 'editedContent', 'dialogVisible']) state[key] = ref(key === visibleName ? false : null)
    const start = source.indexOf(`async function ${name}(`)
    const watchLine = source.split('\n').find(line => line.startsWith(`watch(${visibleName},`))!
    const code = `let detailRequest = 0; let disposed = false; ${watchLine}\n`
      + source.slice(start, source.indexOf(end, start))
      + `; return { open: ${name}, dispose: () => { disposed = true } };`
    const functions = new Function(...Object.keys(state), transpile(code, { target: ScriptTarget.ES2022 }))(...Object.values(state))
    return { ...state, ...functions, get, notifyError, shown: state[visibleName],
      job: state[_kind === 'post' ? 'selected' : 'activeJob'] }
  }

  it('ignores older responses and keeps the latest selected draft', async () => {
    const s = setup()
    let resolve!: (value: unknown) => void
    s.get.mockImplementationOnce(() => new Promise(done => { resolve = done }))
      .mockResolvedValueOnce({ id: 'B', final_content: 'B draft', final_media_urls: ['b.jpg'] })
    const pending = s.open({ id: 'A' })
    await s.open({ id: 'B' })
    resolve({ id: 'A', final_content: 'A draft', final_media_urls: ['a.jpg'] })
    await pending
    expect(s.job.value.id).toBe('B')
    expect((_kind === 'post' ? s.content : s.editedContent).value).toBe('B draft')
    expect(s.shown.value).toBe(true)
  })

  it.each(['close', 'dispose'])('ignores a response after %s', async action => {
    const s = setup()
    s.shown.value = true
    let resolve!: (value: unknown) => void
    s.get.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const pending = s.open({ id: 'A' })
    if (action === 'close') s.shown.value = false
    else s.dispose()
    resolve({ id: 'A', final_content: 'late' })
    await pending
    expect(s.job.value).toBeNull()
    if (action === 'close') expect(s.shown.value).toBe(false)
  })

  it('suppresses superseded errors but reports the current request failure', async () => {
    const s = setup()
    let reject!: (error: Error) => void
    s.get.mockImplementationOnce(() => new Promise((_done, fail) => { reject = fail }))
      .mockResolvedValueOnce({ id: 'B', final_content: 'B' })
    const pending = s.open({ id: 'A' })
    await s.open({ id: 'B' })
    reject(new Error('old failure'))
    await pending
    expect(s.notifyError).not.toHaveBeenCalled()
    s.get.mockRejectedValueOnce(new Error('current failure'))
    await s.open({ id: 'C' })
    expect(s.notifyError).toHaveBeenCalledOnce()
  })
})
