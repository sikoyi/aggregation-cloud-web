<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ExternalLink, RefreshCw } from 'lucide-vue-next'
import { http } from '@/api/http'

interface Conflict { status: string; message?: string; account?: { id: string; display_name?: string; username?: string; business_platform: string; profile_url?: string } }
const props = defineProps<{ accountId: string; errorMessage: string }>()
const result = ref<Conflict | null>(null)
const loading = ref(false)
const failed = ref(false)
const refresh = ref(0)
const profileUrl = computed(() => {
  try {
    const url = new URL(result.value?.account?.profile_url || '')
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch { return '' }
})
watch(() => [props.accountId, props.errorMessage, refresh.value], async (_, __, onCleanup) => {
  let stale = false
  onCleanup(() => { stale = true })
  result.value = null
  failed.value = false
  loading.value = false
  if (!props.accountId || props.errorMessage !== '采集帖子已关联其他系统账号') return
  loading.value = true
  try {
    const data = await http.get<Conflict>(`/api/accounts/${encodeURIComponent(props.accountId)}/monitor-content-conflict`)
    if (!stale) result.value = data
  } catch { if (!stale) failed.value = true }
  finally { if (!stale) loading.value = false }
}, { immediate: true })
</script>

<template>
  <div v-if="loading || failed || (result && result.status !== 'none')" class="monitor-conflict" aria-live="polite">
    <span v-if="loading">正在读取关联账号…</span>
    <template v-else-if="failed"><span>关联账号暂时无法读取</span><el-button text :icon="RefreshCw" @click="refresh++">重试</el-button></template>
    <template v-else-if="result?.account">
      <span>关联账号：</span><strong>{{ result.account.display_name || result.account.username || '未设置昵称' }}</strong>
      <span v-if="result.account.username">@{{ result.account.username.replace(/^@/, '') }}</span>
      <span>{{ result.account.business_platform }} · ID {{ result.account.id }}</span>
      <a v-if="profileUrl" :href="profileUrl" target="_blank" rel="noopener noreferrer"><ExternalLink :size="14" />查看账号主页</a>
    </template>
    <span v-else>{{ result?.message }}</span>
  </div>
</template>

<style scoped>
.monitor-conflict { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin-top: 8px; font-size: 13px; line-height: 22px; overflow-wrap: anywhere; color: var(--el-text-color-regular); }
.monitor-conflict > * { min-width: 0; max-width: 100%; }
.monitor-conflict a { display: inline-flex; align-items: center; gap: 4px; color: var(--el-color-primary); }
</style>
