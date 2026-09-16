<script setup lang="ts">
import { AlertTriangle, Clock3, Cpu, Layers3, LoaderCircle, MonitorSmartphone, Network } from 'lucide-vue-next'
import { computed } from 'vue'

import StatusBadge from '@/components/StatusBadge.vue'
import { businessPlatformLabel, providerOptions, runtimePlatformOptions } from '@/config/options'
import type { AnyRecord } from '@/types/api'
import type { ColumnConfig } from '@/types/crud'
import { formatDate } from '@/utils/format'

type DeviceCellKind =
  | 'deviceIdentity'
  | 'deviceGroup'
  | 'devicePlatform'
  | 'deviceState'
  | 'deviceAccount'
  | 'deviceProxy'
  | 'deviceActivity'

const props = defineProps<{
  kind: DeviceCellKind
  row: AnyRecord
  column: ColumnConfig
}>()

defineEmits<{ bindingConflicts: [id: string] }>()

function text(value: unknown) {
  return value === undefined || value === null || value === '' ? '-' : String(value)
}

function optionLabel(options: Array<{ label: string; value: unknown }>, value: unknown) {
  return options.find((item) => String(item.value) === String(value))?.label || text(value)
}

const deviceName = computed(() => String(props.row.display_name || props.row.provider_slot_no || props.row.provider_slot_id || '-'))
const deviceId = computed(() => text(props.row.provider_slot_id))
const providerNumber = computed(() => String(props.row.provider_slot_no || '').trim())
const groupName = computed(() => String(props.row.group_name || props.row.name || '').trim())
const groupSyncStatus = computed(() => String(props.row.group_sync_status || '').trim())
const pendingGroupName = computed(() => String(props.row.pending_group_name || props.row.pending_name || '').trim())
const groupSyncPending = computed(() => ['queued', 'sent', 'acknowledged'].includes(groupSyncStatus.value))
const pendingGroupLabel = computed(() => {
  if (pendingGroupName.value) return pendingGroupName.value
  if (props.row.group_control_command_id) return '未分组'
  return ''
})
const runtimePlatform = computed(() => optionLabel(runtimePlatformOptions, props.row.runtime_platform))
const provider = computed(() => optionLabel(providerOptions, props.row.provider))
const proxyName = computed(() => String(props.row.proxy_name || '').trim())
const proxyUrl = computed(() => String(props.row.proxy_source_url || '').trim())
const accountSessions = computed<AnyRecord[]>(() => {
  if (Array.isArray(props.row.account_sessions) && props.row.account_sessions.length) return props.row.account_sessions
  if (!props.row.bound_account_id) return []
  return [{ id: props.row.bound_account_id, account_id: props.row.bound_account_id,
    account_username: props.row.bound_account_name, business_platform: props.row.bound_account_business_platform,
    country: props.row.bound_account_country, login_status: props.row.bound_account_login_status || props.row.login_status }]
})
function accountLabel(session: AnyRecord) {
  return String(session.account_username || session.account_display_name || `账号 #${session.account_id || '-'}`)
}
function accountTooltip(session: AnyRecord) {
  return `${accountLabel(session)} · 账号 ID ${session.account_id || '-'}${session.country ? ` · ${session.country}` : ''}`
}
</script>

<template>
  <div v-if="kind === 'deviceIdentity'" class="device-cell device-identity">
    <span class="device-identity__icon"><MonitorSmartphone /></span>
    <span class="device-identity__content">
      <el-tooltip :content="deviceName" placement="top" :show-after="500">
        <strong>{{ deviceName }}</strong>
      </el-tooltip>
      <el-tooltip :content="deviceId" placement="top" :show-after="500">
        <code>{{ deviceId }}</code>
      </el-tooltip>
      <small v-if="providerNumber && providerNumber !== deviceId">编号 {{ providerNumber }}</small>
    </span>
  </div>

  <div v-else-if="kind === 'deviceGroup'" class="device-cell device-group">
    <el-tag v-if="groupName" type="primary" effect="plain" round class="device-group-tag">
      <Layers3 />
      <span>{{ groupName }}</span>
    </el-tag>
    <el-tag v-else type="info" effect="plain" round>未分组</el-tag>
    <div v-if="groupSyncPending" class="device-group__sync device-group__sync--pending">
      <LoaderCircle class="device-group__spinner" />
      <span>{{ pendingGroupLabel ? `同步至 ${pendingGroupLabel}` : '同步中' }}</span>
    </div>
    <div v-else-if="groupSyncStatus === 'propagating'" class="device-group__sync device-group__sync--propagating">
      <span>其他 Agent 待同步</span>
    </div>
  </div>

  <div v-else-if="kind === 'devicePlatform'" class="device-cell device-platform">
    <div class="device-platform__primary">
      <Cpu />
      <strong>{{ runtimePlatform }}</strong>
    </div>
    <div class="device-platform__tags">
      <el-tag size="small" effect="plain">{{ provider }}</el-tag>
    </div>
  </div>

  <div v-else-if="kind === 'deviceState'" class="device-cell device-state">
    <StatusBadge :value="row.status" />
  </div>

  <div v-else-if="kind === 'deviceAccount'" class="device-cell device-relation">
    <template v-if="accountSessions.length">
      <div v-for="session in accountSessions" :key="String(session.id)" class="device-account-session">
        <el-tag size="small" type="primary" effect="light">{{ businessPlatformLabel(session.business_platform) }}</el-tag>
        <el-tooltip :content="accountTooltip(session)" placement="top" :show-after="500">
          <strong class="device-account-session__name">{{ accountLabel(session) }}</strong>
        </el-tooltip>
        <StatusBadge :value="session.login_status || 'unknown'" />
      </div>
    </template>
    <span v-else class="device-relation__empty">未绑定账号</span>
    <el-button v-if="Number(row.binding_conflict_count || 0) > 0" class="device-conflict-button"
      type="warning" text size="small" :icon="AlertTriangle"
      @click.stop="$emit('bindingConflicts', String(row.id))">
      绑定冲突 {{ row.binding_conflict_count }}
    </el-button>
  </div>

  <div v-else-if="kind === 'deviceProxy'" class="device-cell device-relation">
    <template v-if="row.proxy_id">
      <div class="device-relation__title">
        <Network />
        <strong>{{ proxyName || `代理 #${row.proxy_id}` }}</strong>
      </div>
      <el-tooltip v-if="proxyUrl" :content="proxyUrl" placement="top" :show-after="500">
        <code>{{ proxyUrl }}</code>
      </el-tooltip>
    </template>
    <span v-else class="device-relation__empty">未配置代理</span>
  </div>

  <div v-else-if="kind === 'deviceActivity'" class="device-cell device-activity">
    <span class="device-activity__icon"><Clock3 /></span>
    <strong>{{ formatDate(row.last_seen_at) }}</strong>
  </div>
</template>

<style scoped>
.device-cell { min-width: 0; }
.device-identity { display: flex; align-items: center; gap: 10px; }
.device-identity__icon { display: inline-flex; width: 36px; height: 36px; flex: 0 0 36px; align-items: center; justify-content: center; border: 1px solid var(--app-border, #cfe1f2); border-radius: 8px; color: var(--app-blue, #245f87); background: var(--app-surface-muted, #edf6fc); }
.device-identity__icon svg { width: 18px; height: 18px; }
.device-identity__content { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.device-identity__content strong,
.device-identity__content code,
.device-identity__content small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.device-identity__content strong { color: var(--app-text, #243b53); font-size: 13px; }
.device-identity__content code { color: var(--app-blue, #28719f); font-size: 11px; }
.device-identity__content small { color: var(--app-text-muted, #8a9aab); font-size: 10px; }
.device-group-tag { display: inline-flex; max-width: 100%; align-items: center; overflow: hidden; }
.device-group-tag :deep(.el-tag__content) { display: inline-flex; min-width: 0; align-items: center; gap: 4px; overflow: hidden; }
.device-group-tag svg { width: 12px; height: 12px; flex: 0 0 12px; }
.device-group-tag span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.device-group { display: flex; min-width: 0; flex-direction: column; align-items: flex-start; gap: 5px; }
.device-group__sync { display: inline-flex; max-width: 100%; align-items: center; gap: 4px; font-size: 10px; line-height: 1.3; }
.device-group__sync svg { width: 11px; height: 11px; flex: 0 0 11px; }
.device-group__sync span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.device-group__sync--pending { color: var(--app-blue, #28719f); }
.device-group__sync--propagating { color: var(--app-text-muted, #8494a5); }
.device-conflict-button { align-self: flex-start; }
.device-group__spinner { animation: device-group-spin 1s linear infinite; }
@keyframes device-group-spin { to { transform: rotate(360deg); } }
.device-platform { display: flex; flex-direction: column; gap: 7px; }
.device-platform__primary { display: flex; align-items: center; gap: 6px; color: var(--app-text, #334e68); }
.device-platform__primary svg { width: 14px; height: 14px; color: var(--app-text-muted, #527a98); }
.device-platform__primary strong { font-size: 12px; }
.device-platform__tags { display: flex; gap: 5px; }
.device-state { display: flex; align-items: center; justify-content: center; }
.device-relation { display: flex; min-width: 0; flex-direction: column; gap: 4px; }
.device-account-session { display: grid; min-width: 0; grid-template-columns: 82px minmax(0, 1fr) auto; align-items: center; gap: 8px; min-height: 28px; }
.device-account-session > :deep(.el-tag) { justify-self: start; white-space: nowrap; }
.device-account-session__name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--app-text, #334e68); font-size: 12px; }
.device-relation__title { display: flex; min-width: 0; align-items: center; gap: 6px; }
.device-relation__title svg { width: 14px; height: 14px; flex: 0 0 14px; color: var(--app-text-muted, #527a98); }
.device-relation__title strong,
.device-relation code,
.device-relation small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.device-relation__title strong { color: var(--app-text, #334e68); font-size: 12px; }
.device-relation__meta { display: flex; min-width: 0; flex-wrap: wrap; align-items: center; gap: 4px; }
.device-relation code { color: var(--app-text-muted, #66788a); font-size: 10px; }
.device-relation small { color: var(--app-text-muted, #8a9aab); font-size: 10px; }
.device-relation__empty { color: var(--app-text-muted, #9aa9b8); font-size: 12px; }
.device-activity { display: flex; min-width: 158px; align-items: center; justify-content: center; gap: 8px; }
.device-activity__icon { display: inline-flex; width: 28px; height: 28px; flex: 0 0 28px; align-items: center; justify-content: center; border: 1px solid var(--app-border, #cde8d6); border-radius: 7px; color: var(--app-green, #31845a); background: var(--app-surface-muted, #f0faf4); }
.device-activity__icon svg { width: 14px; height: 14px; }
.device-activity strong { color: var(--app-text, #334e68); font-size: 12px; font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; }
</style>
