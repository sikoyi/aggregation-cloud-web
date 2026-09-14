import type { ResourceConfig } from '@/types/crud'

const order = [
  'business_platform', 'runtime_platform', 'provider',
  'account_id', 'login_username', 'bound_account_id', 'keyword', 'country', 'tag_id', 'account_age_type',
  'slot_group_id', 'group_id', 'bound_slot_name', 'display_name', 'provider_slot_id', 'proxy_id',
  'status', 'login_status', 'account_login_status', 'bound_state', 'account_presence',
  'has_binding_conflict', 'candidate_status', 'export_status', 'warmup_status', 'warmup_plan_id',
]

export function managementFilters(config: Pick<ResourceConfig, 'key' | 'filters'>) {
  const filters = config.filters || []
  if (!['accounts', 'accountIdentities', 'slots'].includes(config.key)) return filters
  const rank = (key: string) => {
    const index = order.indexOf(key)
    return index < 0 ? order.length : index
  }
  return [...filters].sort((left, right) => rank(left.key) - rank(right.key))
}
