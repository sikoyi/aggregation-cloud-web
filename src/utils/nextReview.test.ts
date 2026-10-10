import { expect, it, vi } from 'vitest'
import { findNextReview } from './nextReview'

const row = (id: string, status = 'pending_review') => ({
  id, status, created_at: new Date(Date.UTC(2026, 9, 10, 0, 0, 200 - id.charCodeAt(0))).toISOString(),
})
const base = () => ({ rows: [row('a'), row('b'), row('c')], currentId: 'b', page: 1, pageSize: 3,
  active: () => true, detail: vi.fn(async (id: string) => row(id)),
  list: vi.fn(async (_page: number) => ({ items: [row('a'), row('c')], total: 2 })),
})

it('continues after the current row without revisiting preceding rows after deletion shifts', async () => {
  const options = base()
  expect((await findNextReview(options))?.job.id).toBe('c')
  expect(options.detail).toHaveBeenCalledTimes(1)
})

it('crosses pages and returns the matching page for further continuous review', async () => {
  const options = base()
  options.list.mockResolvedValueOnce({ items: [row('a'), row('b', 'queued'), row('c', 'ignored')], total: 4 })
    .mockResolvedValueOnce({ items: [row('d')], total: 4 })
  const next = await findNextReview(options)
  expect(next?.page).toBe(2)
  expect(next?.job.id).toBe('d')
  expect(options.list).toHaveBeenLastCalledWith(2)
})

it('skips a job already reviewed by someone else and never approves anything', async () => {
  const options = base()
  options.detail.mockResolvedValue(row('c', 'queued'))
  expect(await findNextReview(options)).toBeNull()
})

it('does not replace the visible job after the filter or dialog changes', async () => {
  const options = base()
  let active = true
  options.active = () => active
  options.list.mockImplementation(async () => { active = false; return { items: [row('c')], total: 1 } })
  expect(await findNextReview(options)).toBeNull()
  expect(options.detail).not.toHaveBeenCalled()
})

it('ends at the last matching page and does not wrap back to the first', async () => {
  const options = base()
  options.page = 3
  options.list.mockResolvedValue({ items: [], total: 6 })
  expect(await findNextReview(options)).toBeNull()
  expect(options.list).toHaveBeenCalledTimes(1)
  expect(options.list).toHaveBeenCalledWith(1)
})

it('finds a successor moved to an earlier page by concurrent approvals', async () => {
  const options = { ...base(), rows: [row('c'), row('d')], currentId: 'c', page: 2, pageSize: 2 }
  options.list.mockResolvedValue({ items: [row('b'), row('d')], total: 2 })
  expect((await findNextReview(options))?.job.id).toBe('d')
  expect(options.detail).toHaveBeenCalledExactlyOnceWith('d')
})

it('finds unseen successors after the old last row without returning earlier jobs', async () => {
  const options = { ...base(), rows: [row('b'), row('c')], currentId: 'c', page: 2, pageSize: 2 }
  options.list.mockResolvedValue({ items: [row('a'), row('d')], total: 2 })
  expect((await findNextReview(options))?.job.id).toBe('d')
})

it('rescans when pages shrink during the search', async () => {
  const options = { ...base(), currentId: 'c', pageSize: 2 }
  options.list.mockResolvedValueOnce({ items: [row('a'), row('b')], total: 4 })
    .mockResolvedValueOnce({ items: [], total: 2 })
    .mockResolvedValueOnce({ items: [row('b'), row('d')], total: 2 })
  expect((await findNextReview(options))?.job.id).toBe('d')
  expect(options.list.mock.calls.map(call => call[0])).toEqual([1, 2, 1])
})

it('preserves microsecond order and the API text-ID tie breaker', async () => {
  const anchor = { ...row('b'), created_at: '2026-10-10T00:00:00.123456Z' }
  const newer = { ...row('c'), created_at: '2026-10-10T08:00:00.123457+08:00' }
  const older = { ...row('a'), created_at: anchor.created_at }
  const options = { ...base(), rows: [anchor] }
  options.list.mockResolvedValue({ items: [newer, older], total: 2 })
  expect((await findNextReview(options))?.job.id).toBe('a')
})
