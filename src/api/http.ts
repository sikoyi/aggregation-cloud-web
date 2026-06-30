import type { ApiResponse, AnyRecord } from '@/types/api'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

export class ApiError extends Error {
  status: number
  code?: number
  data?: unknown

  constructor(message: string, status: number, code?: number, data?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.data = data
  }
}

function token() {
  return localStorage.getItem('access_token')
}

function buildUrl(path: string, params?: AnyRecord) {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE_URL}${path}`)
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    url.searchParams.set(key, String(value))
  })
  return url.toString()
}

async function request<T>(
  method: string,
  path: string,
  options: { params?: AnyRecord; body?: unknown; auth?: boolean } = {},
) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  const headers: HeadersInit = {
    Accept: 'application/json',
  }
  if (options.body !== undefined && !isFormData) headers['Content-Type'] = 'application/json'
  if (options.auth !== false && token()) headers.Authorization = `Bearer ${token()}`
  const body: BodyInit | undefined =
    options.body === undefined ? undefined : isFormData ? (options.body as FormData) : JSON.stringify(options.body)

  const response = await fetch(buildUrl(path, options.params), {
    method,
    headers,
    body,
  })
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null
  if (!response.ok || !payload || payload.code !== 0) {
    throw new ApiError(
      payload?.msg || response.statusText || '请求失败',
      response.status,
      payload?.code,
      payload?.data,
    )
  }
  return payload.data
}

export const http = {
  get: <T>(path: string, params?: AnyRecord) => request<T>('GET', path, { params }),
  post: <T>(path: string, body?: unknown, params?: AnyRecord) =>
    request<T>('POST', path, { body, params }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
  apiBaseUrl: API_BASE_URL,
}
