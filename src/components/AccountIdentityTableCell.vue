<script setup lang="ts">
import { AlertTriangle, CheckCircle2, MonitorSmartphone, UserRound } from 'lucide-vue-next'
import { computed } from 'vue'

import type { IdentityPlatformSummary } from '@/api/accountIdentities'
import StatusBadge from '@/components/StatusBadge.vue'
import { businessPlatformLabel } from '@/config/options'
import type { AnyRecord } from '@/types/api'

type CellKind = 'loginIdentity' | 'identityPlatforms' | 'identitySessions' | 'identityCandidate'

const props = defineProps<{
  kind: CellKind
  row: AnyRecord
}>()

const summaries = computed<IdentityPlatformSummary[]>(() => (
  Array.isArray(props.row.platform_summaries) ? props.row.platform_summaries : []
))
const identityName = computed(() => String(
  props.row.display_name || props.row.login_username || `登录身份 #${props.row.id}`,
))
const loginUsername = computed(() => String(props.row.login_username || '').trim())
const boundSummaries = computed(() => summaries.value.filter((item) => item.session_id && item.slot_id))
</script>

<template>
  <div v-if="kind === 'loginIdentity'" class="identity-cell identity-main">
    <span class="identity-main__icon"><UserRound /></span>
    <span class="identity-main__content">
      <strong>{{ identityName }}</strong>
      <small v-if="loginUsername">{{ loginUsername }}</small>
      <small>{{ Number(row.account_count || 0) }} 个平台账号<span v-if="row.country"> · {{ row.country }}</span></small>
    </span>
  </div>

  <div v-else-if="kind === 'identityPlatforms'" class="identity-cell platform-list">
    <div v-for="item in summaries" :key="item.account_id" class="platform-list__row">
      <el-tag size="small" effect="plain">{{ businessPlatformLabel(item.business_platform) }}</el-tag>
      <span class="platform-list__name">{{ item.display_name || item.username || `账号 #${item.account_id}` }}</span>
      <StatusBadge :value="item.health_status" />
      <StatusBadge :value="item.login_status || 'not_logged_in'" />
    </div>
    <span v-if="!summaries.length" class="identity-empty">暂无可见平台账号</span>
  </div>

  <div v-else-if="kind === 'identitySessions'" class="identity-cell session-summary">
    <div class="session-summary__count">
      <MonitorSmartphone />
      <strong>{{ Number(row.active_session_count || 0) }}</strong>
      <span>/ {{ Number(row.account_count || 0) }} 已绑定</span>
    </div>
    <div v-if="boundSummaries.length" class="session-summary__devices">
      <span v-for="item in boundSummaries" :key="item.account_id">
        {{ businessPlatformLabel(item.business_platform) }} · {{ item.slot_name || `设备 #${item.slot_id}` }}
      </span>
    </div>
    <span v-else class="identity-empty">暂无设备会话</span>
  </div>

  <div v-else class="identity-cell candidate-state">
    <span v-if="row.has_pending_candidate" class="candidate-state__pending">
      <AlertTriangle />待确认
    </span>
    <span v-else class="candidate-state__clear">
      <CheckCircle2 />无待处理
    </span>
  </div>
</template>

<style scoped>
.identity-cell { min-width: 0; }
.identity-main { display: flex; align-items: center; gap: 10px; }
.identity-main__icon { display: inline-flex; width: 34px; height: 34px; flex: 0 0 34px; align-items: center; justify-content: center; border: 1px solid #cfe1f2; border-radius: 8px; color: #245f87; background: #edf6fc; }
.identity-main__icon svg { width: 17px; height: 17px; }
.identity-main__content { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.identity-main__content strong,
.identity-main__content small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.identity-main__content strong { color: #243b53; font-size: 13px; }
.identity-main__content small { color: #7b8da0; font-size: 10px; }
.platform-list { display: flex; flex-direction: column; gap: 6px; }
.platform-list__row { display: grid; grid-template-columns: 82px minmax(86px, 1fr) auto auto; align-items: center; gap: 6px; }
.platform-list__name { overflow: hidden; color: #40566c; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.platform-list__row :deep(.el-tag) { justify-self: start; }
.session-summary { display: flex; flex-direction: column; gap: 5px; }
.session-summary__count { display: flex; align-items: center; gap: 5px; color: #52697e; font-size: 11px; }
.session-summary__count svg { width: 14px; height: 14px; color: #39749a; }
.session-summary__count strong { color: #1f5f87; font-size: 14px; }
.session-summary__devices { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.session-summary__devices span { overflow: hidden; color: #7b8da0; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.identity-empty { color: #9aa9b8; font-size: 11px; }
.candidate-state { display: flex; justify-content: center; }
.candidate-state > span { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; }
.candidate-state svg { width: 13px; height: 13px; }
.candidate-state__pending { color: #b7791f; }
.candidate-state__clear { color: #51806a; }
</style>
