import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '@/api/http'
import { useBenchmarkCollection } from './useBenchmarkCollection'

vi.mock('@/api/http', () => ({ http: { get: vi.fn() }, ApiError: class extends Error {} }))
const scopes: EffectScope[] = []
const data = (status = 'running') => ({ enabled: true, source_username: 'source', collection_run: { status, phase: 'posts' } })
function setup(open = true) {
  const id = ref('1')
  const visible = ref(open)
  const scope = effectScope()
  scopes.push(scope)
  const state = scope.run(() => useBenchmarkCollection(() => id.value, () => visible.value))!
  return { id, visible, scope, state }
}
async function flush() { await Promise.resolve(); await nextTick() }

describe('对标采集状态刷新', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.mocked(http.get).mockReset().mockResolvedValue(data()) })
  afterEach(() => { scopes.splice(0).forEach(s => s.stop()); vi.useRealTimers() })
  it('可见时只读轮询，成功后停止', async () => {
    const { visible, state } = setup(false)
    expect(http.get).not.toHaveBeenCalled()
    visible.value = true
    await flush()
    expect(state.tracker.value?.source_username).toBe('source')
    vi.mocked(http.get).mockResolvedValue(data('succeeded'))
    await vi.advanceTimersByTimeAsync(5000)
    expect(http.get).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(10000)
    expect(http.get).toHaveBeenCalledTimes(2)
  })
  it('慢请求不重叠，切换账号丢弃旧响应', async () => {
    let resolve!: (value: unknown) => void
    vi.mocked(http.get).mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const { id, state } = setup()
    await vi.advanceTimersByTimeAsync(10000)
    expect(http.get).toHaveBeenCalledTimes(1)
    id.value = '2'
    await flush()
    resolve({ source_username: 'old' })
    await flush()
    expect(state.tracker.value?.source_username).toBe('source')
    expect(http.get).toHaveBeenLastCalledWith('/api/benchmark-trackers/accounts/2')
  })
  it('关闭或卸载后不再刷新', async () => {
    const { visible, scope } = setup()
    await flush()
    visible.value = false
    await vi.advanceTimersByTimeAsync(10000)
    expect(http.get).toHaveBeenCalledTimes(1)
    visible.value = true
    await flush()
    scope.stop()
    await vi.advanceTimersByTimeAsync(10000)
    expect(http.get).toHaveBeenCalledTimes(2)
  })
  it('读取失败保留资料并显示错误，下次恢复', async () => {
    const { state } = setup()
    await flush()
    vi.mocked(http.get).mockRejectedValueOnce(new Error('network error'))
    await vi.advanceTimersByTimeAsync(5000)
    expect(state.tracker.value?.source_username).toBe('source')
    expect(state.error.value).toBe('network error')
    await vi.advanceTimersByTimeAsync(5000)
    expect(state.error.value).toBe('')
  })
})
