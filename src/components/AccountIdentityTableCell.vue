<script setup lang="ts">
import { AlertTriangle, CheckCircle2, MonitorSmartphone, Tags } from 'lucide-vue-next'
import { computed } from 'vue'

import type { IdentityPlatformSummary } from '@/api/accountIdentities'
import StatusBadge from '@/components/StatusBadge.vue'
import { businessPlatformLabel } from '@/config/options'
import type { AnyRecord } from '@/types/api'
import { matchedPlatformSummaries } from '@/utils/accountIdentitySelection'

type CellKind = 'loginIdentity' | 'identityTags' | 'identityPlatforms' | 'identitySessions' | 'identityCandidate'

const props = defineProps<{
  kind: CellKind
  row: AnyRecord
}>()

const summaries = computed<IdentityPlatformSummary[]>(() => (
  Array.isArray(props.row.platform_summaries) ? props.row.platform_summaries : []
))
const loginUsername = computed(() => String(props.row.login_username || '').trim())
const identityLabel = computed(() => loginUsername.value || `登录身份 #${props.row.id}`)
const matched = computed(() => Array.isArray(props.row.matched_account_ids) ? matchedPlatformSummaries(props.row) : summaries.value)
const matchedIds = computed(() => new Set(matched.value.map((item) => String(item.account_id))))
const identityTags = computed(() => {
  const seen = new Set<string>()
  const values: string[] = []
  for (const summary of matched.value) {
    for (const rawTag of Array.isArray(summary.tag_names) ? summary.tag_names : []) {
      const tag = String(rawTag).trim()
      if (!tag || seen.has(tag)) continue
      seen.add(tag)
      values.push(tag)
    }
  }
  return values
})
const boundSummaries = computed(() => summaries.value.filter((item) => item.session_id && item.slot_id))
</script>

<template>
  <div v-if="kind === 'loginIdentity'" class="identity-cell identity-main">
    <span class="identity-main__content">
      <span class="identity-main__heading">
        <el-tooltip v-if="loginUsername" :content="loginUsername" placement="top">
          <strong>{{ identityLabel }}</strong>
        </el-tooltip>
        <strong v-else>{{ identityLabel }}</strong>
        <el-tag v-if="row.credentials_exported_at" size="small" type="warning" effect="plain">已导出</el-tag>
      </span>
      <small>ID {{ row.id }} · {{ Number(row.account_count || 0) }} 个平台账号<span v-if="matched.length < summaries.length"> · 匹配 {{ matched.length }} 个</span><span v-if="row.country"> · {{ row.country }}</span></small>
      <el-tag v-if="Number(row.binding_conflict_count || 0) > 0" class="identity-main__conflict" size="small" type="warning" effect="plain">
        绑定冲突 {{ row.binding_conflict_count }}
      </el-tag>
    </span>
  </div>

  <div v-else-if="kind === 'identityTags'" class="identity-cell identity-tags">
    <el-tag
      v-for="tag in identityTags.slice(0, 2)"
      :key="tag"
      type="primary"
      effect="plain"
      round
      class="identity-tag"
    >
      <Tags />
      <span>{{ tag }}</span>
    </el-tag>
    <el-tooltip v-if="identityTags.length > 2" :content="identityTags.slice(2).join('、')" placement="top">
      <el-tag type="info" effect="plain" round>+{{ identityTags.length - 2 }}</el-tag>
    </el-tooltip>
    <el-tag v-if="!identityTags.length" type="info" effect="plain" round>暂无标签</el-tag>
  </div>

  <div v-else-if="kind === 'identityPlatforms'" class="identity-cell platform-list">
    <div v-for="item in summaries" :key="item.account_id" class="platform-list__row" :class="{ 'platform-list__row--outside': !matchedIds.has(item.account_id) }">
      <el-tag size="small" effect="plain">{{ businessPlatformLabel(item.business_platform) }}</el-tag>
      <StatusBadge :value="item.login_status || 'unknown'" />
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
.identity-main__content { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 2px; }
.identity-main__heading { display: flex; min-width: 0; align-items: center; gap: 6px; }
.identity-main__heading strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.identity-main__heading :deep(.el-tag) { flex: 0 0 auto; }
.identity-main__content strong,
.identity-main__content small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.identity-main__content strong { color: #243b53; font-size: 13px; }
.identity-main__conflict { align-self: flex-start; }
.identity-main__content small { color: #7b8da0; font-size: 10px; }
.identity-tags { display: flex; flex-wrap: wrap; gap: 5px; }
.identity-tag { display: inline-flex; max-width: 100%; align-items: center; overflow: hidden; white-space: nowrap; }
.identity-tag :deep(.el-tag__content) { display: inline-flex; min-width: 0; align-items: center; gap: 4px; overflow: hidden; }
.identity-tag svg { width: 12px; height: 12px; flex: 0 0 12px; }
.identity-tag span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.platform-list { display: flex; flex-direction: column; gap: 6px; }
.platform-list__row { display: grid; grid-template-columns: minmax(82px, 1fr) auto; align-items: center; gap: 6px; }
.platform-list__row :deep(.el-tag) { justify-self: start; }
.platform-list__row--outside { opacity: 0.55; }
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
