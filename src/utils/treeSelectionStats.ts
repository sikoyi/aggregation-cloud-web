export interface SearchableTreeNode {
  label?: string
  searchText?: string
  children?: SearchableTreeNode[]
}

function matchesKeyword(node: SearchableTreeNode, keyword: string) {
  return String(node.searchText || node.label || '').toLowerCase().includes(keyword)
}

/**
 * 统计分组筛选和关键词搜索后仍展示的叶子节点数量。
 * 搜索命中分组名称时，该分组内的全部成员都计入当前结果。
 */
export function countFilteredTreeLeaves(
  groups: SearchableTreeNode[],
  keyword: unknown,
) {
  const normalizedKeyword = String(keyword || '').trim().toLowerCase()
  return groups.reduce((count, group) => {
    const children = group.children || []
    if (!normalizedKeyword || matchesKeyword(group, normalizedKeyword)) {
      return count + children.length
    }
    return count + children.filter((child) => matchesKeyword(child, normalizedKeyword)).length
  }, 0)
}