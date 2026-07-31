import { describe, expect, it } from 'vitest'

import { countFilteredTreeLeaves } from './treeSelectionStats'

describe('树形选择器数量统计', () => {
  const groups = [
    {
      label: '韩国设备',
      searchText: '韩国设备',
      children: [
        { label: '窗口 A', searchText: '窗口 a provider-001' },
        { label: '窗口 B', searchText: '窗口 b provider-002' },
      ],
    },
    {
      label: '日本设备',
      searchText: '日本设备',
      children: [
        { label: '窗口 C', searchText: '窗口 c provider-003' },
      ],
    },
  ]

  it('没有关键词时统计当前分组中的全部成员', () => {
    expect(countFilteredTreeLeaves(groups, '')).toBe(3)
    expect(countFilteredTreeLeaves(groups.slice(0, 1), '')).toBe(2)
  })

  it('关键词命中成员或分组时使用相同统计口径', () => {
    expect(countFilteredTreeLeaves(groups, 'provider-003')).toBe(1)
    expect(countFilteredTreeLeaves(groups, '韩国')).toBe(2)
    expect(countFilteredTreeLeaves(groups, '不存在')).toBe(0)
  })
})