import type { RowActionConfig } from '@/types/crud'

export const accountBackupDeleteAction: RowActionConfig = {
  key: 'delete-account-backups', label: '删除备份包', permission: 'accounts.delete_backup',
  icon: 'trash', variant: 'danger', selectionLimit: 100,
}
