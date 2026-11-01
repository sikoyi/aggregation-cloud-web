import type { AnyRecord } from './api'
import type { ExternalCollectionProgress } from '@/utils/externalMonitorProgress'

export interface ExternalPersona { id: string; name: string; version: number; member_count?: number }

export interface ExternalMonitorOperator {
  id: string
  username: string
  display_name: string
  status: string
  assignable: boolean
}

export interface ExternalMonitorOwnership {
  operator_id?: string | null
  operator_name?: string | null
  operator_username?: string | null
  operator_status?: string | null
}

export interface ExternalMonitorContext {
  persona?: ExternalPersona | null
  association?: ExternalPersona | null
  accounts: ExternalMonitor[]
  can_manage_persona?: boolean
}

export interface ExternalMonitor extends AnyRecord, ExternalMonitorOwnership {
  id: string
  business_platform: string
  profile_url: string
  remark: string
  country?: string
  interval_minutes: number
  enabled: boolean
  status: string
  activity_status?: string
  collection_progress?: ExternalCollectionProgress
  version: number
  day_deltas?: Record<string, number | null>
  tag_ids: string[]
  folder_id?: string | null
  is_persona?: boolean
  can_manage_persona?: boolean
  persona?: ExternalPersona
  children?: ExternalMonitor[]
  platforms?: string[]
  profile: { display_name?: string; username?: string; avatar_url?: string; biography?: string; followers_count?: number; following_count?: number; posts_count?: number }
}
