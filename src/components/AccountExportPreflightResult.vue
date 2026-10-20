<script setup lang="ts">
import { computed } from 'vue'
import { CircleCheck, CircleX, Clock3 } from 'lucide-vue-next'
import type { AccountExportPreflightItem } from '@/api/accountExport'
import { businessPlatformLabel } from '@/config/options'

const props = defineProps<{ item: AccountExportPreflightItem }>()
const state = computed(() => !props.item.local_eligible ? 'blocked' : props.item.email_check === 'unverified' ? 'pending' : 'ready')
const labels = { blocked: '不可导出', pending: '本地检查通过 · 邮箱待验证', ready: '可导出' }
const icons = { blocked: CircleX, pending: Clock3, ready: CircleCheck }
const notes = computed(() => {
  const groups = new Map<string, { platform: string; fields: string[] }>()
  const other: string[] = []
  const fields: Record<string, string> = { login_username: '登录账号', password: '密码', twofa: '2FA', profile_url: '主页链接' }
  for (const issue of props.item.warnings) {
    const platform = issue.business_platform ? businessPlatformLabel(issue.business_platform) : ''
    if (issue.code === 'missing_field' && issue.field && fields[issue.field]) {
      const key = `${issue.account_id || ''}:${issue.business_platform || ''}`
      const group = groups.get(key) || { platform, fields: [] }
      if (!group.fields.includes(fields[issue.field])) group.fields.push(fields[issue.field])
      groups.set(key, group)
    } else {
      other.push(`${platform ? `${platform}：` : ''}${issue.message}`)
    }
  }
  return [...Array.from(groups.values(), group => `${group.platform ? `${group.platform}：` : ''}${group.fields.join('、')}未设置，将留空导出`), ...other]
})
</script>

<template>
  <div class="preflight-result">
    <div class="preflight-result__status" :class="`preflight-result__status--${state}`">
      <component :is="icons[state]" :size="16" aria-hidden="true" />
      <strong>{{ labels[state] }}</strong>
    </div>
    <ul v-if="item.blocking_reasons.length" class="preflight-result__blocks">
      <li v-for="(issue, index) in item.blocking_reasons" :key="index">{{ issue.business_platform ? `${businessPlatformLabel(issue.business_platform)}：` : '' }}{{ issue.message }}</li>
    </ul>
    <p v-if="item.email_check === 'unverified'" class="preflight-result__pending">邮箱资料尚未验证，提交时仍可能失败。</p>
    <div v-if="notes.length" class="preflight-result__notes">
      <span class="preflight-result__caption">非阻断提示</span>
      <p v-for="(note, index) in notes" :key="index">{{ note }}</p>
    </div>
  </div>
</template>

<style scoped>
.preflight-result { min-width: 0; padding: 4px 0; line-height: 1.6; overflow-wrap: anywhere; }
.preflight-result__status { display: flex; align-items: flex-start; gap: 6px; }
.preflight-result__status svg { flex-shrink: 0; margin-top: 3px; }
.preflight-result__status--ready { color: var(--el-color-success-dark-2); }
.preflight-result__status--blocked, .preflight-result__blocks { color: var(--el-color-danger-dark-2); }
.preflight-result__status--pending, .preflight-result__pending { color: var(--el-color-warning-dark-2); }
.preflight-result__blocks { margin: 6px 0 0; padding-left: 20px; }
.preflight-result__pending { margin: 6px 0 0; }
.preflight-result__notes { margin-top: 8px; color: var(--el-text-color-regular); font-size: 12px; }
.preflight-result__caption { color: var(--el-text-color-secondary); }
.preflight-result__notes p { margin: 2px 0 0; }
</style>
