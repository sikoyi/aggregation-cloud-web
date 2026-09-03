import { beforeEach, describe, expect, it, vi } from 'vitest'

import { http } from '@/api/http'
import { loadMediaAssetsByIds, uploadMediaAssets } from '@/api/mediaAssets'
import { compressImageForUpload } from '@/utils/imageCompression'

vi.mock('@/api/http', () => ({
  http: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

function mockFile(name: string) {
  return Object.assign(new Blob([name], { type: 'image/png' }), {
    name,
    lastModified: 1,
  }) as File
}

describe('media asset batch upload', () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset()
  })

  it('continues remaining files after one upload fails and reports every result', async () => {
    const files = [mockFile('one.png'), mockFile('two.png'), mockFile('three.png')]
    const upload = vi.fn()
      .mockResolvedValueOnce({ id: '1' })
      .mockRejectedValueOnce(new Error('格式不支持'))
      .mockResolvedValueOnce({ id: '3' })
    const progress: string[] = []

    const results = await uploadMediaAssets(
      files,
      {
        businessPlatform: 'threads',
        status: 'enabled',
        tags: ['finance'],
        remark: 'batch',
      },
      (result) => progress.push(`${result.file.name}:${result.status}`),
      upload,
    )

    expect(upload).toHaveBeenCalledTimes(3)
    expect(results.map((result) => result.status)).toEqual(['succeeded', 'failed', 'succeeded'])
    expect(results[1].error).toBe('格式不支持')
    expect(progress).toEqual([
      'one.png:succeeded',
      'two.png:failed',
      'three.png:succeeded',
    ])
    const firstBody = upload.mock.calls[0][0] as FormData
    expect(firstBody.get('business_platform')).toBe('threads')
    expect(firstBody.get('tags')).toBe('finance')
    expect(firstBody.get('remark')).toBe('batch')
  })

  it('loads large preview selections in batches instead of one request per asset', async () => {
    vi.mocked(http.get)
      .mockResolvedValueOnce([{ id: '1' }])
      .mockResolvedValueOnce([{ id: '101' }])
      .mockResolvedValueOnce([{ id: '201' }])
    const ids = Array.from({ length: 205 }, (_, index) => String(index + 1))

    const assets = await loadMediaAssetsByIds(ids)

    expect(assets).toEqual([{ id: '1' }, { id: '101' }, { id: '201' }])
    expect(http.get).toHaveBeenCalledTimes(3)
    expect(http.get).toHaveBeenNthCalledWith(1, '/api/resource-center/media-assets/batch', {
      asset_ids: ids.slice(0, 100).join(','),
    })
    expect(http.get).toHaveBeenNthCalledWith(3, '/api/resource-center/media-assets/batch', {
      asset_ids: ids.slice(200).join(','),
    })
  })

  it('uploads the prepared compressed image while preserving the original progress identity', async () => {
    const original = mockFile('large.png')
    const compressed = Object.assign(new Blob(['small'], { type: 'image/jpeg' }), {
      name: 'large.jpg',
      lastModified: 1,
    }) as File
    const prepareFile = vi.fn().mockResolvedValue(compressed)
    const upload = vi.fn().mockResolvedValue({ id: 'compressed' })

    const [result] = await uploadMediaAssets(
      [original],
      { businessPlatform: 'threads', status: 'enabled', tags: [], remark: '' },
      undefined,
      upload,
      prepareFile,
    )

    expect(prepareFile).toHaveBeenCalledWith(original)
    expect(result.file).toBe(original)
    expect(result.uploadedFile).toBe(compressed)
    expect(result.compressed).toBe(true)
    expect((upload.mock.calls[0][0] as FormData).get('file')).toMatchObject({
      name: 'large.jpg',
      size: compressed.size,
      type: 'image/jpeg',
    })
  })

  it('does not decode small images that are already below the compression threshold', async () => {
    const image = mockFile('small.png')

    await expect(compressImageForUpload(image)).resolves.toBe(image)
  })
})
