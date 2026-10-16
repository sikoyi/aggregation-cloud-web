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
