import { describe, expect, it } from 'vitest'

import {
  countFilteredTreeLeaves,
  filterTreeByAccountPresence,
  filterTreeByAccountTag,
  filterTreeByLeafKeyword,
  filteredTreeLeaves,
  mergeFilteredTreeSelection,
  toggleFilteredTreeSelection,
} from './treeSelectionStats'

describe('轮转账号标签筛选', () => {
  const groups = [
    { label: 'A', accountCount: 3, children: [
      { label: 'one', tagIds: ['1', '2'] },
      { label: 'two', tagIds: ['2'], disabled: true },
      { label: 'three' },
    ] },
    { label: 'B', accountCount: 1, children: [{ label: 'four', tagIds: ['1'] }] },
  ]

  it('清空标签恢复原始分组，不修改源数据', () => {
    expect(filterTreeByAccountTag(groups, '')).toBe(groups)
    expect(filterTreeByAccountTag(groups, '1').map((group) => group.accountCount)).toEqual([1, 1])
    expect(groups[0].accountCount).toBe(3)
    expect(groups[0].children).toHaveLength(3)
  })

  it('按 ID 匹配多标签账号，移除空组并保留不可选状态', () => {
    const result = filterTreeByAccountTag(groups, '2')
    expect(result).toHaveLength(1)
    expect(result[0].children.map((child) => child.label)).toEqual(['one', 'two'])
    expect(result[0].children[1].disabled).toBe(true)
    expect(filterTreeByAccountTag(groups, 'missing')).toEqual([])
    expect(filterTreeByAccountTag([], '1')).toEqual([])
  })

  it('标签与分组、关键词取交集', () => {
    const result = filterTreeByAccountTag(groups.slice(0, 1), '1')
    expect(countFilteredTreeLeaves(result, 'one')).toBe(1)
    expect(countFilteredTreeLeaves(result, 'four')).toBe(0)
  })

  it('筛选下勾选或取消账号保留其他标签中已选账号', () => {
    const visible = filterTreeByAccountTag(groups, '2').flatMap((g) => g.children.map((c) => c.label))
    expect(mergeFilteredTreeSelection(['four'], ['one'], visible)).toEqual(['four', 'one'])
    expect(mergeFilteredTreeSelection(['four', 'one'], [], visible)).toEqual(['four'])
  })
})

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

  it('设备搜索只匹配叶子节点并移除空分组', () => {
    expect(
      filterTreeByLeafKeyword(groups, 'provider-003').map((group) => ({
        label: group.label,
        children: group.children?.map((child) => child.label),
      })),
    ).toEqual([{ label: '日本设备', children: ['窗口 C'] }])
    expect(filterTreeByLeafKeyword(groups, '韩国')).toEqual([])
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
