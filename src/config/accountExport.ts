import { businessPlatformOptions } from '@/config/options'
import type { AnyRecord } from '@/types/api'
import type { RowActionConfig } from '@/types/crud'

export type AccountExportSource = 'accounts' | 'identities'
export const ACCOUNT_EXPORT_PERMISSION = 'accounts.export'

export interface AccountExportPayload {
  source: AccountExportSource
  ids: string[]
  business_platforms: string[]
}

function recordPlatforms(record: AnyRecord, source: AccountExportSource): string[] {
  if (source === 'accounts') return [String(record.business_platform || '')].filter(Boolean)
  if (!Array.isArray(record.platform_summaries)) return []
  return record.platform_summaries
    .filter((item: AnyRecord) => item?.account_id && item.business_platform)
    .map((item: AnyRecord) => String(item.business_platform))
}

export function accountExportPlatformOptions(records: AnyRecord[], source: AccountExportSource) {
  const platforms = new Set(records.flatMap((record) => recordPlatforms(record, source)))
  return businessPlatformOptions.filter((option) => platforms.has(String(option.value)))
}

export function accountExportPreflightPayload(
  source: AccountExportSource, records: AnyRecord[], platforms: string[],
): AccountExportPayload {
  const ids = [...new Set(records.map(record => String(record.id ?? '').trim()))]
  if (!ids.length || ids.some(id => !id)) throw new Error('请选择要导出的账号或登录身份')
  if (ids.length > 1000) throw new Error('每次最多预检 1000 项')
  const business_platforms = [...new Set(platforms)]
  if (!business_platforms.length) throw new Error('请选择本次导出的业务平台')
  // Stale row flags must not suppress the server's complete, per-identity report.
  return { source, ids, business_platforms }
}

export function accountExportAction(source: 'accounts' | 'identities'): RowActionConfig {
  return {
    key: 'export-accounts',
    label: '导出账号',
    permission: ACCOUNT_EXPORT_PERMISSION,
    method: 'POST',
    icon: 'download',
    clientAction: 'download',
    submitLabel: '确认导出',
    confirm: '导出后，所选登录身份及其全部关联平台将标记为已导出，不能重复导出或再次上号。确认继续？',
    batchFields: (records) => {
      const options = accountExportPlatformOptions(records, source)
      return [{
        key: 'business_platforms', label: '业务平台', type: 'select', multiple: true, span: 2,
        options, required: true, placeholder: '请选择要导出的业务平台',
        defaultValue: options.length === 1 ? [options[0]!.value] : [],
      }]
    },
    batchPath: () => '/api/accounts/export',
    batchBody: (payload, records) => {
      const exported = records.filter((record) => Boolean(record.credentials_exported_at))
      if (exported.length) {
        throw new Error(`所选记录中有 ${exported.length} 个登录身份已导出，不能重复导出`)
      }
      const platforms = Array.isArray(payload.business_platforms)
        ? [...new Set(payload.business_platforms.map(String))] : []
      if (!platforms.length) throw new Error('请选择本次导出的业务平台')
      const available = new Set(records.flatMap((record) => recordPlatforms(record, source)))
      if (platforms.some((platform) => !available.has(platform))) {
        throw new Error('所选业务平台不在当前账号范围内，请重新选择')
      }
      const missing = records.filter((record) => !recordPlatforms(record, source).some((platform) => platforms.includes(platform)))
      if (missing.length) throw new Error(`所选记录中有 ${missing.length} 项没有对应平台账号，请调整选择后重试`)
      return { source, ids: records.map((record) => String(record.id)), business_platforms: platforms }
    },
    selectionLimit: 1000,
    refresh: true,
  }
}
