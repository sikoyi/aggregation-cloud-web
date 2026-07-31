/**
 * 根据当前分组和用户手动折叠记录，计算本次应该展开的分组。
 * 组件销毁后折叠集合会自然释放，因此重新打开弹窗仍默认全部展开。
 */
export function reconcileExpandedGroupKeys(
  groupIds: string[],
  collapsedGroupIds: Set<string>,
) {
  const currentGroupIds = new Set(groupIds)
  collapsedGroupIds.forEach((groupId) => {
    if (!currentGroupIds.has(groupId)) collapsedGroupIds.delete(groupId)
  })
  return groupIds.filter((groupId) => !collapsedGroupIds.has(groupId))
}
