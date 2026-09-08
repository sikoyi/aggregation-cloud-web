import { describe, expect, it } from 'vitest'

import { resources } from '@/config/resources'
import { buildAccountIdentityResource } from '@/config/accountIdentityResource'
import { accountExportAction } from '@/config/accountExport'

describe('账号导出入口', () => {
  it.each([
    ['accounts', resources.accounts],
    ['identities', buildAccountIdentityResource(resources.accounts)],
  ] as const)('将 %s 的跨页选择提交为 ID，凭据由服务端读取', (source, config) => {
    const action = config.batchActions?.find((item) => item.key === 'export-accounts')
    expect(action?.permission).toBe('accounts.export')
    expect(action?.clientAction).toBe('download')
    expect(action?.selectionLimit).toBe(1000)
    const records = ['1', '2'].map((id) => ({
      id, password: 'stale', business_platform: 'shopify',
      platform_summaries: [{ account_id: `account-${id}`, business_platform: 'shopify' }],
    }))
    expect(action?.batchPath?.(records)).toBe('/api/accounts/export')
    expect(action?.batchBody?.({ business_platforms: ['shopify'] }, records))
      .toEqual({ source, ids: ['1', '2'], business_platforms: ['shopify'] })
    expect(action?.batchFields?.(records)[0]?.defaultValue).toEqual(['shopify'])
  })

  it('仅列出所选身份已加载的可访问平台，多平台必须选择并去重提交', () => {
    const action = accountExportAction('identities')
    const records = [{ id: '1', platform_summaries: [
      { account_id: 't1', business_platform: 'threads' },
      { account_id: 'i1', business_platform: 'instagram' },
      { account_id: 't1', business_platform: 'threads' },
      { account_id: null, business_platform: 'x' },
    ] }]
    const fields = action.batchFields!(records)
    expect(fields[0]?.options?.map((option) => option.value)).toEqual(['threads', 'instagram'])
    expect(fields[0]?.defaultValue).toEqual([])
    expect(action.batchBody!({ business_platforms: ['instagram', 'threads', 'instagram'] }, records))
      .toEqual({ source: 'identities', ids: ['1'], business_platforms: ['instagram', 'threads'] })
    expect(() => action.batchBody!({}, records)).toThrow('请选择')
    expect(() => action.batchBody!({ business_platforms: [] }, records)).toThrow('请选择')
    expect(() => action.batchBody!({ business_platforms: ['x'] }, records)).toThrow('不在当前账号范围')
    expect(action.confirm).toContain('全部关联平台')
    expect(action.refresh).toBe(true)
  })

  it('跨页所选身份缺少匹配平台时拒绝整批导出', () => {
    const action = accountExportAction('identities')
    const records = [
      { id: '1', platform_summaries: [{ account_id: 't1', business_platform: 'threads' }] },
      { id: '2', platform_summaries: [{ account_id: 's1', business_platform: 'shopify' }] },
    ]
    expect(() => action.batchBody!({ business_platforms: ['threads'] }, records)).toThrow('有 1 项没有对应平台账号')
    expect(action.batchBody!({ business_platforms: ['threads', 'shopify'] }, records))
      .toEqual({ source: 'identities', ids: ['1', '2'], business_platforms: ['threads', 'shopify'] })
    expect(action.batchFields!([{ id: 'missing' }])[0]?.options).toEqual([])
  })

  it.each([
    resources.accounts,
    buildAccountIdentityResource(resources.accounts),
  ])('已导出记录在提交前明确拒绝重复导出', (config) => {
    const action = config.batchActions?.find((item) => item.key === 'export-accounts')

    expect(() => action?.batchBody?.({}, [
      { id: '1' },
      { id: '2', credentials_exported_at: '2026-09-05T08:00:00Z' },
    ])).toThrow('有 1 个登录身份已导出')
  })

  it('已导出账号不显示单个上号入口，批量上号也会在提交前拒绝', () => {
    const rowAction = resources.accounts.rowActions?.find((item) => item.key === 'account-onboarding')
    const batchAction = resources.accounts.batchActions?.find((item) => item.key === 'batch-account-onboarding')
    const exported = {
      id: '1',
      business_platform: 'threads',
      login_status: 'not_logged_in',
      credentials_exported_at: '2026-09-05T08:00:00Z',
    }

    expect(rowAction?.visible?.(exported)).toBe(false)
    expect(() => batchAction?.batchBody?.({}, [exported])).toThrow('已导出，不能再次上号')
  })
})
