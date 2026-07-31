import { describe, expect, it } from 'vitest'

import { reconcileExpandedGroupKeys } from './treeExpansion'

describe('reconcileExpandedGroupKeys', () => {
  it('默认展开全部当前分组', () => {
    expect(reconcileExpandedGroupKeys(['group:1', 'group:2'], new Set())).toEqual([
      'group:1',
      'group:2',
    ])
  })

  it('刷新数据后保留用户手动折叠的分组', () => {
    const collapsed = new Set(['group:2'])

    expect(reconcileExpandedGroupKeys(['group:1', 'group:2'], collapsed)).toEqual([
      'group:1',
    ])
  })

  it('移除已经不存在的折叠分组记录', () => {
    const collapsed = new Set(['group:2', 'group:deleted'])

    expect(reconcileExpandedGroupKeys(['group:1', 'group:2'], collapsed)).toEqual([
      'group:1',
    ])
    expect(collapsed).toEqual(new Set(['group:2']))
  })
})
