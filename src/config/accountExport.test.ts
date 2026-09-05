import { describe, expect, it } from 'vitest'

import { resources } from '@/config/resources'
import { buildAccountIdentityResource } from '@/config/accountIdentityResource'

describe('账号导出入口', () => {
  it.each([
    ['accounts', resources.accounts],
    ['identities', buildAccountIdentityResource(resources.accounts)],
  ] as const)('将 %s 的跨页选择提交为 ID，凭据由服务端读取', (source, config) => {
    const action = config.batchActions?.find((item) => item.key === 'export-accounts')
    expect(action?.permission).toBe('accounts.view')
    expect(action?.clientAction).toBe('download')
    expect(action?.selectionLimit).toBe(1000)
    const records = [{ id: '1', password: 'stale' }, { id: '2' }]
    expect(action?.batchPath?.(records)).toBe('/api/accounts/export')
    expect(action?.batchBody?.({}, records)).toEqual({ source, ids: ['1', '2'] })
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
