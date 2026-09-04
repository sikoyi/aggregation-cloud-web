import { describe, expect, it } from 'vitest'

import { buildAccountIdentityResource } from '@/config/accountIdentityResource'
import { resources } from '@/config/resources'

describe('account identity resource', () => {
  it('keeps account import but removes platform-account batch mutations', () => {
    const config = buildAccountIdentityResource(resources.accounts)

    expect(config.endpoint).toBe('/api/account-identities')
    expect(config.createEndpoint).toBe('/api/accounts/import')
    expect(config.createFields).toBe(resources.accounts.createFields)
    expect(config.expandRow).toBe('accountIdentity')
    expect(config.updateFields).toBeUndefined()
    expect(config.batchActions).toBeUndefined()
    expect(config.deleteLabel).toBeUndefined()
  })

  it('provides platform-specific health, login, binding, group, and candidate filters', () => {
    const config = buildAccountIdentityResource(resources.accounts)

    expect(config.filters?.map((item) => item.key)).toEqual([
      'keyword',
      'business_platform',
      'platform_health_status',
      'session_login_status',
      'bound_state',
      'slot_group_id',
      'candidate_status',
    ])
  })
})
