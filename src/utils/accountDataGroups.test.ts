import { describe, expect, it } from 'vitest'
import { accountGroupKey, accountPlatforms, findPlatformAccount, nextSelectedAccount, selectedPlatformAccounts } from './accountDataGroups'

const instagram = { account_id: '11', login_identity_id: 'a', business_platform: 'instagram', followers_count: 20 }
const threads = { account_id: '12', login_identity_id: 'a', business_platform: 'threads', followers_count: 30 }
const other = { account_id: '13', login_identity_id: 'b', business_platform: 'threads', followers_count: 10 }
const groups = [{ ...instagram, group_key: 'identity:a', platform_accounts: [instagram, threads] }, other]

describe('账号数据身份分组', () => {
  it('使用权威身份，不把同名或无身份的账号误合并', () => {
    expect(accountGroupKey(instagram)).toBe(accountGroupKey(threads))
    expect(accountGroupKey(threads)).not.toBe(accountGroupKey(other))
    expect(accountGroupKey({ account_id: 'a', username: 'same' })).toBe('account:a')
    expect(accountGroupKey({ account_id: 'b', username: 'same' })).toBe('account:b')
    expect(accountGroupKey(null)).toBe('')
  })
  it('兼容旧的单平台响应，空列表不生成虚假账号', () => {
    expect(accountPlatforms(other)).toEqual([other])
    const legacy = { ...other, platform_accounts: [] }
    expect(accountPlatforms(legacy)).toEqual([legacy])
    expect(nextSelectedAccount([], null)).toBeNull()
    expect(nextSelectedAccount([], threads)).toBeNull()
  })
  it('精确定位非代表平台，刷新后保留当前平台，不混用指标', () => {
    expect(nextSelectedAccount(groups, null, '12')).toEqual(threads)
    expect(nextSelectedAccount(groups, threads)).toEqual(threads)
    expect(nextSelectedAccount(groups, threads)?.followers_count).toBe(30)
    expect(findPlatformAccount(groups, 'missing')).toBeUndefined()
    expect(nextSelectedAccount(groups, null, 'missing')).toBeNull()
  })
  it('筛选导致平台消失时选择同身份可见平台，身份消失时选择首项', () => {
    expect(nextSelectedAccount([instagram, other], threads)).toEqual(instagram)
    expect(nextSelectedAccount([other], threads)).toEqual(other)
    expect(nextSelectedAccount(groups, null)).toEqual(instagram)
  })
  it('勾选身份展开当前筛选可见平台并去重，不额外查找隐藏平台', () => {
    expect(selectedPlatformAccounts([groups[0]!])).toEqual([instagram, threads])
    expect(selectedPlatformAccounts([groups[0]!, threads])).toEqual([instagram, threads])
    expect(selectedPlatformAccounts([other])).toEqual([other])
    expect(selectedPlatformAccounts([])).toEqual([])
  })
})
