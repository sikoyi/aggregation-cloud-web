import { ApiError, http } from '@/api/http'
import type { DownloadFile } from '@/api/http'
import type { AccountExportPayload, AccountExportSource } from '@/config/accountExport'

export interface AccountExportIssue {
  code: string
  message: string
  account_id?: string | null
  business_platform?: string | null
  field?: string | null
}

export interface AccountExportPreflightItem {
  selected_id: string
  identity_id: string | null
  export_platforms: string[]
  lock_platforms: string[]
  hidden_locked_account_count: number
  file_row_count: number
  local_eligible: boolean
  email_check: 'not_required' | 'unverified'
  blocking_reasons: AccountExportIssue[]
  warnings: AccountExportIssue[]
}

export interface AccountExportPreflight {
  checked_at: string
  source: AccountExportSource
  file_format: 'txt' | 'xlsx'
  selected_count: number
  local_eligible_count: number
  blocked_count: number
  unverified_count: number
  file_row_count: number
  can_submit: boolean
  fully_verified: boolean
  email_check: 'not_required' | 'unverified'
  limitations: string[]
  items: AccountExportPreflightItem[]
}

export interface AccountExportRecordStatus {
  id: string
  state: 'ready' | 'confirming' | 'expired' | 'needs_attention'
  pending: boolean
  expired: boolean
  download_available: boolean
  recovery_overdue: boolean
  filename: string
  row_count: number
  created_at: string
  expires_at: string
}

export interface AccountExportReceipt {
  export_record_id: string
  state: 'ready' | 'confirming'
  committed: true
}

export type AccountExportOutcome = { file: DownloadFile; receipt?: never } | { receipt: AccountExportReceipt; file?: never }

export function readAccountExportReceipt(error: unknown): AccountExportReceipt | null {
  if (!(error instanceof ApiError) || error.status !== 409 || !error.data || typeof error.data !== 'object') return null
  const data = error.data as Record<string, unknown>
  if (data.committed !== true || typeof data.export_record_id !== 'string' || !data.export_record_id
    || (data.state !== 'confirming' && data.state !== 'ready')) return null
  return { export_record_id: data.export_record_id, state: data.state, committed: true }
}

export function accountExportStateLabel(record: { state?: string; pending?: boolean; expired?: boolean }) {
  if (record.expired || record.state === 'expired') return '已过期'
  if (record.state === 'needs_attention') return '待人工核对'
  return record.pending || record.state === 'confirming' ? '邮箱确认中' : '可下载'
}

export const preflightAccountExport = (payload: AccountExportPayload) =>
  http.post<AccountExportPreflight>('/api/accounts/export/preflight', payload)

export const getAccountExportStatus = (id: string) =>
  http.get<AccountExportRecordStatus>(`/api/accounts/export-records/${encodeURIComponent(id)}/status`)

export const downloadAccountExport = (id: string) =>
  http.getFile(`/api/accounts/export-records/${encodeURIComponent(id)}/download`)

export async function submitAccountExport(payload: AccountExportPayload): Promise<AccountExportOutcome> {
  try {
    return { file: await http.postFile('/api/accounts/export', payload) }
  } catch (error) {
    const receipt = readAccountExportReceipt(error)
    if (receipt) return { receipt }
    throw error
  }
}
