import { http } from '@/api/http'
import type { AnyRecord } from '@/types/api'

export interface MetaAccountFeatureStatus {
  enabled: boolean
  dual_write_enabled: boolean
  shadow_read_enabled: boolean
  runtime_capability: string
}

export interface IdentityPlatformSummary {
  account_id: string
  business_platform: string
  username?: string | null
  display_name?: string | null
  platform_account_id?: string | null
  health_status: string
  tag_names?: string[]
  session_id?: string | null
  login_status?: string | null
  slot_id?: string | null
  slot_name?: string | null
  observed_at?: string | null
}

export interface AccountIdentityDetail extends AnyRecord {
  id: string
  display_name?: string | null
  login_username?: string | null
  password_secret_ref?: string | null
  totp_secret_ref?: string | null
  twofa_type?: string | null
  credentials_version: number
  can_edit_credentials: boolean
}

export interface AccountIdentityRow extends AccountIdentityDetail {
  country?: string | null
  status: string
  platform_count: number
  account_count: number
  active_session_count: number
  has_pending_candidate: boolean
  platform_summaries: IdentityPlatformSummary[]
}

export interface AccountIdentityCredentialsPatch {
  expected_credentials_version: number
  login_username?: string
  password_secret_ref?: string
  totp_secret_ref?: string
  clear_password?: true
  clear_totp?: true
}

export function getAccountIdentity(id: string) {
  return http.get<AccountIdentityDetail>(`/api/account-identities/${encodeURIComponent(id)}`)
}

export function updateAccountIdentityCredentials(id: string, body: AccountIdentityCredentialsPatch) {
  return http.patch<AccountIdentityDetail>(`/api/account-identities/${encodeURIComponent(id)}/credentials`, body)
}

export function getMetaAccountFeatureStatus() {
  return http.get<MetaAccountFeatureStatus>('/api/account-identities/feature')
}
