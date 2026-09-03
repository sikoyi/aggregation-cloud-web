import type {
  BusinessEventProjectStatistics,
  BusinessEventStatistics,
} from '@/api/businessEvents'

export interface BusinessEventStatisticsRow {
  key: string
  projectId: string
  projectName: string
  eventId: string
  eventName: string
  eventCount: number
  affectedTaskCount: number
}

export function flattenBusinessEventStatistics(
  projects: BusinessEventProjectStatistics[],
): BusinessEventStatisticsRow[] {
  return projects.flatMap((project) => project.event_types.map((eventType) => ({
    key: `${project.project_internal_id}:${eventType.event_type_internal_id}`,
    projectId: project.project_id,
    projectName: project.project_name,
    eventId: eventType.event_id,
    eventName: eventType.event_name,
    eventCount: eventType.event_count,
    affectedTaskCount: eventType.affected_task_count,
  })))
}

export function businessEventTrendMaximum(statistics: BusinessEventStatistics | null) {
  return Math.max(1, ...(statistics?.daily || []).map((item) => item.event_count))
}
