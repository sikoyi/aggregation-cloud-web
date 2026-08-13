import { http } from '@/api/http'
import type { PageResult } from '@/types/api'

export interface SystemUser {
  id: string
  username: string
  display_name: string
  roles: string[]
  role_ids: string[]
  role_names: string[]
  permissions: string[]
  business_platform_scope: string[] | null
  runtime_platform_scope: string[] | null
  provider_scope: string[] | null
  status: 'active' | 'disabled'
  version: number
  created_at: string
  updated_at: string
  last_login_at: string | null
}

export interface Role {
  id: string
  code: string
  name: string
  description: string | null
  is_system: boolean
  status: 'active' | 'disabled'
  version: number
  permission_codes: string[]
  business_platform_scope: string[] | null
  runtime_platform_scope: string[] | null
  provider_scope: string[] | null
  user_count: number
  created_at: string
  updated_at: string
}

export interface PermissionItem {
  code: string
  module: string
  module_name: string
  name: string
  description: string
  sort_order: number
}

export interface PermissionGroup {
  module: string
  module_name: string
  items: PermissionItem[]
}

export interface UserListParams {
  keyword?: string
  status?: string
  role_id?: string
  page: number
  page_size: number
}

export interface RoleListParams {
  keyword?: string
  status?: string
  page: number
  page_size: number
}

export function listUsers(params: UserListParams) {
  return http.get<PageResult<SystemUser>>('/api/users', { ...params })
}

export function createUser(payload: {
  username: string
  display_name: string
  password: string
  role_ids: string[]
}) {
  return http.post<SystemUser>('/api/users', payload)
}

export function updateUser(userId: string, payload: { display_name: string; version: number }) {
  return http.put<SystemUser>(`/api/users/${userId}`, payload)
}

export function updateUserStatus(
  userId: string,
  payload: { status: 'active' | 'disabled'; version: number },
) {
  return http.put<SystemUser>(`/api/users/${userId}/status`, payload)
}

export function assignUserRoles(userId: string, payload: { role_ids: string[]; version: number }) {
  return http.put<SystemUser>(`/api/users/${userId}/roles`, payload)
}

export function resetUserPassword(
  userId: string,
  payload: { new_password: string; version: number },
) {
  return http.post<SystemUser>(`/api/users/${userId}/reset-password`, payload)
}

export function changeCurrentPassword(payload: { old_password: string; new_password: string }) {
  return http.put<null>('/api/users/me/password', payload)
}

export function listRoles(params: RoleListParams) {
  return http.get<PageResult<Role>>('/api/roles', { ...params })
}

export async function listAllRoles() {
  const data = await listRoles({ status: 'active', page: 1, page_size: 100 })
  return data.items
}

export function listPermissions() {
  return http.get<PermissionGroup[]>('/api/permissions')
}

export function createRole(payload: {
  name: string
  description?: string
  permission_codes: string[]
  business_platform_scope: string[] | null
  runtime_platform_scope: string[] | null
  provider_scope: string[] | null
}) {
  return http.post<Role>('/api/roles', payload)
}

export function updateRole(
  roleId: string,
  payload: {
    name: string
    description?: string
    permission_codes: string[]
    business_platform_scope: string[] | null
    runtime_platform_scope: string[] | null
    provider_scope: string[] | null
    version: number
  },
) {
  return http.put<Role>(`/api/roles/${roleId}`, payload)
}

export function updateRoleStatus(
  roleId: string,
  payload: { status: 'active' | 'disabled'; version: number },
) {
  return http.put<Role>(`/api/roles/${roleId}/status`, payload)
}

export function deleteRole(roleId: string) {
  return http.delete<Role>(`/api/roles/${roleId}`)
}
