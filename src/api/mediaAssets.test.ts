import { describe, expect, it, vi } from 'vitest'

import { uploadMediaAssets } from '@/api/mediaAssets'

function mockFile(name: string) {
  return Object.assign(new Blob([name], { type: 'image/png' }), {
    name,
    lastModified: 1,
  }) as File
}

describe('media asset batch upload', () => {
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
})
