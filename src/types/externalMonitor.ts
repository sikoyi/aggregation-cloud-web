import type { AnyRecord } from './api'
import type { ExternalCollectionProgress } from '@/utils/externalMonitorProgress'

export interface ExternalPersona { id: string; name: string; version: number; member_count?: number }

export interface ExternalMonitor extends AnyRecord {
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
  persona?: ExternalPersona
  children?: ExternalMonitor[]
  platforms?: string[]
  profile: { display_name?: string; username?: string; avatar_url?: string; biography?: string; followers_count?: number; following_count?: number; posts_count?: number }
}
