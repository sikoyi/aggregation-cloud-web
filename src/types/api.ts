export interface ApiResponse<T> {
  code: number
  msg: string
  data: T
}

export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export type AnyRecord = Record<string, unknown>

