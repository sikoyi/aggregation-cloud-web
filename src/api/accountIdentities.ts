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
  session_id?: string | null
  login_status?: string | null
  slot_id?: string | null
  slot_name?: string | null
  observed_at?: string | null
}

export interface AccountIdentityRow extends AnyRecord {
  id: string
  display_name?: string | null
  login_username?: string | null
  country?: string | null
  status: string
  platform_count: number
  account_count: number
  active_session_count: number
  has_pending_candidate: boolean
  platform_summaries: IdentityPlatformSummary[]
}

export function getMetaAccountFeatureStatus() {
  return http.get<MetaAccountFeatureStatus>('/api/account-identities/feature')
}
