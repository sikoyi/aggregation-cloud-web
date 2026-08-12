import { http } from '@/api/http'
import type { PageResult } from '@/types/api'


export interface SystemNotification {
  id: string
  version: string
  previous_version?: string | null
  title: string
  items: string[]
  published_at: string
  is_read: boolean
  read_at?: string | null
}

export function listSystemNotifications(page = 1, pageSize = 10) {
  return http.get<PageResult<SystemNotification>>('/api/system-notifications', {
    page,
    page_size: pageSize,
  })
}

export function getSystemNotificationUnreadCount() {
  return http.get<{ unread_count: number }>('/api/system-notifications/unread-count')
}

export function markSystemNotificationRead(notificationId: string) {
  return http.post<{ updated_count: number }>(`/api/system-notifications/${notificationId}/read`)
}

export function markAllSystemNotificationsRead() {
  return http.post<{ updated_count: number }>('/api/system-notifications/read-all')
}
