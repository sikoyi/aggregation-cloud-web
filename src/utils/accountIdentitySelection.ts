import { businessPlatformLabel } from '@/config/options'
import type { AnyRecord } from '@/types/api'

export function matchedPlatformSummaries(record: AnyRecord): AnyRecord[] {
  if (!Array.isArray(record.matched_account_ids) || !Array.isArray(record.platform_summaries)) return []
  const ids = new Set(record.matched_account_ids.map(String))
  return record.platform_summaries.filter((summary: AnyRecord) => ids.has(String(summary.account_id)))
}

export function selectedPlatformAccountIds(records: AnyRecord[]): string[] {
  if (records.some((record) => !Array.isArray(record.matched_account_ids) || !matchedPlatformSummaries(record).length)) {
    throw new Error('所选账号的匹配范围已失效，请刷新后重新选择')
  }
  return [...new Set(records.flatMap((record) => matchedPlatformSummaries(record).map((item) => String(item.account_id))))]
}

export function identitySelectionLabel(records: AnyRecord[]): string {
  const counts = new Map<string, Set<string>>()
  for (const record of records) {
    for (const item of matchedPlatformSummaries(record)) {
      const platform = String(item.business_platform)
      if (!counts.has(platform)) counts.set(platform, new Set())
      counts.get(platform)!.add(String(item.account_id))
    }
  }
  const count = [...counts.values()].reduce((total, ids) => total + ids.size, 0)
  const platforms = [...counts].map(([platform, ids]) => `${businessPlatformLabel(platform)} ${ids.size} 个`).join('、')
  return `${records.length} 个登录身份，本次影响 ${count} 个平台账号${platforms ? `（${platforms}）` : ''}`
}
