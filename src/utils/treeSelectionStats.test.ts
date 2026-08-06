import { describe, expect, it } from 'vitest'

import {
  countFilteredTreeLeaves,
  filterTreeByAccountPresence,
  filteredTreeLeaves,
  mergeFilteredTreeSelection,
  toggleFilteredTreeSelection,
} from './treeSelectionStats'

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

  it('返回当前搜索真正可见的叶子节点', () => {
    expect(filteredTreeLeaves(groups, 'provider-003').map((item) => item.label)).toEqual([
      '窗口 C',
    ])
    expect(filteredTreeLeaves(groups, '韩国').map((item) => item.label)).toEqual([
      '窗口 A',
      '窗口 B',
    ])
  })

  it('搜索后分组全选只更新可见节点并保留隐藏选择', () => {
    expect(
      mergeFilteredTreeSelection(['slot-3'], ['slot-1', 'slot-2', 'slot-3'], [
        'slot-1',
        'slot-2',
      ]),
    ).toEqual(['slot-3', 'slot-1', 'slot-2'])
    expect(
      mergeFilteredTreeSelection(['slot-1', 'slot-2', 'slot-3'], [], ['slot-1', 'slot-2']),
    ).toEqual(['slot-3'])
  })

  it('搜索后再次点击已全选的分组可以反选可见节点', () => {
    expect(
      toggleFilteredTreeSelection(['slot-hidden', 'slot-1', 'slot-2'], ['slot-1', 'slot-2']),
    ).toEqual(['slot-hidden'])
    expect(
      toggleFilteredTreeSelection(['slot-hidden', 'slot-1'], ['slot-1', 'slot-2']),
    ).toEqual(['slot-hidden', 'slot-1', 'slot-2'])
  })

  it('按设备是否绑定账号筛选并移除空分组', () => {
    const accountGroups = [
      {
        label: '混合设备',
        deviceCount: 2,
        children: [
          { label: '有号设备', hasAccount: true },
          { label: '无号设备', hasAccount: false },
        ],
      },
      {
        label: '仅无号设备',
        deviceCount: 1,
        children: [{ label: '空窗口', hasAccount: false }],
      },
    ]

    expect(
      filterTreeByAccountPresence(accountGroups, 'bound').map((group) => ({
        label: group.label,
        children: group.children?.map((child) => child.label),
      })),
    ).toEqual([{ label: '混合设备', children: ['有号设备'] }])
    expect(countFilteredTreeLeaves(filterTreeByAccountPresence(accountGroups, 'unbound'), '')).toBe(2)
    expect(filterTreeByAccountPresence(accountGroups, 'all')).toBe(accountGroups)
  })
})
