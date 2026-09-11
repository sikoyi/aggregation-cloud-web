<script setup lang="ts">
import { RefreshCw } from 'lucide-vue-next'
import type { AccountStatisticKey, AccountStatistics } from '@/composables/useAccountStatistics'

defineProps<{
  counts: AccountStatistics | null
  loading: boolean
  failed: boolean
  active: AccountStatisticKey
}>()
defineEmits<{ select: [key: AccountStatisticKey]; retry: [] }>()
const metrics: { key: AccountStatisticKey; label: string; hint: string; tone?: string }[] = [
  { key: 'total', label: '平台账号', hint: '当前筛选范围内的平台账号数，多平台分别计数' },
  { key: 'online', label: '在线账号', hint: '已登录，且绑定设备在线', tone: 'green' },
  { key: 'logged_in', label: '已登录', hint: '包含在线账号及已登录但设备离线的账号', tone: 'teal' },
  { key: 'not_logged_in', label: '未登录', hint: '包含未登录和会话过期' },
  { key: 'banned', label: '封号', hint: '登录状态为封禁', tone: 'red' },
  { key: 'verification_required', label: '待验证', hint: '需要二次验证或安全挑战', tone: 'amber' },
  { key: 'unknown', label: '未知', hint: '尚未确认登录状态' },
  { key: 'exported', label: '已导出', hint: '身份凭据已导出的平台账号，与登录状态分别统计' },
]
</script>

<template>
  <section class="account-statistics" aria-label="平台账号统计" :aria-busy="loading">
    <div class="account-statistics__metrics">
      <el-tooltip v-for="metric in metrics" :key="metric.key" :content="metric.hint" placement="top">
        <button type="button" class="account-statistics__metric"
          :class="[metric.tone, { 'is-active': active === metric.key }]"
          :aria-pressed="active === metric.key" :data-status="metric.key"
          @click="$emit('select', metric.key)">
          <span class="account-statistics__label">{{ metric.label }}</span>
          <strong class="account-statistics__count">{{ counts ? counts[metric.key].toLocaleString() : '-' }}</strong>
        </button>
      </el-tooltip>
    </div>
    <div v-if="failed" class="account-statistics__error" role="status">
      统计暂不可用
      <el-tooltip content="重新加载统计">
        <el-button :icon="RefreshCw" circle size="small" aria-label="重新加载统计" @click="$emit('retry')" />
      </el-tooltip>
    </div>
  </section>
</template>

<style scoped>
.account-statistics { border-bottom: 1px solid var(--el-border-color-lighter); }
.account-statistics__metrics { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 4px; }
.account-statistics__metric {
  display: flex; flex-direction: column; gap: 7px; align-items: flex-start;
  min-width: 0; min-height: 86px; padding: 12px 16px; border: 0; border-bottom: 3px solid transparent;
  background: transparent; text-align: left; color: var(--el-text-color-primary); cursor: pointer;
}
.account-statistics__metric:hover { background: var(--el-fill-color-light); }
.account-statistics__metric.is-active { border-bottom-color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.account-statistics__metric:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: -2px; }
.account-statistics__label { font-size: 13px; color: var(--el-text-color-regular); overflow-wrap: anywhere; }
.account-statistics__count { font-size: 24px; line-height: 30px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.green .account-statistics__count { color: #168451; }
.teal .account-statistics__count { color: #16818b; }
.red .account-statistics__count { color: #c3424b; }
.amber .account-statistics__count { color: #a36b0c; }
.account-statistics__error { display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 4px 12px; color: var(--el-text-color-secondary); font-size: 12px; }
@media (max-width: 1200px) { .account-statistics__metrics { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
@media (max-width: 480px) { .account-statistics__metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
