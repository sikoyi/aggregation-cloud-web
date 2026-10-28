<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock3, RefreshCw } from 'lucide-vue-next'
import { contentSelection, type SelectionSyncProgress } from '@/api/contentSelection'
import type { AnyRecord } from '@/types/api'

const props = defineProps<{ query: AnyRecord; settingsVersion: number; active: boolean }>()
const progress = ref<SelectionSyncProgress | null>(null)
const loading = ref(false)
const error = ref('')
const expanded = ref(false)
const scope = computed(() => ({
  countries: [...new Set((props.query.countries || []) as string[])].sort(),
  tag_ids: [...new Set((props.query.tag_ids || []) as string[])].sort(),
  country_unset: !!props.query.country_unset,
  untagged: !!props.query.untagged,
  platform: props.query.platform || null,
  source_id: props.query.source_id || null,
}))
const scopeKey = computed(() => JSON.stringify([scope.value, props.settingsVersion]))
const percent = computed(() => {
  const index = progress.value?.index
  if (!index?.originals) return 0
  return index.indexed >= index.originals ? 100 : Math.min(99.9, Math.floor(index.indexed / index.originals * 1000) / 10)
})
const status = computed(() => {
  const p = progress.value
  if (!p) return '等待进度'
  if (!p.scope.monitor_count && !p.scope.source_count) return '当前范围没有来源账号'
  if (!p.index.ready) return '全库索引初始化中'
  if (p.metrics.running) return '浏览量补采中'
  if (p.index.pending) return '索引更新中'
  if (p.metrics.pending || p.metrics.retry) return '补采排队中'
  if (p.daily.pending) return p.daily.state === 'running' ? '公共日同步执行中' : '等待日同步'
  if (p.metrics.failed || p.metrics.unavailable || p.metrics.no_views || p.index.unplanned) return '部分数据未就绪'
  return '当前范围无待处理任务'
})
const attention = computed(() => {
  const p = progress.value
  return !!(error.value || p && (p.metrics.failed || p.metrics.unavailable || p.metrics.no_views || p.index.unplanned))
})
const number = (value: number) => value.toLocaleString('zh-CN')
function time(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' }) : '时间未知'
}

let timer: ReturnType<typeof setTimeout> | undefined
let controller: AbortController | undefined
let generation = 0
let disposed = false
function stop() {
  generation++
  clearTimeout(timer)
  controller?.abort()
  controller = undefined
  loading.value = false
}
function visible() {
  return props.active && document.visibilityState === 'visible' && !disposed
}
async function refresh() {
  if (!visible() || loading.value) return
  clearTimeout(timer)
  const request = ++generation
  const key = scopeKey.value
  const abort = new AbortController()
  controller = abort
  loading.value = true
  const timeout = setTimeout(() => abort.abort(), 12000)
  try {
    const result = await contentSelection.syncProgress(scope.value, abort.signal)
    if (request !== generation || key !== scopeKey.value || !visible()) return
    progress.value = result
    error.value = ''
  } catch (cause) {
    if (request !== generation || key !== scopeKey.value || !visible()) return
    error.value = abort.signal.aborted ? '进度查询超时' : cause instanceof Error ? cause.message : '进度更新失败'
  } finally {
    clearTimeout(timeout)
    if (request === generation) {
      controller = undefined
      loading.value = false
      if (visible()) timer = setTimeout(refresh, 15000)
    }
  }
}
function resume() {
  stop()
  if (visible()) timer = setTimeout(refresh, 250)
}
watch(scopeKey, () => {
  progress.value = null
  error.value = ''
  resume()
})
watch(() => props.active, resume)
onMounted(() => {
  document.addEventListener('visibilitychange', resume)
  resume()
})
onBeforeUnmount(() => {
  disposed = true
  stop()
  document.removeEventListener('visibilitychange', resume)
})
</script>

<template>
  <section class="sync-progress" aria-label="当前来源同步进度" :aria-busy="loading">
    <header class="sync-header">
      <div class="sync-heading">
        <strong>来源同步</strong>
        <span class="sync-status" :class="{ 'is-warning': attention }" role="status">
          <AlertTriangle v-if="attention" :size="14" />
          <Clock3 v-else-if="!progress || status !== '当前范围无待处理任务'" :size="14" />
          <CheckCircle2 v-else :size="14" />
          {{ status }}
        </span>
      </div>
      <div class="sync-actions">
        <span v-if="progress" class="sync-muted">{{ time(progress.snapshot_at) }} 更新</span>
        <el-tooltip content="刷新同步进度" placement="top"><el-button :icon="RefreshCw" circle text :loading="loading" :disabled="!active || loading" aria-label="刷新同步进度" @click="refresh" /></el-tooltip>
        <el-button text :icon="expanded ? ChevronUp : ChevronDown" :aria-expanded="expanded" @click="expanded = !expanded">{{ expanded ? '收起' : '详情' }}</el-button>
      </div>
    </header>
    <p v-if="error" class="sync-error" role="alert">{{ error }}<span v-if="progress">，以下为上次快照</span></p>
    <template v-if="progress">
      <div class="sync-overview">
        <div class="sync-index">
          <div class="sync-index-label"><span>原帖索引就绪</span><strong>{{ number(progress.index.indexed) }} / {{ number(progress.index.originals) }}</strong><span v-if="progress.index.originals" class="sync-muted">{{ percent }}%</span></div>
          <el-progress :percentage="percent" :show-text="false" :stroke-width="5" />
        </div>
        <dl class="sync-totals">
          <div><dt>已达门槛</dt><dd>{{ number(progress.index.over_threshold) }}</dd></div>
          <div><dt>待补采</dt><dd>{{ number(progress.metrics.pending) }}</dd></div>
          <div><dt>处理中</dt><dd>{{ number(progress.metrics.running) }}</dd></div>
          <div><dt>待重试</dt><dd>{{ number(progress.metrics.retry) }}</dd></div>
        </dl>
      </div>
      <p v-if="progress.index.unplanned" class="sync-notice">{{ number(progress.index.unplanned) }} 篇原帖尚未就绪且暂无处理任务，不在同步队列中。</p>
      <p v-if="progress.metrics.failed || progress.metrics.unavailable || progress.metrics.no_views" class="sync-notice">
        <span v-if="progress.metrics.failed">补采失败 {{ number(progress.metrics.failed) }} 篇</span>
        <span v-if="progress.metrics.unavailable">帖子不可用 {{ number(progress.metrics.unavailable) }} 篇</span>
        <span v-if="progress.metrics.no_views">上游未提供浏览量 {{ number(progress.metrics.no_views) }} 篇</span>
      </p>
      <div v-if="expanded" class="sync-details">
        <dl>
          <div><dt>当前来源范围</dt><dd>{{ number(progress.scope.monitor_count) }} 个监听账号 · {{ number(progress.scope.source_count) }} 个选题来源</dd></div>
          <div><dt>外部已采集</dt><dd>{{ number(progress.collected_posts) }} 篇</dd></div>
          <div><dt>待日同步处理</dt><dd>{{ number(progress.daily.pending) }} 篇</dd></div>
          <div><dt>索引待更新</dt><dd>{{ number(progress.index.pending) }} 篇</dd></div>
          <div v-if="progress.index.unplanned === null"><dt>未就绪且无待办</dt><dd>待办量较大，暂不统计</dd></div>
          <div v-if="progress.scope.monitor_count || progress.scope.source_count"><dt>日同步公共计划</dt><dd>{{ progress.daily.state === 'running' ? '正在执行' : progress.daily.state === 'overdue' ? '等待补执行' : '下次 ' + time(progress.daily.next_run_at) }}（北京时间 06:00）</dd></div>
          <div v-if="progress.daily.last_completed_at"><dt>最近日同步完成</dt><dd>{{ time(progress.daily.last_completed_at) }}</dd></div>
        </dl>
      </div>
    </template>
    <p v-else class="sync-muted sync-empty">{{ loading ? '正在读取当前来源进度…' : error ? '本次未获取到进度' : '等待读取当前来源进度' }}</p>
  </section>
</template>

<style scoped>
.sync-progress { border-block: 1px solid var(--app-border); padding: 12px 0; color: var(--app-text); font-size: 13px; }
.sync-header, .sync-heading, .sync-actions, .sync-index-label { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; min-width: 0; }
.sync-header { justify-content: space-between; gap: 8px; }
.sync-status { display: inline-flex; align-items: center; gap: 5px; color: var(--el-color-primary); }
.sync-status.is-warning, .sync-notice { color: var(--el-color-warning); }
.sync-actions { gap: 4px; }
.sync-actions :deep(.el-button + .el-button) { margin-left: 0; }
.sync-muted, dt { color: var(--app-text-muted); }
.sync-overview { display: grid; grid-template-columns: minmax(200px, 1fr) minmax(360px, 1fr); align-items: center; gap: 24px; margin-top: 10px; }
.sync-index-label { justify-content: flex-start; margin-bottom: 8px; gap: 8px; }
.sync-index-label strong { margin-left: auto; }
strong, dd { font-variant-numeric: tabular-nums; }
.sync-totals { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 0; gap: 12px; }
.sync-totals dd { font-size: 16px; font-weight: 600; margin-top: 3px; }
dd { margin: 0; overflow-wrap: anywhere; }
.sync-notice, .sync-error, .sync-empty { margin: 10px 0 0; line-height: 1.6; overflow-wrap: anywhere; }
.sync-notice span + span::before { content: ' · '; }
.sync-error { color: var(--el-color-danger); }
.sync-details { margin-top: 12px; border-top: 1px solid var(--app-border); padding-top: 10px; }
.sync-details dl { margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 24px; }
.sync-details dl > div { display: flex; gap: 10px; align-items: baseline; }
.sync-details dt { flex-shrink: 0; }
@media (max-width: 760px) {
  .sync-overview { grid-template-columns: minmax(0, 1fr); gap: 14px; }
  .sync-details dl { grid-template-columns: minmax(0, 1fr); }
  .sync-actions { justify-content: flex-end; width: 100%; }
  .sync-totals { gap: 6px; }
}
</style>
