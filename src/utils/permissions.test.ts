import { describe, expect, it } from 'vitest'

import { hasPermission } from './permissions'

describe('管理员专属凭据权限', () => {
  it.each([{ roles: [] }, { roles: ['operator'] }, { roles: ['custom_admin'] }])('旧授权码不能恢复非管理员读取或导出权限 $roles', ({ roles }) => {
    const user = { roles, permissions: ['accounts.credentials', 'accounts.export', 'accounts.totp', 'accounts.edit', 'registration_resources.reveal'] }
    expect(hasPermission(user, 'accounts.credentials')).toBe(false)
    expect(hasPermission(user, 'accounts.export')).toBe(false)
    expect(hasPermission(user, 'registration_resources.reveal')).toBe(false)
    expect(hasPermission(user, 'accounts.totp')).toBe(true)
    expect(hasPermission(user, 'accounts.edit')).toBe(true)
  })

  it('超级管理员无需单独授予凭据、验证码和导出权限', () => {
    const user = { roles: ['super_admin'], permissions: [] }
    for (const code of ['accounts.credentials', 'accounts.export', 'accounts.totp', 'registration_resources.reveal']) {
      expect(hasPermission(user, code)).toBe(true)
    }
  })

  it('没有验证码权限和没有登录上下文时保持拒绝', () => {
    expect(hasPermission({ roles: ['operator'], permissions: ['accounts.view'] }, 'accounts.totp')).toBe(false)
    expect(hasPermission(null, 'accounts.credentials')).toBe(false)
    expect(hasPermission(null, 'accounts.totp')).toBe(false)
    expect(hasPermission(null, 'accounts.export')).toBe(false)
  })
})
