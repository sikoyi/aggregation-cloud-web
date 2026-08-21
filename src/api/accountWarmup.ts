import { http } from '@/api/http'
import type { PageResult } from '@/types/api'

export interface WarmupTargetRules {
  account_ids: string[]
  slot_ids: string[]
  account_tag_ids: string[]
  slot_group_ids: string[]
}

export interface WarmupBehaviorRule {
  enabled: boolean
  start_day: number
  min_minutes?: number | null
  max_minutes?: number | null
  probability?: number | null
  content_group_id?: string | null
  content_usage_status?: 'unused' | 'used' | 'all' | null
}

export interface WarmupPlanPayload {
  name: string
  business_platform: 'threads' | 'x' | 'instagram'
  runtime_platform: 'fingerprint_browser' | 'cloud_phone'
  provider: 'morelogin' | 'adspower' | 'vmos'
  script_id?: string | null
  plan_type: 'full' | 'maintenance'
  target_days?: number | null
  maintenance_schedule_type?: 'daily' | 'interval_days' | 'weekdays' | null
  maintenance_interval_days?: number | null
  maintenance_weekdays: number[]
  timezone: string
  daily_window_start: string
  daily_window_end: string
  max_concurrency: number
  failure_counts_as_day: boolean
  continue_after_failure: boolean
  consecutive_failure_pause_threshold: number
  retry_override?: number | null
  completion_mode: 'automatic' | 'manual_review'
  target_mode: 'fixed' | 'account_tags' | 'slot_groups' | 'dynamic_intersection'
  target_rules: WarmupTargetRules
  behavior_rules: Record<'browse' | 'like' | 'follow' | 'publish', WarmupBehaviorRule>
}

export interface WarmupPlan extends WarmupPlanPayload {
  id: string
  status: string
  created_by?: string | null
  creator_name?: string | null
  created_at: string
  updated_at: string
  activated_at?: string | null
  completed_at?: string | null
  member_total: number
  running_total: number
  pending_review_total: number
  completed_total: number
  abnormal_total: number
}

export interface WarmupMember {
  id: string
  plan_id: string
  account_id: string
  fingerprint_slot_id?: string | null
  status: string
  current_day: number
  counted_days: number
  success_count: number
  failure_count: number
  consecutive_failure_count: number
  joined_at: string
  next_run_at?: string | null
  last_run_at?: string | null
  last_success_at?: string | null
  pause_reason?: string | null
  account_name?: string | null
  account_type?: string | null
  account_login_status?: string | null
  slot_name?: string | null
  provider_slot_id?: string | null
}

export interface WarmupDailyRun {
  id: string
  account_id: string
  business_date: string
  warmup_day: number
  task_run_id?: string | null
  slot_id?: string | null
  status: string
  counts_as_day: boolean
  scheduled_at?: string | null
  completed_at?: string | null
  task_title?: string | null
  task_status?: string | null
  task_error_message?: string | null
}

export function listWarmupPlans(params: Record<string, unknown>) {
  return http.get<PageResult<WarmupPlan>>('/api/account-warmup/plans', params)
}

export function createWarmupPlan(payload: WarmupPlanPayload) {
  return http.post<WarmupPlan>('/api/account-warmup/plans', payload)
}

export function updateWarmupPlan(planId: string, payload: WarmupPlanPayload) {
  return http.put<WarmupPlan>(`/api/account-warmup/plans/${planId}`, payload)
}

export function operateWarmupPlan(planId: string, action: 'activate' | 'pause' | 'resume' | 'cancel') {
  return http.post<WarmupPlan | { plan: WarmupPlan }>(`/api/account-warmup/plans/${planId}/${action}`)
}

export function syncWarmupScope(planId: string) {
  return http.post<{ matched_count: number; joined_count: number; conflict_count: number; removed_count: number }>(
    `/api/account-warmup/plans/${planId}/sync-scope`,
  )
}

export function listWarmupMembers(planId: string, params: Record<string, unknown>) {
  return http.get<PageResult<WarmupMember>>(`/api/account-warmup/plans/${planId}/members`, params)
}

export function operateWarmupMember(planId: string, memberId: string, action: string) {
  return http.post<WarmupMember>(`/api/account-warmup/plans/${planId}/members/${memberId}/${action}`)
}

export function listWarmupDailyRuns(planId: string, params: Record<string, unknown>) {
  return http.get<PageResult<WarmupDailyRun>>(`/api/account-warmup/plans/${planId}/daily-runs`, params)
}
