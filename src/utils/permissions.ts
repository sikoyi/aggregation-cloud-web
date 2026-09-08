import type { SystemUser } from '@/api/rbac'

const superAdminOnlyPermissions = new Set(['accounts.credentials', 'accounts.export', 'registration_resources.reveal'])

export function hasPermission(user: Pick<SystemUser, 'roles' | 'permissions'> | null, code: string): boolean {
  if (!user) return false
  if (user.roles.includes('super_admin')) return true
  return !superAdminOnlyPermissions.has(code) && user.permissions.includes(code)
}
