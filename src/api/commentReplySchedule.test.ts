import { expect, it } from 'vitest'
import { scheduleWindows, validReplyWindows } from './commentReplySchedule'

it('preserves legacy minute windows and copies range settings', () => {
  expect(scheduleWindows({ times: ['23:59'] })).toEqual([{ start: '23:59', end: '00:00' }])
  expect(scheduleWindows({ times: ['09:00'], windows: [] })).toEqual([])
})

it('validates overnight windows, adjacency, overlap and equal endpoints', () => {
  expect(validReplyWindows([{ start: '22:00', end: '02:00' }, { start: '02:00', end: '09:00' }])).toBe(true)
  expect(validReplyWindows([{ start: '22:00', end: '02:00' }, { start: '01:00', end: '03:00' }])).toBe(false)
  expect(validReplyWindows([{ start: '09:00', end: '09:00' }])).toBe(false)
  expect(validReplyWindows([])).toBe(false)
})
