import type { ApiResponse, AnyRecord, PageResult } from '@/types/api'

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL
  || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
).replace(/\/$/, '')
const API_BASE_ORIGIN = API_BASE_URL.replace(/\/$/, '')

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

type UnauthorizedHandler = (error: ApiError) => void

export interface DownloadFile {
  blob: Blob
  filename: string
}

let unauthorizedHandler: UnauthorizedHandler | null = null

export function setUnauthorizedHandler(handler: UnauthorizedHandler) {
  unauthorizedHandler = handler
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

export function resolveBackendUrl(value: unknown) {
  const url = String(value || '').trim()
  if (!url) return ''
  if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) return url
  if (url.startsWith('/')) return `${API_BASE_ORIGIN}${url}`
  return url
}

async function request<T>(
  method: string,
  path: string,
  options: { params?: AnyRecord; body?: unknown; auth?: boolean; signal?: AbortSignal; responseType?: 'file' } = {},
) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  const headers: HeadersInit = {
    Accept: options.responseType === 'file' ? 'text/plain, application/json' : 'application/json',
  }
  if (options.body !== undefined && !isFormData) headers['Content-Type'] = 'application/json'
  if (options.auth !== false && token()) headers.Authorization = `Bearer ${token()}`
  const body: BodyInit | undefined =
    options.body === undefined ? undefined : isFormData ? (options.body as FormData) : JSON.stringify(options.body)

  const response = await fetch(buildUrl(path, options.params), {
    method,
    headers,
    body,
    signal: options.signal,
  })
  const disposition = response.headers.get('Content-Disposition') || ''
  const isFile = disposition.toLowerCase().includes('attachment')
    || response.headers.get('Content-Type')?.startsWith('text/plain')
  if (options.responseType === 'file' && response.ok && isFile && !response.headers.get('Content-Type')?.includes('json')) {
    const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
    const plainName = disposition.match(/filename="?([^";]+)"?/i)?.[1]
    let filename = plainName || '账号导出.txt'
    if (encodedName) {
      try { filename = decodeURIComponent(encodedName) } catch { /* 使用备用文件名。 */ }
    }
    return { blob: await response.blob(), filename } as T
  }
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null
  if (!response.ok || !payload || payload.code !== 0 || options.responseType === 'file') {
    const error = new ApiError(
      options.responseType === 'file' && response.ok && (!payload || payload.code === 0)
        ? '导出未返回文件，请刷新后重试'
        : payload?.msg || response.statusText || '请求失败',
      response.status,
      payload?.code,
      payload?.data,
    )
    if (response.status === 401 && token() && !path.includes('/api/auth/login')) {
      unauthorizedHandler?.(error)
    }
    throw error
  }
  return payload.data
}

export async function getAllPages<T>(
  path: string,
  params: AnyRecord = {},
  pageSize = 100,
): Promise<T[]> {
  const firstPage = await request<PageResult<T>>('GET', path, {
    params: { ...params, page: 1, page_size: pageSize },
  })
  const effectivePageSize = Math.max(1, Number(firstPage.page_size || pageSize))
  const pageCount = Math.ceil(Number(firstPage.total || 0) / effectivePageSize)
  if (pageCount <= 1) return firstPage.items

  // 选择器必须拿到完整候选集，后续页并行请求可避免设备较多时逐页等待。
  const remainingPages = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) =>
      request<PageResult<T>>('GET', path, {
        params: { ...params, page: index + 2, page_size: effectivePageSize },
      }),
    ),
  )
  return [firstPage, ...remainingPages].flatMap((page) => page.items)
}

export const http = {
  get: <T>(path: string, params?: AnyRecord) => request<T>('GET', path, { params }),
  post: <T>(path: string, body?: unknown, params?: AnyRecord) =>
    request<T>('POST', path, { body, params }),
  postFile: (path: string, body?: unknown) => request<DownloadFile>('POST', path, { body, responseType: 'file' }),
  postWithSignal: <T>(path: string, body: unknown, signal: AbortSignal) =>
    request<T>('POST', path, { body, signal }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
  deleteWithBody: <T>(path: string, body?: unknown) => request<T>('DELETE', path, { body }),
  apiBaseUrl: API_BASE_URL,
  resolveBackendUrl,
}
