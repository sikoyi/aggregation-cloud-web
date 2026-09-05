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

  it('导出使用认证 POST，返回 TXT 文件和中文文件名', async () => {
    localStorage.setItem('access_token', 'valid-token')
    const fetchMock = vi.fn().mockResolvedValue(new Response('user---password---00123\r\n', {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('账号导出.txt')}`,
      },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const file = await http.postFile('/api/accounts/export', { ids: ['1'] })
    expect(file.filename).toBe('账号导出.txt')
    expect(await file.blob.text()).toBe('user---password---00123\r\n')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST', headers: { Authorization: 'Bearer valid-token' }, body: '{"ids":["1"]}',
    })
  })

  it('导出失败保留服务端中文提示，不能下载错误 JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ code: 40900, msg: '所选账号已删除，请重新选择', data: null }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    )))
    await expect(http.postFile('/api/accounts/export', { ids: ['1'] })).rejects.toThrow('所选账号已删除')
  })

  it('导出时登录过期同样触发统一处理', async () => {
    localStorage.setItem('access_token', 'expired-token')
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ code: 40100, msg: '身份信息已过期', data: null }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )))
    await expect(http.postFile('/api/accounts/export', { ids: ['1'] })).rejects.toBeInstanceOf(ApiError)
    expect(handler).toHaveBeenCalledOnce()
  })

  it('接口误返回网页时不能当作账号文件下载', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>not a file</html>', {
      headers: { 'Content-Type': 'text/html' },
    })))
    await expect(http.postFile('/api/accounts/export', { ids: ['1'] })).rejects.toThrow('导出未返回文件')
  })
})
