import type { AnyRecord } from '@/types/api'
import type { RemoteSelectGroupConfig } from '@/types/crud'

export const REMOTE_GROUP_ALL = '__all__'
export const REMOTE_GROUP_UNGROUPED = '__ungrouped__'

export function applyRemoteGroupFilter(
  params: AnyRecord,
  selectedGroup: string,
  config?: RemoteSelectGroupConfig,
) {
  if (!config || selectedGroup === REMOTE_GROUP_ALL) return { ...params }
  if (selectedGroup === REMOTE_GROUP_UNGROUPED) {
    return {
      ...params,
      [config.ungroupedParam || 'ungrouped']: true,
    }
  }
  return {
    ...params,
    [config.groupParam || 'group_id']: selectedGroup,
  }
}
