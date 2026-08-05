export interface SearchableTreeNode {
  label?: string
  searchText?: string
}

export interface SearchableTreeGroup<T extends SearchableTreeNode = SearchableTreeNode>
  extends SearchableTreeNode {
  children?: T[]
}

function matchesKeyword(node: SearchableTreeNode, keyword: string) {
  return String(node.searchText || node.label || '').toLowerCase().includes(keyword)
}

/**
 * 返回分组筛选和关键词搜索后仍展示的叶子节点。
 * 搜索命中分组名称时，该分组内的全部成员都属于当前结果。
 */
export function filteredTreeLeaves<T extends SearchableTreeNode>(
  groups: SearchableTreeGroup<T>[],
  keyword: unknown,
) {
  const normalizedKeyword = String(keyword || '').trim().toLowerCase()
  return groups.flatMap((group) => {
    const children = group.children || []
    if (!normalizedKeyword || matchesKeyword(group, normalizedKeyword)) {
      return children
    }
    return children.filter((child) => matchesKeyword(child, normalizedKeyword))
  })
}

export function countFilteredTreeLeaves<T extends SearchableTreeNode>(
  groups: SearchableTreeGroup<T>[],
  keyword: unknown,
) {
  return filteredTreeLeaves(groups, keyword).length
}

/**
 * 只更新当前筛选可见项，筛选范围之外原有的选择保持不变。
 */
export function mergeFilteredTreeSelection(
  selectedIds: string[],
  checkedIds: string[],
  visibleIds: string[],
) {
  const visibleIdSet = new Set(visibleIds)
  return [
    ...selectedIds.filter((id) => !visibleIdSet.has(id)),
    ...checkedIds.filter((id) => visibleIdSet.has(id)),
  ]
}
