import { beforeEach, expect, it, vi } from 'vitest'
import { http } from '@/api/http'
import { prepareSelectedReviews, retryFailedPreparations } from './benchmarkReviewPreparation'

vi.mock('@/api/http', () => ({ http: { post: vi.fn(), get: vi.fn() } }))
beforeEach(() => vi.resetAllMocks())

it('uses the retranslation action for selected reviews', async () => {
  vi.mocked(http.post).mockResolvedValue({ status: 'processed', message: '已重新翻译' })
  const report = vi.fn()
  await prepareSelectedReviews([{ id: 'a', revision: 'v1' }], 'translate', report)
  expect(http.post).toHaveBeenCalledWith('/api/benchmark-trackers/reviews/a/prepare/translate', { revision: 'v1' })
  expect(report).toHaveBeenCalledWith({ id: 'a', status: 'processed', message: '已重新翻译' })
})

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

it('retries only failures with unchanged revisions and pending status', async () => {
  vi.mocked(http.get).mockResolvedValue({ revision: '2', status: 'pending_review' })
  vi.mocked(http.post).mockResolvedValue({ status: 'processed', message: '已保存' })
  const report = vi.fn()
  await retryFailedPreparations([{ id: 'a', revision: '1' }, { id: 'b', revision: '2' }], [
    { id: 'a', status: 'processed', message: '成功' }, { id: 'b', status: 'failed', message: '超时' },
  ], 'translate', report)
  expect(http.get).toHaveBeenCalledTimes(1)
  expect(http.post).toHaveBeenCalledWith('/api/benchmark-trackers/reviews/b/prepare/translate', { revision: '2' })
})

it.each([{ revision: 'changed', status: 'pending_review' }, { revision: '1', status: 'queued' }])(
  'never overwrites changed or approved jobs: %s', async current => {
    vi.mocked(http.get).mockResolvedValue(current)
    const report = vi.fn()
    await retryFailedPreparations([{ id: 'a', revision: '1' }], [{ id: 'a', status: 'failed', message: '超时' }], 'shorten', report)
    expect(http.post).not.toHaveBeenCalled()
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ status: 'skipped' }))
  },
)

it('stops retries if the view is disposed during the revision check', async () => {
  let active = true
  vi.mocked(http.get).mockImplementation(async () => { active = false; return { revision: '1', status: 'pending_review' } })
  await retryFailedPreparations([{ id: 'a', revision: '1' }], [{ id: 'a', status: 'failed', message: '超时' }], 'images', vi.fn(), () => active)
  expect(http.post).not.toHaveBeenCalled()
})
