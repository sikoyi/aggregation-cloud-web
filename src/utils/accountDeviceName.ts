import type { AnyRecord } from '@/types/api'

export function accountDeviceName(account: AnyRecord) {
  const name = typeof account.bound_slot_name === 'string' ? account.bound_slot_name.trim() : ''
  const providerId = String(account.bound_slot_provider_id ?? '').trim()
  if (name && name !== providerId) return name
  return providerId || name || account.bound_slot_id || account.slot_group_id ? '未命名设备' : '未绑定设备'
}
