import { describe, expect, it } from 'vitest'

import { canResetUserPassword, hasPermission } from './permissions'

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
    for (const code of ['accounts.credentials', 'accounts.export', 'accounts.totp']) {
      expect(hasPermission(user, code)).toBe(true)
    }
  })

  it('注册资料原文只认服务端确认的启用内置管理员，撤权立即生效', () => {
    const user = { roles: ['super_admin'], permissions: ['registration_resources.reveal'], status: 'active' as const }
    expect(hasPermission(user, 'registration_resources.reveal')).toBe(false)
    expect(hasPermission({ ...user, is_system_admin: false }, 'registration_resources.reveal')).toBe(false)
    expect(hasPermission({ ...user, is_system_admin: true }, 'registration_resources.reveal')).toBe(true)
    expect(hasPermission({ ...user, is_system_admin: true, status: 'disabled' }, 'registration_resources.reveal')).toBe(false)
    expect(hasPermission({ ...user, is_system_admin: true, roles: ['operator'] }, 'registration_resources.reveal')).toBe(false)
  })

  it('其他管理员不能重置内置账号密码，旧响应缺少标记时保守隐藏', () => {
    const actor = { id: 'other', roles: ['super_admin'], permissions: [] }
    expect(canResetUserPassword(actor, { id: 'root', is_system_admin: true })).toBe(false)
    expect(canResetUserPassword(actor, { id: 'root' })).toBe(false)
    expect(canResetUserPassword(actor, { id: 'normal', is_system_admin: false })).toBe(true)
    expect(canResetUserPassword({ ...actor, id: 'root' }, { id: 'root', is_system_admin: true })).toBe(true)
    expect(canResetUserPassword({ ...actor, roles: ['operator'] }, { id: 'normal', is_system_admin: false })).toBe(false)
    expect(canResetUserPassword(null, { id: 'normal', is_system_admin: false })).toBe(false)
  })

  it('没有验证码权限和没有登录上下文时保持拒绝', () => {
    expect(hasPermission({ roles: ['operator'], permissions: ['accounts.view'] }, 'accounts.totp')).toBe(false)
    expect(hasPermission(null, 'accounts.credentials')).toBe(false)
    expect(hasPermission(null, 'accounts.totp')).toBe(false)
    expect(hasPermission(null, 'accounts.export')).toBe(false)
  })
})
