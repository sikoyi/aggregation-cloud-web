import { http } from '@/api/http'
import type { AnyRecord } from '@/types/api'

export interface MediaAssetUploadOptions {
  businessPlatform: string
  status: string
  tags: string[]
  remark: string
}

export interface MediaAssetUploadResult {
  file: File
  status: 'succeeded' | 'failed'
  data?: AnyRecord
  error?: string
}

type UploadRequest = (body: FormData) => Promise<AnyRecord>
type ProgressCallback = (result: MediaAssetUploadResult, completed: number, total: number) => void

function buildUploadBody(file: File, options: MediaAssetUploadOptions) {
  const body = new FormData()
  body.append('file', file)
  body.append('business_platform', options.businessPlatform)
  body.append('status', options.status)
  if (options.tags.length) body.append('tags', options.tags.join(','))
  if (options.remark.trim()) body.append('remark', options.remark.trim())
  return body
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '上传失败'
}

export async function uploadMediaAssets(
  files: File[],
  options: MediaAssetUploadOptions,
  onProgress?: ProgressCallback,
  upload: UploadRequest = (body) => http.post<AnyRecord>('/api/resource-center/media-assets/upload', body),
) {
  const results: MediaAssetUploadResult[] = []
  for (const file of files) {
    let result: MediaAssetUploadResult
    try {
      result = {
        file,
        status: 'succeeded',
        data: await upload(buildUploadBody(file, options)),
      }
    } catch (error) {
      result = {
        file,
        status: 'failed',
        error: errorMessage(error),
      }
    }
    results.push(result)
    onProgress?.(result, results.length, files.length)
  }
  return results
}
