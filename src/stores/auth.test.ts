import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SystemUser } from '@/api/rbac'
import { useAuthStore } from '@/stores/auth'

class MemoryStorage {
  private values = new Map<string, string>()

  getItem(key: string) { return this.values.get(key) ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

function user(overrides: Partial<SystemUser> = {}): SystemUser {
  return {
    id: '1',
    username: 'operator',
    display_name: 'Operator',
    roles: ['operator'],
    role_ids: ['2'],
    role_names: ['运营人员'],
    permissions: ['accounts.view', 'tasks.dispatch'],
    business_platform_scope: null,
    runtime_platform_scope: null,
    provider_scope: null,
    status: 'active',
    version: 1,
    created_at: '2026-08-12T00:00:00Z',
    updated_at: '2026-08-12T00:00:00Z',
    last_login_at: null,
    ...overrides,
  }
}

describe('RBAC 权限状态', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage())
    setActivePinia(createPinia())
  })

  it('按后端返回的权限并集判断普通角色能力', () => {
    const auth = useAuthStore()
    auth.user = user()

    expect(auth.can('accounts.view')).toBe(true)
    expect(auth.can('tasks.dispatch')).toBe(true)
    expect(auth.can('users.view')).toBe(false)
    expect(auth.canAny(['roles.view', 'accounts.view'])).toBe(true)
  })

  it('超级管理员不依赖显式权限列表', () => {
    const auth = useAuthStore()
    auth.user = user({ roles: ['super_admin'], permissions: [] })

    expect(auth.isSuperAdmin).toBe(true)
    expect(auth.can('system_settings.edit')).toBe(true)
    expect(auth.can('roles.delete')).toBe(true)
  })

  it('清理会话时同时移除本地令牌和用户信息', () => {
    const auth = useAuthStore()
    localStorage.setItem('access_token', 'token')
    auth.token = 'token'
    auth.user = user()

    auth.clearSession()

    expect(auth.token).toBe('')
    expect(auth.user).toBeNull()
    expect(localStorage.getItem('access_token')).toBeNull()
  })
})
