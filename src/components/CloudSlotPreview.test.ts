import { computed, effectScope, nextTick, reactive, ref, watch } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { transpile } from 'typescript'
import source from './DynamicForm.vue?raw'
import remoteSource from './RemoteSelect.vue?raw'

const scopes: ReturnType<typeof effectScope>[] = []
afterEach(() => scopes.splice(0).forEach(scope => scope.stop()))
async function flush() { for (let i = 0; i < 12; i++) await nextTick() }
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function form() {
  const props = reactive({ fields: [{ key: 'slot_group_id' }],
    modelValue: { runtime_platform: 'cloud_phone', slot_group_id: '', business_platform: 'instagram', slot_ids: [] } as Record<string, any>,
    context: { selectedRows: [{ id: 'a' }, { id: 'b' }] } as Record<string, any> })
  const http = { get: vi.fn().mockResolvedValue([{ id: 's1' }, { id: 's2' }]) }
  const emit = vi.fn((_event, value) => { props.modelValue = value })
  const notifyError = vi.fn()
  let unmount!: () => void
  const scope = effectScope(); scopes.push(scope)
  const script = source.slice(source.indexOf('const templateLoading'), source.indexOf('async function updateTemplateValue'))
  const state = scope.run(() => new Function('props', 'ref', 'computed', 'watch', 'onBeforeUnmount', 'http', 'emit', 'notifyError',
    `${transpile(script)}; return { updateValue };`)(props, ref, computed, watch, (fn: () => void) => { unmount = fn }, http, emit, notifyError))!
  return { props, http, emit, notifyError, ...state, close: () => { unmount(); scope.stop() } }
}

describe('云手机预选请求边界', () => {
  it('一次分组变更只请求一次，回写及无关字段不重复请求', async () => {
    const s = form(); s.updateValue('slot_group_id', '75'); await flush()
    expect(s.http.get).toHaveBeenCalledTimes(1)
    expect(s.props.modelValue.slot_ids).toEqual(['s1', 's2'])
    s.updateValue('proxy_mode', 'none'); await flush()
    s.props.context.selectedRows = [{ id: 'a' }, { id: 'b' }]; await flush()
    expect(s.http.get).toHaveBeenCalledTimes(1)
  })
  it('手动选设备使慢预选失效，且不重新请求', async () => {
    const s = form(); const pending = deferred<any[]>(); s.http.get.mockReturnValue(pending.promise)
    s.updateValue('slot_group_id', '75'); await flush()
    s.updateValue('slot_ids', ['manual']); pending.resolve([{ id: 'old' }]); await flush()
    expect(s.props.modelValue.slot_ids).toEqual(['manual'])
    expect(s.http.get).toHaveBeenCalledTimes(1)
  })
  it('切换分组仅接受最新响应', async () => {
    const s = form(); const a = deferred<any[]>(); const b = deferred<any[]>()
    s.http.get.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise)
    s.updateValue('slot_group_id', '75'); await flush()
    s.updateValue('slot_group_id', '76'); await flush()
    b.resolve([{ id: 'new' }]); await flush(); a.resolve([{ id: 'old' }]); await flush()
    expect(s.props.modelValue.slot_ids).toEqual(['new'])
    expect(s.http.get).toHaveBeenCalledTimes(2)
  })
  it.each(['close', 'platform', 'clear'])('%s 后旧请求不回写', async action => {
    const s = form(); const pending = deferred<any[]>(); s.http.get.mockReturnValue(pending.promise)
    s.updateValue('slot_group_id', '75'); await flush()
    if (action === 'close') s.close()
    else s.updateValue(action === 'platform' ? 'runtime_platform' : 'slot_group_id', action === 'platform' ? 'fingerprint' : '')
    await flush(); const count = s.emit.mock.calls.length
    pending.resolve([{ id: 'old' }]); await flush()
    expect(s.emit).toHaveBeenCalledTimes(count)
  })
  it('失败只提示一次，不因编辑无关字段无限重试', async () => {
    const s = form(); s.http.get.mockRejectedValue(new Error('offline'))
    s.updateValue('slot_group_id', '75'); await flush(); s.updateValue('proxy_mode', 'none'); await flush()
    expect(s.notifyError).toHaveBeenCalledTimes(1); expect(s.http.get).toHaveBeenCalledTimes(1)
  })
  it('单账号也预选，重复设备结果不回写', async () => {
    const s = form(); s.props.context = { id: 'a' }; s.props.modelValue.slot_ids = ['s1', 's2']
    s.props.modelValue.slot_group_id = '75'; await flush()
    expect(s.http.get).toHaveBeenCalledWith('/api/accounts/onboarding/cloud-slot-preview', { slot_group_id: '75', count: 1 })
    expect(s.emit).not.toHaveBeenCalled()
  })
  it('批量身份按业务平台去重计数，无匹配账号时不请求', async () => {
    const s = form()
    s.props.context = { selectedRows: [{ matched_account_ids: ['a', 'b', 'a'], platform_summaries: [
      { account_id: 'a', business_platform: 'instagram' },
      { account_id: 'a', business_platform: 'instagram' },
      { account_id: 'b', business_platform: 'threads' },
    ] }] }
    s.updateValue('slot_group_id', '75'); await flush()
    expect(s.http.get).toHaveBeenLastCalledWith('/api/accounts/onboarding/cloud-slot-preview', { slot_group_id: '75', count: 1 })
    s.updateValue('business_platform', 'x'); await flush()
    expect(s.http.get).toHaveBeenCalledTimes(1)
  })
})

describe('设备选项请求复用', () => {
  function loader() {
    const fetchOptions = vi.fn()
    const signature = ref('group-a')
    const script = remoteSource.slice(remoteSource.indexOf('let activeLoad:'), remoteSource.indexOf('async function fetchOptions'))
    const load = new Function('requestSignature', 'canLoad', 'selectedValues', 'fetchOptions',
      `${transpile(script)}; return loadOptions;`)(signature, ref(true), () => ['s1'], fetchOptions)
    return { load, fetchOptions, signature }
  }
  it('相同慢请求只执行一次，完成后允许再次加载', async () => {
    const s = loader(); const p = deferred<void>(); s.fetchOptions.mockReturnValue(p.promise)
    const a = s.load(); expect(s.load()).toBe(a); expect(s.fetchOptions).toHaveBeenCalledTimes(1)
    p.resolve(); await a; await s.load(); expect(s.fetchOptions).toHaveBeenCalledTimes(2)
  })
  it('A-B-A 切换不能复用已过期的 A，旧请求完成不能清掉新请求', async () => {
    const s = loader(); const a = deferred<void>(); const b = deferred<void>(); const c = deferred<void>()
    s.fetchOptions.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise).mockReturnValueOnce(c.promise)
    const first = s.load(); s.signature.value = 'group-b'; const second = s.load()
    s.signature.value = 'group-a'; const third = s.load(); a.resolve(); await first
    expect(s.load()).toBe(third); expect(s.fetchOptions).toHaveBeenCalledTimes(3)
    b.resolve(); c.resolve(); await Promise.all([second, third])
  })
  it('失败后允许显式重试', async () => {
    const s = loader(); s.fetchOptions.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined)
    await expect(s.load()).rejects.toThrow('offline'); await s.load()
    expect(s.fetchOptions).toHaveBeenCalledTimes(2)
  })
})
