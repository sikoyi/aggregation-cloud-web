import type { AnyRecord } from '@/types/api'

export function accountGroupKey(account: AnyRecord | null | undefined): string {
  if (!account) return ''
  return String(account.group_key || (account.login_identity_id
    ? `identity:${account.login_identity_id}` : `account:${account.account_id}`))
}

export function accountPlatforms(account: AnyRecord): AnyRecord[] {
  return Array.isArray(account.platform_accounts) && account.platform_accounts.length
    ? account.platform_accounts : [account]
}

export function accountOverviewRows(groups: AnyRecord[]): AnyRecord[] {
  return groups.map(group => {
    const platforms = accountPlatforms(group)
    if (platforms.length === 1) return { ...platforms[0], is_identity_group: false }
    return {
      ...group,
      is_identity_group: true,
      children: platforms.map(account => ({ ...account, is_identity_group: false })),
    }
  })
}

export function accountOverviewRowKey(account: AnyRecord): string {
  return account.is_identity_group ? accountGroupKey(account) : `platform:${account.account_id}`
}

export function updateExpandedAccountKeys(keys: string[], row: AnyRecord, expanded: boolean): string[] {
  if (!row.is_identity_group) return keys
  const key = accountOverviewRowKey(row)
  return expanded ? [...new Set([...keys, key])] : keys.filter(value => value !== key)
}

export function findPlatformAccount(groups: AnyRecord[], accountId: string): AnyRecord | undefined {
  return groups.flatMap(accountPlatforms).find(account => String(account.account_id) === accountId)
}

export function selectedPlatformAccounts(groups: AnyRecord[]): AnyRecord[] {
  return [...new Map(groups.flatMap(accountPlatforms).map(account => [String(account.account_id), account])).values()]
}

export function nextSelectedAccount(groups: AnyRecord[], previous: AnyRecord | null, focusedId = ''): AnyRecord | null {
  if (focusedId) return findPlatformAccount(groups, focusedId) || null
  const existing = findPlatformAccount(groups, String(previous?.account_id || ''))
  if (existing) return existing
  const group = groups.find(group => accountGroupKey(group) === accountGroupKey(previous)) || groups[0]
  return group ? accountPlatforms(group)[0] || null : null
}
