import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, http, setUnauthorizedHandler } from '@/api/http'


class MemoryStorage implements Storage {
  private values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}


describe('HTTP 身份过期处理', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage())
    setUnauthorizedHandler(() => undefined)
  })

  it('已登录请求返回 401 时触发统一退出处理', async () => {
    localStorage.setItem('access_token', 'expired-token')
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ code: 40100, msg: '身份信息已过期', data: null }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )))

    await expect(http.get('/api/auth/me')).rejects.toBeInstanceOf(ApiError)
    expect(handler).toHaveBeenCalledOnce()
  })

  it('登录接口自身失败时不触发重复重定向', async () => {
    localStorage.setItem('access_token', 'old-token')
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ code: 40100, msg: '账号或密码错误', data: null }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )))

    await expect(http.post('/api/auth/login', {})).rejects.toBeInstanceOf(ApiError)
    expect(handler).not.toHaveBeenCalled()
  })
})
