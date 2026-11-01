import type { ExternalMonitor, ExternalMonitorOwnership, ExternalMonitorOperator } from '@/types/externalMonitor'

interface Actor { user: { id: string } | null; isSuperAdmin: boolean }

export function hasExternalMonitorOperator(row: ExternalMonitorOwnership) {
  return Object.prototype.hasOwnProperty.call(row, 'operator_id') && row.operator_id !== undefined
}

export function canMaintainExternalMonitor(row: ExternalMonitorOwnership, actor: Actor) {
  return actor.isSuperAdmin || Boolean(actor.user?.id && hasExternalMonitorOperator(row) && row.operator_id === actor.user.id)
}

export function canManageExternalPersona(row: ExternalMonitor, actor: Actor) {
  if (actor.isSuperAdmin) return true
  if (row.can_manage_persona === false) return false
  if (!row.is_persona) return canMaintainExternalMonitor(row, actor) && (!row.persona || row.can_manage_persona === true)
  const members = row.children || []
  const complete = row.can_manage_persona === true || members.length === row.persona?.member_count
  return complete && members.length > 0 && members.every(member => canMaintainExternalMonitor(member, actor))
}

export function externalOperatorOptionLabel(operator: ExternalMonitorOperator) {
  const label = operator.display_name || operator.username || operator.id
  return operator.assignable ? label : `${label}（不可分配）`
}

export function externalMonitorOperatorLabel(row: ExternalMonitorOwnership & { is_persona?: boolean; children?: ExternalMonitor[]; persona?: { member_count?: number } }): string {
  if (row.is_persona) {
    const members = row.children || []
    const labels = [...new Set(members.map(member => externalMonitorOperatorLabel(member)))]
    const label = labels.join('、') || '未知'
    return (row.persona?.member_count || 0) > members.length ? `当前匹配：${label}` : label
  }
  if (!hasExternalMonitorOperator(row)) return '未知'
  if (row.operator_id === null) return '未分配'
  const label = row.operator_name || row.operator_username || row.operator_id || '未知'
  return row.operator_status && row.operator_status !== 'active' ? `${label}（已停用）` : label
}
