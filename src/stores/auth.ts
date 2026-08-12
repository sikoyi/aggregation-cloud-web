import { defineStore } from 'pinia'

import { http } from '@/api/http'
import type { SystemUser } from '@/api/rbac'

interface LoginData {
  access_token: string
  token_type: string
  expires_in: number
  user: SystemUser
}


export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as SystemUser | null,
    token: localStorage.getItem('access_token') || '',
    loading: false,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.token),
    displayName: (state) => state.user?.display_name || state.user?.username || '未登录',
    isSuperAdmin: (state) => Boolean(state.user?.roles.includes('super_admin')),
    can: (state) => (code: string) =>
      Boolean(state.user?.roles.includes('super_admin') || state.user?.permissions.includes(code)),
    canAny: (state) => (codes: string[]) =>
      Boolean(
        state.user?.roles.includes('super_admin')
        || codes.some((code) => state.user?.permissions.includes(code)),
      ),
  },
  actions: {
    async login(username: string, password: string) {
      this.loading = true
      const controller = new AbortController()
      const timeoutId = window.setTimeout(() => controller.abort(), 15_000)
      try {
        const data = await http.postWithSignal<LoginData>(
          '/api/auth/login',
          { username, password },
          controller.signal,
        )
        this.token = data.access_token
        this.user = data.user
        localStorage.setItem('access_token', data.access_token)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new Error('连接后端超时，请稍后重试')
        }
        throw error
      } finally {
        window.clearTimeout(timeoutId)
        this.loading = false
      }
    },
    async loadMe() {
      if (!this.token) return
      this.user = await http.get<SystemUser>('/api/auth/me')
    },
    clearSession() {
      this.token = ''
      this.user = null
      localStorage.removeItem('access_token')
    },
    async logout() {
      try {
        if (this.token) await http.post('/api/auth/logout')
      } finally {
        this.clearSession()
      }
    },
  },
})
