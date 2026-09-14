import type { SystemUser } from '@/api/rbac'

const superAdminOnlyPermissions = new Set([
  'accounts.credentials', 'accounts.export', 'registration_resources.reveal',
  'users.create', 'users.edit', 'users.disable', 'users.reset_password', 'users.assign_roles',
  'roles.create', 'roles.edit', 'roles.disable', 'roles.delete',
])

export function isAssignablePermission(code: string): boolean {
  return !superAdminOnlyPermissions.has(code)
}

type PermissionUser = Pick<SystemUser, 'roles' | 'permissions' | 'is_system_admin' | 'account_credential_reveal_allowed'> & Partial<Pick<SystemUser, 'status'>>

export function hasPermission(user: PermissionUser | null, code: string): boolean {
  if (!user || user.status === 'disabled') return false
  if (['registration_resources.reveal', 'accounts.credentials', 'accounts.export'].includes(code)) {
    return user.is_system_admin === true && user.status === 'active' && user.roles.includes('super_admin')
  }
  if (user.roles.includes('super_admin')) return true
  return !superAdminOnlyPermissions.has(code) && user.permissions.includes(code)
}

export function canRequestAccountCredentials(user: PermissionUser | null): boolean {
  return user?.status === 'active' && user.roles.includes('super_admin')
    && user.account_credential_reveal_allowed === true
    && !hasPermission(user, 'accounts.credentials')
}

export function canManageAccountCredentialGrants(user: PermissionUser | null): boolean {
  return Boolean(user?.status === 'active' && user.is_system_admin === true && user.roles.includes('super_admin'))
}

export function canResetUserPassword(
  actor: (PermissionUser & Pick<SystemUser, 'id'>) | null,
  target: Pick<SystemUser, 'id' | 'is_system_admin'>,
): boolean {
  return hasPermission(actor, 'users.reset_password')
    && (target.is_system_admin === false || target.id === actor?.id)
}
