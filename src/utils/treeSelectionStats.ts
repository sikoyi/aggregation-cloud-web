export interface SearchableTreeNode {
  label?: string
  searchText?: string
}

export type AccountPresenceFilter = 'all' | 'bound' | 'unbound'

export interface AccountAwareTreeNode extends SearchableTreeNode {
  hasAccount?: boolean
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
 * 仅按叶子节点过滤树，分组名称不参与关键词匹配。
 */
export function filterTreeByLeafKeyword<
  T extends SearchableTreeNode,
  G extends SearchableTreeGroup<T>,
>(groups: G[], keyword: unknown): G[] {
  const normalizedKeyword = String(keyword || '').trim().toLowerCase()
  if (!normalizedKeyword) return groups

  return groups
    .map((group) => ({
      ...group,
      children: (group.children || []).filter(
        (child) => matchesKeyword(child, normalizedKeyword),
      ),
    }))
    .filter((group) => Boolean(group.children?.length)) as G[]
}

export function filterTreeByAccountPresence<
  T extends AccountAwareTreeNode,
  G extends SearchableTreeGroup<T>,
>(groups: G[], filter: AccountPresenceFilter): G[] {
  if (filter === 'all') return groups

  const hasAccount = filter === 'bound'
  return groups
    .map((group) => ({
      ...group,
      children: (group.children || []).filter(
        (child) => Boolean(child.hasAccount) === hasAccount,
      ),
    }))
    .filter((group) => Boolean(group.children?.length)) as G[]
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

/**
 * 搜索时分组节点会因隐藏成员保持半选，需按可见成员的实际选择状态切换。
 */
export function toggleFilteredTreeSelection(selectedIds: string[], targetIds: string[]) {
  const selectedIdSet = new Set(selectedIds)
  const targetIdSet = new Set(targetIds)
  const allSelected = targetIds.length > 0 && targetIds.every((id) => selectedIdSet.has(id))

  if (allSelected) {
    return selectedIds.filter((id) => !targetIdSet.has(id))
  }
  return [...selectedIds, ...targetIds.filter((id) => !selectedIdSet.has(id))]
}
