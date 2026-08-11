import { describe, expect, it } from 'vitest'

import {
  buildDefaultQuickEntryPreferences,
  moveQuickEntryPreference,
  normalizeQuickEntryPreferences,
} from '@/utils/dashboardQuickEntries'

const defaultIds = ['slots', 'media-assets', 'published-contents', 'interaction-sessions']

describe('工作台快捷入口偏好', () => {
  it('默认展示全部入口', () => {
    expect(buildDefaultQuickEntryPreferences(defaultIds)).toEqual([
      { id: 'slots', visible: true },
      { id: 'media-assets', visible: true },
      { id: 'published-contents', visible: true },
      { id: 'interaction-sessions', visible: true },
    ])
  })

  it('恢复保存顺序并自动补充新增入口', () => {
    expect(normalizeQuickEntryPreferences(defaultIds, {
      entries: [
        { id: 'interaction-sessions', visible: false },
        { id: 'slots', visible: true },
        { id: 'removed-entry', visible: true },
        { id: 'slots', visible: false },
      ],
    })).toEqual([
      { id: 'interaction-sessions', visible: false },
      { id: 'slots', visible: true },
      { id: 'media-assets', visible: true },
      { id: 'published-contents', visible: true },
    ])
  })

  it('支持调整入口顺序且不修改原数组', () => {
    const original = buildDefaultQuickEntryPreferences(defaultIds)
    const moved = moveQuickEntryPreference(original, 'media-assets', -1)
    expect(moved.map((item) => item.id)).toEqual([
      'media-assets',
      'slots',
      'published-contents',
      'interaction-sessions',
    ])
    expect(original.map((item) => item.id)).toEqual(defaultIds)
  })
})
