import { defineStore } from 'pinia'

import { http } from '@/api/http'

interface LoginData {
  access_token: string
  token_type: string
  expires_in: number
  user: User
}

interface User {
  id: string
  username: string
  display_name?: string | null
  role?: string
  status?: string
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    token: localStorage.getItem('access_token') || '',
    loading: false,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.token),
    displayName: (state) => state.user?.display_name || state.user?.username || '未登录',
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
      this.user = await http.get<User>('/api/auth/me')
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
