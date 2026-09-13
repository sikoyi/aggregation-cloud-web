import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getBindingConflicts, type BindingConflict, type BindingConflictTarget } from '@/api/bindingConflicts'
import { useBindingConflicts } from './useBindingConflicts'

vi.mock('@/api/bindingConflicts', () => ({ getBindingConflicts: vi.fn() }))
const scopes: EffectScope[] = []
const result = { items: [{ id: 'conflict-1' } as BindingConflict] }
function setup() {
  const target = ref<BindingConflictTarget | null>(null)
  const scope = effectScope()
  scopes.push(scope)
  return { target, scope, viewer: scope.run(() => useBindingConflicts(() => target.value))! }
}
async function flush() { await nextTick(); await Promise.resolve(); await nextTick() }

describe('冲突弹窗加载生命周期', () => {
  beforeEach(() => vi.mocked(getBindingConflicts).mockReset().mockResolvedValue(result))
  afterEach(() => scopes.splice(0).forEach(scope => scope.stop()))

  it('关闭时不请求，打开后展示记录，刷新支持空列表', async () => {
    const { target, viewer } = setup()
    expect(getBindingConflicts).not.toHaveBeenCalled()
    target.value = { source: 'accounts', id: '1' }
    await flush()
    expect(viewer.rows.value).toEqual(result.items)
    vi.mocked(getBindingConflicts).mockResolvedValueOnce({ items: [] })
    await viewer.reload()
    expect(viewer.rows.value).toEqual([])
    expect(viewer.error.value).toBe('')
  })

  it('请求失败清除旧内容并可以重试', async () => {
    const { target, viewer } = setup()
    target.value = { source: 'accounts', id: '1' }
    await flush()
    vi.mocked(getBindingConflicts).mockRejectedValueOnce(new Error('禁止访问'))
    await viewer.reload()
    expect(viewer.rows.value).toEqual([])
    expect(viewer.error.value).toBe('禁止访问')
    expect(viewer.loading.value).toBe(false)
    await viewer.reload()
    expect(viewer.error.value).toBe('')
    expect(viewer.rows.value).toEqual(result.items)
  })

  it('切换账号、关闭和卸载会取消旧请求，迟到响应不能覆盖新内容', async () => {
    let resolve!: (value: typeof result) => void
    vi.mocked(getBindingConflicts).mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const { target, viewer, scope } = setup()
    target.value = { source: 'accounts', id: 'old' }
    await nextTick()
    const oldSignal = vi.mocked(getBindingConflicts).mock.calls[0][1]
    target.value = { source: 'execution-slots', id: 'new' }
    await flush()
    expect(oldSignal.aborted).toBe(true)
    resolve({ items: [{ id: 'stale' } as BindingConflict] })
    await flush()
    expect(viewer.rows.value).toEqual(result.items)
    target.value = null
    await flush()
    expect(viewer.rows.value).toEqual([])
    expect(viewer.loading.value).toBe(false)
    target.value = { source: 'accounts', id: 'next' }
    await flush()
    const calls = vi.mocked(getBindingConflicts).mock.calls
    const signal = calls[calls.length - 1][1]
    scope.stop()
    expect(signal.aborted).toBe(true)
  })
})
