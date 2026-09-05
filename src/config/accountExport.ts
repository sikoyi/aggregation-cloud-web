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
    batchBody: (_payload, records) => ({ source, ids: records.map((record) => String(record.id)) }),
    selectionLimit: 1000,
    refresh: false,
  }
}
