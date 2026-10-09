import { beforeEach, expect, it, vi } from 'vitest'
import { http } from '@/api/http'
import { prepareSelectedReviews } from './benchmarkReviewPreparation'

vi.mock('@/api/http', () => ({ http: { post: vi.fn() } }))
beforeEach(() => vi.clearAllMocks())

it('reports each result, continues after failures and preserves revisions', async () => {
  vi.mocked(http.post).mockResolvedValueOnce({ status: 'skipped', message: '长度符合要求' })
    .mockRejectedValueOnce(new Error('模型超时'))
    .mockResolvedValueOnce({ status: 'processed', message: '已保存' })
  const report = vi.fn()
  await prepareSelectedReviews([{ id: 'a', revision: '1' }, { id: 'b', revision: '2' }, { id: 'c', revision: '3' }], 'shorten', report)
  expect(report.mock.calls.map(([result]) => result.status)).toEqual(['skipped', 'failed', 'processed'])
  expect(http.post).toHaveBeenNthCalledWith(2, '/api/benchmark-trackers/reviews/b/prepare/shorten', { revision: '2' })
})

it('waits for one request before starting the next', async () => {
  let finish!: (value: unknown) => void
  vi.mocked(http.post).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    .mockResolvedValueOnce({ status: 'processed', message: '已保存' })
  const promise = prepareSelectedReviews([{ id: 'a', revision: '1' }, { id: 'b', revision: '2' }], 'images', vi.fn())
  expect(http.post).toHaveBeenCalledTimes(1)
  finish({ status: 'processed', message: '已保存' })
  await promise
  expect(http.post).toHaveBeenCalledTimes(2)
})

it('stops sending remaining items after leaving the page', async () => {
  let active = true
  vi.mocked(http.post).mockResolvedValue({ status: 'processed', message: '已保存' })
  await prepareSelectedReviews([{ id: 'a', revision: '1' }, { id: 'b', revision: '2' }], 'images', () => { active = false }, () => active)
  expect(http.post).toHaveBeenCalledTimes(1)
})
