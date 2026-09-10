import type { SystemUser } from '@/api/rbac'

const superAdminOnlyPermissions = new Set(['accounts.credentials', 'accounts.export', 'registration_resources.reveal'])

type PermissionUser = Pick<SystemUser, 'roles' | 'permissions' | 'is_system_admin'> & Partial<Pick<SystemUser, 'status'>>

export function hasPermission(user: PermissionUser | null, code: string): boolean {
  if (!user) return false
  if (code === 'registration_resources.reveal') {
    return user.is_system_admin === true && user.status === 'active' && user.roles.includes('super_admin')
  }
  if (user.roles.includes('super_admin')) return true
  return !superAdminOnlyPermissions.has(code) && user.permissions.includes(code)
}

export function canResetUserPassword(
  actor: (PermissionUser & Pick<SystemUser, 'id'>) | null,
  target: Pick<SystemUser, 'id' | 'is_system_admin'>,
): boolean {
  return hasPermission(actor, 'users.reset_password')
    && (target.is_system_admin === false || target.id === actor?.id)
}
