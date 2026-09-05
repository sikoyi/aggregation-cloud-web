import type { RowActionConfig } from '@/types/crud'

export function accountExportAction(source: 'accounts' | 'identities'): RowActionConfig {
  return {
    key: 'export-accounts',
    label: '导出账号',
    permission: 'accounts.view',
    method: 'POST',
    icon: 'download',
    clientAction: 'download',
    batchPath: () => '/api/accounts/export',
    batchBody: (_payload, records) => {
      const exported = records.filter((record) => Boolean(record.credentials_exported_at))
      if (exported.length) {
        throw new Error(`所选记录中有 ${exported.length} 个登录身份已导出，不能重复导出`)
      }
      return { source, ids: records.map((record) => String(record.id)) }
    },
    selectionLimit: 1000,
    refresh: false,
  }
}
