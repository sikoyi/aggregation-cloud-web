<script setup lang="ts">
import { computed } from 'vue'
import MonitorErrorStatus from '@/components/MonitorErrorStatus.vue'
import { monitorCollectionResult, monitorRuleLabel } from '@/utils/monitorError'
import type { AnyRecord } from '@/types/api'

const props = withDefaults(defineProps<{ account: AnyRecord; details?: boolean }>(), { details: true })
const result = computed(() => monitorCollectionResult(props.account))
const ruleType = computed(() => props.account.monitor_state === 'monitoring' ? 'primary' as const : 'info' as const)
</script>

<template>
  <span class="account-monitor-status">
    <el-tag size="small" :type="ruleType" effect="light">{{ monitorRuleLabel(account.monitor_state) }}</el-tag>
    <template v-if="account.monitor_setting_id || account.monitor_state && account.monitor_state !== 'not_configured'">
      <MonitorErrorStatus
        v-if="result.failed && details"
        :label="result.label"
        :data="{ ...account, last_error_message: result.reason, last_failed_at: result.time }"
      />
      <el-tag v-else size="small" :type="result.type" effect="light">{{ result.label }}</el-tag>
    </template>
  </span>
</template>

<style scoped>
.account-monitor-status { display: inline-flex; flex-wrap: wrap; align-items: center; justify-content: inherit; gap: 4px; max-width: 100%; }
</style>
