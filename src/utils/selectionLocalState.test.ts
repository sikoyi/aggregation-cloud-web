import { describe, expect, it } from 'vitest'
import { parseSelectionMarks, selectionDateRange, selectionMarkQuery, selectionStorageKey } from './selectionLocalState'

describe('browser-local selection marks', () => {
  it('isolates tenant and user without ambiguous separators', () => {
    expect(selectionStorageKey('tenant', 'a')).not.toBe(selectionStorageKey('tenant', 'b'))
    expect(selectionStorageKey('a:b', 'c')).not.toBe(selectionStorageKey('a', 'b:c'))
  })
  it.each([null, 'broken', 'null', '[]'])('recovers invalid stored state %s', value => {
    expect(parseSelectionMarks(value)).toEqual({ read: [], saved: [] })
  })
  it('deduplicates and ignores invalid IDs', () => {
    expect(parseSelectionMarks(JSON.stringify({ read: ['1', '1', null, '', 2], saved: ['2'] }))).toEqual({ read: ['1'], saved: ['2'] })
  })
  it('does not interpret empty favorites as all posts', () => {
    expect(selectionMarkQuery({ read: [], saved: [] }, 'saved', false)).toEqual({ include_ids: [], exclude_ids: [] })
  })
  it('combines favorites and unread, but read mode never excludes itself', () => {
    const marks = { read: ['1'], saved: ['1', '2'] }
    expect(selectionMarkQuery(marks, 'saved', true)).toEqual({ include_ids: ['2'], exclude_ids: ['1'] })
    expect(selectionMarkQuery(marks, 'read', true)).toEqual({ include_ids: ['1'], exclude_ids: [] })
    expect(selectionMarkQuery(marks, 'unread', false)).toEqual({ include_ids: null, exclude_ids: ['1'] })
  })
  it('uses calendar-day boundaries for yesterday', () => {
    const now = new Date(2026, 9, 12, 12)
    const range = selectionDateRange('yesterday', now)!
    expect(new Date(range[0]).getDate()).toBe(11)
    expect(new Date(range[0]).getHours()).toBe(0)
    expect(new Date(range[1]).getHours()).toBe(23)
    expect(new Date(range[1]).getMilliseconds()).toBe(999)
    expect(selectionDateRange('', now)).toBeNull()
    expect(selectionDateRange('bad', now)).toBeNull()
  })
})
