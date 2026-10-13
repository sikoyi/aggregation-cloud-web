import { effectScope, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPendingPostReviewCount, POST_REVIEW_REFRESH_EVENT } from '@/api/benchmarkPostReviews'
import { usePendingPostReviewCount } from './usePendingPostReviewCount'

vi.mock('@/api/benchmarkPostReviews', () => ({
  getPendingPostReviewCount: vi.fn(), POST_REVIEW_REFRESH_EVENT: 'aggregation:post-review-refresh',
}))

const scopes: ReturnType<typeof effectScope>[] = []
let page: EventTarget & { hidden: boolean }
function mount(key = 'operator') {
  const session = ref(key)
  const scope = effectScope()
  scopes.push(scope)
  const state = scope.run(() => usePendingPostReviewCount(() => session.value))!
  return { ...state, session, scope }
}
function deferred() {
  let resolve!: (value: number) => void
  const promise = new Promise<number>(done => { resolve = done })
  return { promise, resolve }
}
async function settle() { await Promise.resolve(); await Promise.resolve() }
function refresh() { window.dispatchEvent(new Event(POST_REVIEW_REFRESH_EVENT)) }

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers()
  page = Object.assign(new EventTarget(), { hidden: false })
  vi.stubGlobal('document', page)
  vi.stubGlobal('window', new EventTarget())
  vi.mocked(getPendingPostReviewCount).mockResolvedValue(5)
})
afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop())
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('帖子审核菜单计数', () => {
  it('没有登录或权限时不请求，权限就绪后获取数量', async () => {
    const state = mount('')
    await vi.advanceTimersByTimeAsync(30_000)
    expect(getPendingPostReviewCount).not.toHaveBeenCalled()
    state.session.value = 'operator'
    await settle()
    expect(state.count.value).toBe(5)
  })
  it.each([0, 1, 99, 100, 12345])('保存真实数量 %i，由菜单角标限制显示', async total => {
    vi.mocked(getPendingPostReviewCount).mockResolvedValue(total)
    const state = mount()
    await settle()
    expect(state.count.value).toBe(total)
  })
  it('审核刷新立即更新，重复刷新合并为一个后续请求', async () => {
    const first = deferred()
    vi.mocked(getPendingPostReviewCount).mockReturnValueOnce(first.promise).mockResolvedValue(2)
    const state = mount()
    refresh(); refresh(); refresh()
    expect(getPendingPostReviewCount).toHaveBeenCalledTimes(1)
    first.resolve(8)
    await settle()
    expect(getPendingPostReviewCount).toHaveBeenCalledTimes(2)
    expect(state.count.value).toBe(2)
  })
  it('请求失败不清空已知数量，下一轮重试恢复', async () => {
    const state = mount()
    await settle()
    vi.mocked(getPendingPostReviewCount).mockRejectedValueOnce(new Error('offline'))
    refresh()
    await settle()
    expect(state.count.value).toBe(5)
    vi.mocked(getPendingPostReviewCount).mockResolvedValue(0)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(state.count.value).toBe(0)
  })
  it('隐藏页面暂停轮询，返回后刷新', async () => {
    const state = mount()
    await settle()
    page.hidden = true
    await vi.advanceTimersByTimeAsync(60_000)
    expect(getPendingPostReviewCount).toHaveBeenCalledTimes(1)
    page.hidden = false
    vi.mocked(getPendingPostReviewCount).mockResolvedValue(9)
    page.dispatchEvent(new Event('visibilitychange'))
    await settle()
    expect(state.count.value).toBe(9)
  })
  it('切换账号后旧响应不能覆盖新账号数量', async () => {
    const old = deferred()
    vi.mocked(getPendingPostReviewCount).mockReturnValueOnce(old.promise).mockResolvedValue(3)
    const state = mount()
    const signal = vi.mocked(getPendingPostReviewCount).mock.calls[0][0]
    state.session.value = 'another-operator'
    await settle()
    old.resolve(100)
    await settle()
    expect(signal.aborted).toBe(true)
    expect(state.count.value).toBe(3)
  })
  it('退出或失去权限后清空且不再请求', async () => {
    const state = mount()
    await settle()
    state.session.value = ''
    refresh()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(state.count.value).toBe(0)
    expect(getPendingPostReviewCount).toHaveBeenCalledTimes(1)
  })
  it('卸载时停止计时和监听并取消请求', async () => {
    const pending = deferred()
    vi.mocked(getPendingPostReviewCount).mockReturnValue(pending.promise)
    const state = mount()
    const signal = vi.mocked(getPendingPostReviewCount).mock.calls[0][0]
    state.scope.stop()
    pending.resolve(8)
    refresh()
    page.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(60_000)
    expect(signal.aborted).toBe(true)
    expect(getPendingPostReviewCount).toHaveBeenCalledTimes(1)
    expect(state.count.value).toBe(0)
  })
  it('慢请求超时取消，不应用迟到响应', async () => {
    const pending = deferred()
    vi.mocked(getPendingPostReviewCount).mockReturnValue(pending.promise)
    const state = mount()
    const signal = vi.mocked(getPendingPostReviewCount).mock.calls[0][0]
    await vi.advanceTimersByTimeAsync(15_000)
    expect(signal.aborted).toBe(true)
    pending.resolve(100)
    await settle()
    expect(state.count.value).toBe(0)
  })
})
