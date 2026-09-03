import { http } from '@/api/http'

export type BusinessEventStatus = 'active' | 'disabled'
export type BusinessEventPeriod = 'today' | '3d' | '7d' | '30d'

export interface BusinessEventProject {
  id: string
  project_id: string
  name: string
  description?: string | null
  status: BusinessEventStatus
  event_type_count: number
  created_at: string
  updated_at: string
}

export interface BusinessEventType {
  id: string
  project_internal_id: string
  event_id: string
  name: string
  description?: string | null
  status: BusinessEventStatus
  sort_order: number
  created_at: string
  updated_at: string
}

export interface BusinessEventProjectPayload {
  project_id: string
  name: string
  description?: string | null
  status: BusinessEventStatus
}

export interface BusinessEventProjectUpdatePayload {
  name?: string
  description?: string | null
  status?: BusinessEventStatus
}

export interface BusinessEventTypePayload {
  event_id: string
  name: string
  description?: string | null
  status: BusinessEventStatus
  sort_order: number
}

export interface BusinessEventTypeUpdatePayload {
  name?: string
  description?: string | null
  status?: BusinessEventStatus
  sort_order?: number
}

export interface BusinessEventTypeStatistics {
  event_type_internal_id: string
  event_id: string
  event_name: string
  event_count: number
  affected_task_count: number
}

export interface BusinessEventProjectStatistics {
  project_internal_id: string
  project_id: string
  project_name: string
  event_count: number
  affected_task_count: number
  event_types: BusinessEventTypeStatistics[]
}

export interface BusinessEventDailyStatistics {
  date: string
  event_count: number
  affected_task_count: number
}

export interface BusinessEventStatistics {
  period: BusinessEventPeriod
  timezone: string
  start_date: string
  end_date: string
  event_count: number
  affected_task_count: number
  project_count: number
  projects: BusinessEventProjectStatistics[]
  daily: BusinessEventDailyStatistics[]
  generated_at: string
}

export function listBusinessEventProjects() {
  return http.get<BusinessEventProject[]>('/api/business-events/projects')
}

export function createBusinessEventProject(payload: BusinessEventProjectPayload) {
  return http.post<BusinessEventProject>('/api/business-events/projects', payload)
}

export function updateBusinessEventProject(
  projectInternalId: string,
  payload: BusinessEventProjectUpdatePayload,
) {
  return http.put<BusinessEventProject>(`/api/business-events/projects/${projectInternalId}`, payload)
}

export function listBusinessEventTypes(projectInternalId: string) {
  return http.get<BusinessEventType[]>(`/api/business-events/projects/${projectInternalId}/types`)
}

export function createBusinessEventType(
  projectInternalId: string,
  payload: BusinessEventTypePayload,
) {
  return http.post<BusinessEventType>(
    `/api/business-events/projects/${projectInternalId}/types`,
    payload,
  )
}

export function updateBusinessEventType(
  eventTypeInternalId: string,
  payload: BusinessEventTypeUpdatePayload,
) {
  return http.put<BusinessEventType>(`/api/business-events/types/${eventTypeInternalId}`, payload)
}

export function getBusinessEventStatistics(
  period: BusinessEventPeriod,
  projectId?: string,
) {
  return http.get<BusinessEventStatistics>('/api/business-events/statistics', {
    period,
    project_id: projectId || undefined,
  })
}
