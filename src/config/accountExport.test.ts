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
})
