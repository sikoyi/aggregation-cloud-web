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
      try {
        const data = await http.post<LoginData>(
          '/api/auth/login',
          { username, password },
          undefined,
        )
        this.token = data.access_token
        this.user = data.user
        localStorage.setItem('access_token', data.access_token)
      } finally {
        this.loading = false
      }
    },
    async loadMe() {
      if (!this.token) return
      this.user = await http.get<User>('/api/auth/me')
    },
    async logout() {
      try {
        if (this.token) await http.post('/api/auth/logout')
      } finally {
        this.token = ''
        this.user = null
        localStorage.removeItem('access_token')
      }
    },
  },
})

