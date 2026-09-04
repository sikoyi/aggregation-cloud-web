import { http } from '@/api/http'
import type { AnyRecord } from '@/types/api'
import { compressImageForUpload } from '@/utils/imageCompression'

export interface MediaAssetUploadOptions {
  businessPlatform: string
  status: string
  tags: string[]
  remark: string
}

export interface MediaAssetUploadResult {
  file: File
  uploadedFile?: File
  compressed?: boolean
  status: 'succeeded' | 'failed'
  data?: AnyRecord
  error?: string
}

type UploadRequest = (body: FormData) => Promise<AnyRecord>
type ProgressCallback = (result: MediaAssetUploadResult, completed: number, total: number) => void
type PrepareFile = (file: File) => Promise<File>

function buildUploadBody(file: File, options: MediaAssetUploadOptions) {
  const body = new FormData()
  body.append('file', file, file.name)
  body.append('business_platform', options.businessPlatform)
  body.append('status', options.status)
  if (options.tags.length) body.append('tags', options.tags.join(','))
  if (options.remark.trim()) body.append('remark', options.remark.trim())
  return body
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '上传失败'
}

export async function loadMediaAssetsByIds(assetIds: string[]) {
  const ids = [...new Set(assetIds.map(String).filter(Boolean))]
  if (!ids.length) return [] as AnyRecord[]
  const batches: Promise<AnyRecord[]>[] = []
  for (let index = 0; index < ids.length; index += 100) {
    batches.push(http.get<AnyRecord[]>('/api/resource-center/media-assets/batch', {
      asset_ids: ids.slice(index, index + 100).join(','),
    }))
  }
  return (await Promise.all(batches)).flat()
}

export async function uploadMediaAssets(
  files: File[],
  options: MediaAssetUploadOptions,
  onProgress?: ProgressCallback,
  upload: UploadRequest = (body) => http.post<AnyRecord>('/api/resource-center/media-assets/upload', body),
  prepareFile: PrepareFile = compressImageForUpload,
) {
  const results: MediaAssetUploadResult[] = []
  for (const file of files) {
    let result: MediaAssetUploadResult
    try {
      const uploadedFile = await prepareFile(file)
      result = {
        file,
        uploadedFile,
        compressed: uploadedFile !== file,
        status: 'succeeded',
        data: await upload(buildUploadBody(uploadedFile, options)),
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
