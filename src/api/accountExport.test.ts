import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, http } from '@/api/http'
import { accountExportStateLabel, readAccountExportReceipt, submitAccountExport } from './accountExport'

vi.mock('@/api/http', async importOriginal => {
  const actual = await importOriginal<typeof import('@/api/http')>()
  return { ...actual, http: { postFile: vi.fn() } }
})
beforeEach(() => vi.resetAllMocks())
describe('账号导出确认回执', () => {
  const payload = { source: 'identities' as const, ids: ['1'], business_platforms: ['shopify'] }
  const receipt = { export_record_id: 'record-1', state: 'confirming', committed: true }
  it('409仅在服务端明确本地已提交且带ID时转为确认状态', async () => {
    vi.mocked(http.postFile).mockRejectedValue(new ApiError('确认中', 409, 40900, receipt))
    expect(await submitAccountExport(payload)).toEqual({ receipt })
    expect(http.postFile).toHaveBeenCalledExactlyOnceWith('/api/accounts/export', payload)
  })
  it.each([null, { ...receipt, committed: false }, { ...receipt, state: 'failed' }, { ...receipt, export_record_id: '' }])('不把未知响应视为已提交 %j', data => {
    expect(readAccountExportReceipt(new ApiError('failed', 409, 40900, data))).toBeNull()
  })
  it('保留明确的格式和业务错误', async () => {
    const error = new ApiError('邮箱资料不足', 409)
    vi.mocked(http.postFile).mockRejectedValue(error)
    await expect(submitAccountExport(payload)).rejects.toBe(error)
  })
  it('兼容既有附件下载成功', async () => {
    const file = { blob: new Blob(['synthetic']), filename: 'original.txt' }
    vi.mocked(http.postFile).mockResolvedValue(file)
    expect(await submitAccountExport(payload)).toEqual({ file })
  })
  it('状态文案区分确认、过期与待核对', () => {
    expect(accountExportStateLabel({ pending: true })).toBe('邮箱确认中')
    expect(accountExportStateLabel({ expired: true, pending: true })).toBe('已过期')
    expect(accountExportStateLabel({ state: 'needs_attention' })).toBe('待人工核对')
    expect(accountExportStateLabel({ state: 'ready' })).toBe('可下载')
  })
})
