import { effectScope, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/http'
import { downloadAccountExport, getAccountExportStatus, preflightAccountExport, submitAccountExport, type AccountExportPreflight } from '@/api/accountExport'
import { saveDownload } from '@/utils/download'
import { useAccountExportPreflight } from './useAccountExportPreflight'

vi.mock('@/api/accountExport', () => ({
  downloadAccountExport: vi.fn(), getAccountExportStatus: vi.fn(), preflightAccountExport: vi.fn(), submitAccountExport: vi.fn(),
}))
vi.mock('@/utils/download', () => ({ saveDownload: vi.fn() }))

function report(email = false): AccountExportPreflight {
  return { checked_at: '2026-09-07T00:00:00Z', source: 'identities', file_format: email ? 'xlsx' : 'txt',
    selected_count: 1, local_eligible_count: 1, blocked_count: 0, unverified_count: email ? 1 : 0,
    file_row_count: 1, can_submit: true, fully_verified: !email, email_check: email ? 'unverified' : 'not_required',
    limitations: email ? ['邮箱未验证'] : [], items: [] }
}
const scopes: ReturnType<typeof effectScope>[] = []
function editor() {
  const scope = effectScope(); scopes.push(scope)
  const allowed = ref(true)
  const records = ref([{ id: '1', credentials_exported_at: 'stale', platform_summaries: [{ account_id: '10', business_platform: 'threads' }] }])
  const committed = vi.fn()
  const state = scope.run(() => useAccountExportPreflight(() => ({ source: 'identities', records: records.value }), () => allowed.value, committed))!
  return { state, scope, allowed, records, committed }
}
async function ready(state: ReturnType<typeof editor>['state'], email = false) {
  vi.mocked(preflightAccountExport).mockResolvedValueOnce(report(email))
  await state.check()
  state.acknowledgeLock.value = true
  if (email) state.acknowledgeEmail.value = true
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
const pendingReceipt = { export_record_id: 'original-record', state: 'confirming', committed: true } as const
const pendingStatus = { id: 'original-record', state: 'confirming', pending: true, expired: false,
  download_available: false, recovery_overdue: false, filename: 'original.xlsx', row_count: 1,
  created_at: '2026-09-07T00:00:00Z', expires_at: '2026-10-07T00:00:00Z' } as const
beforeEach(() => { vi.resetAllMocks(); vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }) })
afterEach(() => { scopes.splice(0).forEach(scope => scope.stop()); vi.useRealTimers() })

describe('只读导出预检 hook', () => {
  it('只传ID与平台，不以缓存已导出标记截断服务端整批报告', async () => {
    const { state } = editor()
    await ready(state)
    expect(preflightAccountExport).toHaveBeenCalledExactlyOnceWith({ source: 'identities', ids: ['1'], business_platforms: ['threads'] })
    expect(submitAccountExport).not.toHaveBeenCalled()
    expect(state.canSubmit.value).toBe(true)
  })
  it('阻断报告保持完整且不能提交', async () => {
    const { state } = editor()
    vi.mocked(preflightAccountExport).mockResolvedValue({ ...report(), can_submit: false, blocked_count: 1, local_eligible_count: 0 })
    await state.check(); state.acknowledgeLock.value = true
    expect(await state.submit()).toBe(false)
    expect(state.result.value?.blocked_count).toBe(1)
    expect(submitAccountExport).not.toHaveBeenCalled()
  })
  it('Shopify必须分别确认身份锁与邮箱未验证限制', async () => {
    const { state } = editor()
    vi.mocked(preflightAccountExport).mockResolvedValue(report(true))
    await state.check()
    expect(state.canSubmit.value).toBe(false)
    state.acknowledgeLock.value = true
    expect(state.canSubmit.value).toBe(false)
    state.acknowledgeEmail.value = true
    expect(state.canSubmit.value).toBe(true)
  })
  it('变更平台或选择使预检及确认失效', async () => {
    const { state, records } = editor()
    await ready(state)
    state.platforms.value = ['instagram']
    expect(state.result.value).toBeNull()
    expect(state.acknowledgeLock.value).toBe(false)
    await ready(state)
    records.value = []
    expect(state.result.value).toBeNull()
    expect(state.canSubmit.value).toBe(false)
  })
  it('不会让迟到预检覆盖新选择', async () => {
    const { state, records } = editor()
    const old = deferred<AccountExportPreflight>()
    vi.mocked(preflightAccountExport).mockReturnValueOnce(old.promise)
    const request = state.check()
    records.value = []
    old.resolve(report()); await request
    expect(state.result.value).toBeNull()
    expect(state.checking.value).toBe(false)
  })
  it('权限撤销禁用预检、提交和状态读取', async () => {
    const { state, allowed } = editor()
    await ready(state)
    allowed.value = false
    await state.check(); await state.submit(); await state.refreshStatus()
    expect(preflightAccountExport).toHaveBeenCalledTimes(1)
    expect(submitAccountExport).not.toHaveBeenCalled()
    expect(getAccountExportStatus).not.toHaveBeenCalled()
  })
  it('阻止重复正式提交，成功只保存一次下载', async () => {
    const { state, committed } = editor()
    await ready(state)
    const pending = deferred<Awaited<ReturnType<typeof submitAccountExport>>>()
    vi.mocked(submitAccountExport).mockReturnValueOnce(pending.promise)
    const first = state.submit()
    expect(await state.submit()).toBe(false)
    const file = { blob: new Blob(['synthetic']), filename: 'original.txt' }
    pending.resolve({ file }); await first
    expect(submitAccountExport).toHaveBeenCalledTimes(1)
    expect(saveDownload).toHaveBeenCalledExactlyOnceWith(file.blob, file.filename)
    expect(state.downloaded.value).toBe(true)
    expect(committed).toHaveBeenCalledTimes(1)
  })
  it('待确认回执保留ID，轮询原记录，完成后只下载原文件', async () => {
    const { state, committed } = editor()
    await ready(state, true)
    vi.mocked(submitAccountExport).mockResolvedValue({ receipt: pendingReceipt })
    vi.mocked(getAccountExportStatus).mockResolvedValue(pendingStatus)
    await state.submit()
    expect(state.receipt.value?.export_record_id).toBe('original-record')
    expect(state.canSubmit.value).toBe(false)
    await state.download()
    expect(downloadAccountExport).not.toHaveBeenCalled()
    vi.mocked(getAccountExportStatus).mockResolvedValue({ ...pendingStatus, state: 'ready', pending: false, download_available: true })
    await vi.advanceTimersByTimeAsync(5000)
    const file = { blob: new Blob(['exact original']), filename: 'original.xlsx' }
    vi.mocked(downloadAccountExport).mockResolvedValue(file)
    await state.download()
    expect(downloadAccountExport).toHaveBeenCalledExactlyOnceWith('original-record')
    expect(submitAccountExport).toHaveBeenCalledTimes(1)
    expect(saveDownload).toHaveBeenCalledExactlyOnceWith(file.blob, file.filename)
    expect(committed).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
  it.each([401, 403, 404, 410])('状态返回%s停止轮询，保留回执供核对', async status => {
    const { state } = editor(); await ready(state)
    vi.mocked(submitAccountExport).mockResolvedValue({ receipt: pendingReceipt })
    vi.mocked(getAccountExportStatus).mockRejectedValue(new ApiError('不可访问', status))
    await state.submit(); await vi.advanceTimersByTimeAsync(15000)
    expect(getAccountExportStatus).toHaveBeenCalledTimes(1)
    expect(state.receipt.value).toEqual(pendingReceipt)
  })
  it('409明确业务拒绝需重新预检，不宣称回滚', async () => {
    const { state } = editor(); await ready(state)
    vi.mocked(submitAccountExport).mockRejectedValue(new ApiError('账号仍有任务', 409))
    expect(await state.submit()).toBe(false)
    expect(state.result.value).toBeNull()
    expect(state.outcomeUnknown.value).toBe(false)
    expect(state.error.value).toBe('账号仍有任务')
  })
  it('网络响应不明确不能自动重发导出', async () => {
    const { state } = editor(); await ready(state)
    vi.mocked(submitAccountExport).mockRejectedValue(new TypeError('network lost'))
    await state.submit(); await state.submit(); await state.check()
    expect(state.outcomeUnknown.value).toBe(true)
    expect(state.error.value).toContain('先查看导出记录')
    expect(submitAccountExport).toHaveBeenCalledTimes(1)
    expect(preflightAccountExport).toHaveBeenCalledTimes(1)
  })
  it('卸载停止轮询和迟到回调', async () => {
    const { state, scope } = editor(); await ready(state)
    vi.mocked(submitAccountExport).mockResolvedValue({ receipt: pendingReceipt })
    vi.mocked(getAccountExportStatus).mockResolvedValue(pendingStatus)
    await state.submit(); scope.stop()
    await vi.advanceTimersByTimeAsync(15000)
    expect(getAccountExportStatus).toHaveBeenCalledTimes(1)
  })
})
