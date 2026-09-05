import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getAccountTotp } from '@/api/accountTotp'
import { ApiError } from '@/api/http'
import { useAccountTotp } from './useAccountTotp'

vi.mock('@/api/accountTotp', () => ({ getAccountTotp: vi.fn() }))
const result = (code = '001234', remaining = 30) => ({ code, server_time: 5000, expires_at: 5000 + remaining, period: 30 })
const scopes: EffectScope[] = []
let clock = 0
async function advance(ms: number) {
  clock += ms
  await vi.advanceTimersByTimeAsync(ms)
}
function setup() {
  const target = ref({ source: 'account-identities' as const, id: '1', revision: 1 })
  const scope = effectScope()
  scopes.push(scope)
  const viewer = scope.run(() => useAccountTotp(() => target.value, () => clock))!
  return { target, scope, viewer }
}
async function flush() { await Promise.resolve(); await nextTick() }

describe('单账号验证码', () => {
  beforeEach(() => {
    clock = 0
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    vi.mocked(getAccountTotp).mockReset().mockResolvedValue(result())
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
  })
  afterEach(() => {
    scopes.splice(0).forEach(scope => scope.stop())
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('默认不请求，重复打开不重复请求，采用服务端有效期而非电脑时间', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2035-01-01').getTime())
    const { viewer } = setup()
    expect(getAccountTotp).not.toHaveBeenCalled()
    viewer.setVisible(true)
    viewer.setVisible(true)
    await flush()
    expect(getAccountTotp).toHaveBeenCalledTimes(1)
    expect(viewer.seconds.value).toBe(30)
    expect(viewer.code.value).toBe('001234')
    await advance(5000)
    expect(viewer.seconds.value).toBe(25)
    expect(getAccountTotp).toHaveBeenCalledTimes(1)
  })

  it('到期自动刷新且不显示旧验证码', async () => {
    vi.mocked(getAccountTotp).mockResolvedValueOnce(result('001234', 1))
    let resolve!: (value: ReturnType<typeof result>) => void
    vi.mocked(getAccountTotp).mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const { viewer } = setup()
    viewer.setVisible(true)
    await flush()
    await advance(1000)
    expect(getAccountTotp).toHaveBeenCalledTimes(2)
    expect(viewer.code.value).toBe('')
    expect(viewer.loading.value).toBe(true)
    expect(await viewer.copy()).toBe(false)
    resolve(result('009876'))
    await flush()
    expect(viewer.code.value).toBe('009876')
  })

  it('关闭取消请求，迟到响应不能恢复验证码', async () => {
    let resolve!: (value: ReturnType<typeof result>) => void
    vi.mocked(getAccountTotp).mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const { viewer } = setup()
    viewer.setVisible(true)
    const signal = vi.mocked(getAccountTotp).mock.calls[0][2]
    viewer.setVisible(false)
    expect(signal.aborted).toBe(true)
    resolve(result())
    await flush()
    expect(viewer.code.value).toBe('')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('打开另一个账号只保留一个浮层', async () => {
    const a = setup().viewer
    const b = setup().viewer
    a.setVisible(true)
    await flush()
    b.setVisible(true)
    await flush()
    expect(a.visible.value).toBe(false)
    expect(a.code.value).toBe('')
    expect(b.visible.value).toBe(true)
    expect(vi.getTimerCount()).toBe(1)
  })

  it('账号或凭据版本改变关闭浮层，卸载清理', async () => {
    const { viewer, target, scope } = setup()
    viewer.setVisible(true)
    await flush()
    target.value.revision++
    await flush()
    expect(viewer.visible.value).toBe(false)
    viewer.setVisible(true)
    await flush()
    scope.stop()
    expect(viewer.code.value).toBe('')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('页面隐藏清理验证码，恢复重新请求', async () => {
    const { viewer } = setup()
    viewer.setVisible(true)
    await flush()
    viewer.setSuspended(true)
    await advance(60000)
    expect(viewer.code.value).toBe('')
    expect(getAccountTotp).toHaveBeenCalledTimes(1)
    viewer.setSuspended(false)
    await flush()
    expect(getAccountTotp).toHaveBeenCalledTimes(2)
  })

  it('网络失败停止刷新，允许手动重试', async () => {
    vi.mocked(getAccountTotp).mockRejectedValueOnce(new Error('Failed to fetch'))
    const { viewer } = setup()
    viewer.setVisible(true)
    await flush()
    expect(viewer.error.value).toContain('检查网络')
    await advance(60000)
    expect(getAccountTotp).toHaveBeenCalledTimes(1)
    await viewer.refresh()
    expect(viewer.code.value).toBe('001234')
    expect(viewer.error.value).toBe('')
  })

  it.each([403, 409, 422])('权限和密钥错误使用服务端中文信息 %s', async (status) => {
    vi.mocked(getAccountTotp).mockRejectedValueOnce(new ApiError('中文错误', status))
    const { viewer } = setup()
    viewer.setVisible(true)
    await flush()
    expect(viewer.error.value).toBe('中文错误')
    expect(viewer.code.value).toBe('')
  })

  it('请求超时取消且不无限重试', async () => {
    vi.mocked(getAccountTotp).mockImplementationOnce((_source, _id, signal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')))
    }))
    const { viewer } = setup()
    viewer.setVisible(true)
    await advance(10000)
    expect(viewer.loading.value).toBe(false)
    expect(viewer.error.value).toContain('获取验证码失败')
    expect(getAccountTotp).toHaveBeenCalledTimes(1)
  })

  it('扣除慢请求耗时，拒绝到达时已过期的响应', async () => {
    vi.mocked(getAccountTotp).mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve(result('001234', 1)), 2000)))
    const { viewer } = setup()
    viewer.setVisible(true)
    await advance(2000)
    expect(viewer.code.value).toBe('')
    expect(viewer.error.value).toContain('过期')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('复制纯数字保留前导零，关闭后不可复制', async () => {
    const { viewer } = setup()
    viewer.setVisible(true)
    await flush()
    expect(await viewer.copy()).toBe(true)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('001234')
    viewer.setVisible(false)
    expect(await viewer.copy()).toBe(false)
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1)
  })

  it('复制失败交由界面显示，不清除可手动复制的验证码', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error('Denied'))
    const { viewer } = setup()
    viewer.setVisible(true)
    await flush()
    await expect(viewer.copy()).rejects.toThrow('Denied')
    expect(viewer.code.value).toBe('001234')
  })

  it('即使定时器还没运行，复制也重新检查实际过期时间', async () => {
    const { viewer } = setup()
    viewer.setVisible(true)
    await flush()
    clock = 30001
    expect(await viewer.copy()).toBe(false)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('快速关闭再打开，上一轮响应不能覆盖新结果', async () => {
    let resolve!: (value: ReturnType<typeof result>) => void
    vi.mocked(getAccountTotp).mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const { viewer } = setup()
    viewer.setVisible(true)
    viewer.setVisible(false)
    viewer.setVisible(true)
    await flush()
    resolve(result('999999'))
    await flush()
    expect(viewer.code.value).toBe('001234')
  })
})
