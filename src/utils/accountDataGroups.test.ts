import { describe, expect, it } from 'vitest'
import { accountGroupKey, accountOverviewRows, accountOverviewRowKey, accountPlatforms, findPlatformAccount, nextSelectedAccount, selectedPlatformAccounts, updateExpandedAccountKeys } from './accountDataGroups'

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
  it('多平台形成可折叠父子行，单平台直接展示，原始响应不变', () => {
    const before = JSON.stringify(groups)
    const result = accountOverviewRows(groups)
    expect(result).toHaveLength(2)
    expect(result[0]?.is_identity_group).toBe(true)
    expect(result[0]?.children).toEqual([
      { ...instagram, is_identity_group: false }, { ...threads, is_identity_group: false },
    ])
    expect(result[1]).toEqual({ ...other, is_identity_group: false })
    expect(accountOverviewRowKey(result[0]!)).toBe('identity:a')
    expect(accountOverviewRowKey((result[0]?.children as typeof result)[0]!)).toBe('platform:11')
    expect(JSON.stringify(groups)).toBe(before)
    expect(accountOverviewRows([])).toEqual([])
  })
  it('筛选只剩单个平台时不再展示父行和其他平台，保留匹配平台指标', () => {
    const [row] = accountOverviewRows([{ ...threads, platform_accounts: [threads] }])
    expect(row?.is_identity_group).toBe(false)
    expect(row?.children).toBeUndefined()
    expect(row?.account_id).toBe('12')
    expect(row?.followers_count).toBe(30)
    expect(accountOverviewRows([other])[0]?.children).toBeUndefined()
  })
  it('父子行勾选不重复下发，子行单独选择不会带入兄弟平台', () => {
    const [parent] = accountOverviewRows(groups)
    const children = parent?.children as typeof groups
    expect(selectedPlatformAccounts([parent!, ...children]).map(item => item.account_id)).toEqual(['11', '12'])
    expect(selectedPlatformAccounts([children[1]!]).map(item => item.account_id)).toEqual(['12'])
  })
  it('展开收起使用稳定身份键且不重复，叶子不产生展开状态', () => {
    const [parent, leaf] = accountOverviewRows(groups)
    const keys = updateExpandedAccountKeys([], parent!, true)
    expect(keys).toEqual(['identity:a'])
    expect(updateExpandedAccountKeys(keys, parent!, true)).toEqual(keys)
    expect(updateExpandedAccountKeys(keys, parent!, false)).toEqual([])
    expect(updateExpandedAccountKeys([], leaf!, true)).toEqual([])
  })
})
