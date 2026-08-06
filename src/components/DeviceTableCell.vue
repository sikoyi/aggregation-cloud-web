<script setup lang="ts">
import { Clock3, Cpu, Layers3, MonitorSmartphone, Network, UserRound } from 'lucide-vue-next'
import { computed } from 'vue'

import StatusBadge from '@/components/StatusBadge.vue'
import { businessPlatformOptions, providerOptions, runtimePlatformOptions } from '@/config/options'
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

function text(value: unknown) {
  return value === undefined || value === null || value === '' ? '-' : String(value)
}

function optionLabel(options: Array<{ label: string; value: unknown }>, value: unknown) {
  return options.find((item) => String(item.value) === String(value))?.label || text(value)
}

const deviceName = computed(() => String(props.row.display_name || props.row.provider_slot_no || props.row.provider_slot_id || '-'))
const deviceId = computed(() => text(props.row.provider_slot_id))
const providerNumber = computed(() => String(props.row.provider_slot_no || '').trim())
const groupName = computed(() => String(props.row.group_name || '').trim())
const runtimePlatform = computed(() => optionLabel(runtimePlatformOptions, props.row.runtime_platform))
const provider = computed(() => optionLabel(providerOptions, props.row.provider))
const accountBusinessPlatform = computed(() => optionLabel(businessPlatformOptions, props.row.bound_account_business_platform))
const accountCountry = computed(() => String(props.row.bound_account_country || '').trim())
const accountName = computed(() => String(props.row.bound_account_name || '').trim())
const proxyName = computed(() => String(props.row.proxy_name || '').trim())
const proxyUrl = computed(() => String(props.row.proxy_source_url || '').trim())
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

  <div v-else-if="kind === 'deviceGroup'" class="device-cell">
    <el-tag v-if="groupName" type="primary" effect="plain" round class="device-group-tag">
      <Layers3 />
      <span>{{ groupName }}</span>
    </el-tag>
    <el-tag v-else type="info" effect="plain" round>未分组</el-tag>
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
    <div class="device-state__row">
      <span>设备</span>
      <div class="device-state__value">
        <StatusBadge :value="row.status" />
      </div>
    </div>
    <div v-if="row.bound_account_id" class="device-state__row">
      <span>账号</span>
      <StatusBadge :value="row.bound_account_login_status || row.login_status" />
    </div>
  </div>

  <div v-else-if="kind === 'deviceAccount'" class="device-cell device-relation">
    <template v-if="row.bound_account_id">
      <div class="device-relation__title">
        <UserRound />
        <strong>{{ accountName || `账号 #${row.bound_account_id}` }}</strong>
      </div>
      <div class="device-relation__meta">
        <el-tag v-if="row.bound_account_business_platform" size="small" type="primary" effect="light">
          {{ accountBusinessPlatform }}
        </el-tag>
        <el-tag v-if="accountCountry" size="small" type="info" effect="plain">{{ accountCountry }}</el-tag>
      </div>
      <small>账号 ID {{ row.bound_account_id }}</small>
    </template>
    <span v-else class="device-relation__empty">未绑定账号</span>
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
.device-identity__icon { display: inline-flex; width: 36px; height: 36px; flex: 0 0 36px; align-items: center; justify-content: center; border: 1px solid #cfe1f2; border-radius: 8px; color: #245f87; background: #edf6fc; }
.device-identity__icon svg { width: 18px; height: 18px; }
.device-identity__content { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.device-identity__content strong,
.device-identity__content code,
.device-identity__content small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.device-identity__content strong { color: #243b53; font-size: 13px; }
.device-identity__content code { color: #28719f; font-size: 11px; }
.device-identity__content small { color: #8a9aab; font-size: 10px; }
.device-group-tag { display: inline-flex; max-width: 100%; align-items: center; overflow: hidden; }
.device-group-tag :deep(.el-tag__content) { display: inline-flex; min-width: 0; align-items: center; gap: 4px; overflow: hidden; }
.device-group-tag svg { width: 12px; height: 12px; flex: 0 0 12px; }
.device-group-tag span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.device-platform { display: flex; flex-direction: column; gap: 7px; }
.device-platform__primary { display: flex; align-items: center; gap: 6px; color: #334e68; }
.device-platform__primary svg { width: 14px; height: 14px; color: #527a98; }
.device-platform__primary strong { font-size: 12px; }
.device-platform__tags { display: flex; gap: 5px; }
.device-state { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.device-state__row { display: grid; min-width: 118px; grid-template-columns: 30px minmax(0, 1fr); align-items: center; gap: 6px; }
.device-state__row > span { color: #8191a2; font-size: 10px; }
.device-state__value { display: flex; min-width: 0; align-items: center; gap: 5px; }
.device-relation { display: flex; min-width: 0; flex-direction: column; gap: 4px; }
.device-relation__title { display: flex; min-width: 0; align-items: center; gap: 6px; }
.device-relation__title svg { width: 14px; height: 14px; flex: 0 0 14px; color: #527a98; }
.device-relation__title strong,
.device-relation code,
.device-relation small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.device-relation__title strong { color: #334e68; font-size: 12px; }
.device-relation__meta { display: flex; min-width: 0; flex-wrap: wrap; align-items: center; gap: 4px; }
.device-relation code { color: #66788a; font-size: 10px; }
.device-relation small { color: #8a9aab; font-size: 10px; }
.device-relation__empty { color: #9aa9b8; font-size: 12px; }
.device-activity { display: flex; min-width: 158px; align-items: center; justify-content: center; gap: 8px; }
.device-activity__icon { display: inline-flex; width: 28px; height: 28px; flex: 0 0 28px; align-items: center; justify-content: center; border: 1px solid #cde8d6; border-radius: 7px; color: #31845a; background: #f0faf4; }
.device-activity__icon svg { width: 14px; height: 14px; }
.device-activity strong { color: #334e68; font-size: 12px; font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; }
</style>
