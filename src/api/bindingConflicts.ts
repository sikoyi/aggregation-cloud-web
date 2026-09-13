import { http } from '@/api/http'

export interface BindingConflictSlot {
  id: string
  display_name: string | null
  provider_slot_id: string
}

export interface BindingConflict {
  id: string
  account_id: string
  business_platform: string
  username: string | null
  observed_slot: BindingConflictSlot | null
  bound_slot: BindingConflictSlot | null
  observed_slot_restricted: boolean
  bound_slot_restricted: boolean
  runtime_id: string | null
  first_seen_at: string
  last_seen_at: string
}

export interface BindingConflictTarget {
  source: 'execution-slots' | 'accounts'
  id: string
}

export function getBindingConflicts(target: BindingConflictTarget, signal: AbortSignal) {
  return http.getWithSignal<{ items: BindingConflict[] }>(
    `/api/${target.source}/${encodeURIComponent(target.id)}/binding-conflicts`, signal,
  )
}
