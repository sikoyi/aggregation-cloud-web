<script setup lang="ts">
import { AlertTriangle, CalendarClock, CheckCircle2, CircleOff, CircleX, ExternalLink, Eye, FileCheck2, Heart, Image as ImageIcon, Link2, ListChecks, MessageCircle, Monitor, Share2, UserRound } from 'lucide-vue-next'
import { computed } from 'vue'

import type { AnyRecord } from '@/types/api'

type PublishedContentCellKind =
  | 'publishedContentIdentity'
  | 'publishedContentPublisher'
  | 'publishedContentAccount'
  | 'publishedContentDevice'
  | 'publishedContentLink'
  | 'publishedContentMetrics'
  | 'publishedContentTimeline'
  | 'publishedTaskIdentity'
  | 'publishedTaskResult'
  | 'publishedTaskOutput'

const props = defineProps<{
  kind: PublishedContentCellKind
  row: AnyRecord
}>()

function text(value: unknown, fallback = '-') {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

function compactDate(value: unknown) {
  if (!value) return '-'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  const part = (number: number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())} ${part(date.getHours())}:${part(date.getMinutes())}`
}

const title = computed(() => text(props.row.title || props.row.content_title_snapshot, '未填写标题'))
const body = computed(() => text(props.row.text_content, '暂无正文'))
const mediaCount = computed(() => Array.isArray(props.row.media_urls) ? props.row.media_urls.length : 0)
const accountName = computed(() => text(
  props.row.author_display_name
    || props.row.author_username
    || props.row.author_account_name
    || props.row.author_login_username
    || props.row.account_name_snapshot,
  '未知账号',
))
const accountSecondary = computed(() => {
  const username = text(props.row.author_username, '')
  const login = text(props.row.author_login_username, '')
  if (username && username !== accountName.value) return `@${username}`
  if (login && login !== accountName.value) return login
  return ''
})
const slotName = computed(() => text(
  props.row.publish_slot_name || props.row.slot_name_snapshot,
  props.row.task_status === 'draft' ? '等待分配设备' : '设备名称未记录',
))
const providerSlotId = computed(() => text(props.row.publish_provider_slot_id || props.row.provider_slot_id_snapshot, ''))
const contentUrl = computed(() => text(props.row.content_url, ''))
const platformContentId = computed(() => text(props.row.platform_content_id, ''))
const publishedAt = computed(() => compactDate(props.row.published_at || props.row.created_at))
const taskTotal = computed(() => Number(props.row.child_total || 0))
const taskFinished = computed(() => Number(props.row.child_finished || 0))
const taskSucceeded = computed(() => Number(props.row.child_succeeded || 0))
const taskFailed = computed(() => Number(props.row.child_failed || 0))
const taskCanceled = computed(() => Number(props.row.child_canceled || 0))
const taskPending = computed(() => Number(props.row.pending_count || 0))
const taskActive = computed(() => Number(props.row.active_count || 0))
const isAccountPool = computed(() => props.row.dispatch_mode === 'account_pool')
const taskProgress = computed(() => taskTotal.value > 0
  ? Math.min(100, Math.round(taskFinished.value * 100 / taskTotal.value))
  : 0)
const publishedCount = computed(() => Number(props.row.published_count || 0))
const linkedCount = computed(() => Number(props.row.linked_count || 0))
const monitorState = computed(() => text(props.row.monitor_state, 'not_configured'))
const monitorUnavailable = computed(() => monitorState.value !== 'monitoring')
const monitorUnavailableLabel = computed(() => (
  monitorState.value === 'abnormal' ? '数据监听异常' : '未开启数据监听'
))
const monitorUnavailableHint = computed(() => (
  monitorState.value === 'abnormal' ? '互动数据可能不是最新' : '开启后展示互动数据'
))

const metrics = computed(() => [
  { key: 'view', label: '浏览', value: Number(props.row.view_count || 0), icon: Eye },
  { key: 'like', label: '点赞', value: Number(props.row.like_count || 0), icon: Heart },
  { key: 'comment', label: '评论', value: Number(props.row.comment_count || 0), icon: MessageCircle },
  { key: 'share', label: '分享', value: Number(props.row.share_count || 0), icon: Share2 },
])
</script>

<template>
  <div v-if="kind === 'publishedTaskIdentity'" class="published-cell published-task-identity">
    <el-tooltip :content="title" placement="top" :show-after="500">
      <strong>{{ title }}</strong>
    </el-tooltip>
    <el-tag v-if="isAccountPool" size="small" type="primary" effect="plain" round>帐号池轮转</el-tag>
  </div>

  <div v-else-if="kind === 'publishedContentIdentity'" class="published-cell published-content">
    <div class="published-content__title">
      <strong>{{ title }}</strong>
      <span v-if="mediaCount" class="published-content__media"><ImageIcon />{{ mediaCount }}</span>
    </div>
    <el-tooltip :content="body" placement="top" :show-after="500">
      <p>{{ body }}</p>
    </el-tooltip>
  </div>

  <div
    v-else-if="['publishedContentPublisher', 'publishedContentAccount', 'publishedContentDevice'].includes(kind)"
    class="published-cell published-publisher"
  >
    <div v-if="kind !== 'publishedContentDevice'" class="published-publisher__row">
      <UserRound />
      <span><strong>{{ accountName }}</strong><small v-if="accountSecondary">{{ accountSecondary }}</small></span>
    </div>
    <div v-if="kind !== 'publishedContentAccount'" class="published-publisher__row published-publisher__row--secondary">
      <Monitor />
      <span><strong>{{ slotName }}</strong><small v-if="providerSlotId">{{ providerSlotId }}</small></span>
    </div>
  </div>

  <div v-else-if="kind === 'publishedContentLink'" class="published-cell published-link">
    <el-link v-if="contentUrl" :href="contentUrl" target="_blank" rel="noopener noreferrer" type="primary" :underline="false">
      <ExternalLink />
      <strong>打开帖子</strong>
    </el-link>
    <el-tag v-else type="danger" effect="plain" size="small">链接未上报</el-tag>
    <small v-if="platformContentId" :title="platformContentId">ID {{ platformContentId }}</small>
  </div>

  <div
    v-else-if="kind === 'publishedContentMetrics' && monitorUnavailable"
    class="published-cell published-monitor-state"
    :class="{ 'is-abnormal': monitorState === 'abnormal' }"
  >
    <component :is="monitorState === 'abnormal' ? AlertTriangle : CircleOff" />
    <span>
      <strong>{{ monitorUnavailableLabel }}</strong>
      <small>{{ monitorUnavailableHint }}</small>
    </span>
  </div>

  <div v-else-if="kind === 'publishedContentMetrics'" class="published-cell published-metrics">
    <span v-for="item in metrics" :key="item.key">
      <component :is="item.icon" />
      <small>{{ item.label }}</small>
      <strong>{{ item.value }}</strong>
    </span>
  </div>

  <div v-else-if="kind === 'publishedTaskResult'" class="published-cell published-task-result">
    <div class="published-task-result__progress">
      <span><ListChecks />完成 <strong>{{ taskFinished }}</strong>/{{ taskTotal }}</span>
      <el-progress :percentage="taskProgress" :show-text="false" :stroke-width="6" />
    </div>
    <div class="published-task-result__counts">
      <span class="is-success"><CheckCircle2 />成功 <strong>{{ taskSucceeded }}</strong></span>
      <span class="is-failed"><CircleX />失败 <strong>{{ taskFailed }}</strong></span>
      <span v-if="isAccountPool && taskActive">执行中 <strong>{{ taskActive }}</strong></span>
      <span v-if="isAccountPool && taskPending">待分配 <strong>{{ taskPending }}</strong></span>
      <span v-if="taskCanceled" class="is-canceled">取消 <strong>{{ taskCanceled }}</strong></span>
    </div>
  </div>

  <div v-else-if="kind === 'publishedTaskOutput'" class="published-cell published-task-output">
    <span><FileCheck2 /><small>帖子上报</small><strong>{{ publishedCount }}/{{ taskSucceeded }}</strong></span>
    <span :class="{ 'has-missing': linkedCount < taskSucceeded }"><Link2 /><small>有效链接</small><strong>{{ linkedCount }}</strong></span>
  </div>

  <div v-else class="published-cell published-time">
    <CalendarClock />
    <strong>{{ publishedAt }}</strong>
  </div>
</template>

<style scoped>
.published-cell { width: 100%; min-width: 0; max-width: 100%; overflow: hidden; }
.published-task-identity { display: flex; align-items: center; justify-content: center; gap: 6px; }
.published-task-identity > strong { display: block; overflow: hidden; color: #243b53; font-size: 13px; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
.published-content { display: flex; flex-direction: column; gap: 6px; }
.published-content__title { display: flex; min-width: 0; align-items: center; gap: 8px; }
.published-content__title > strong { overflow: hidden; color: #243b53; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.published-content__media { display: inline-flex; flex: 0 0 auto; align-items: center; gap: 3px; color: #527a98; font-size: 11px; }
.published-content__media svg { width: 13px; height: 13px; }
.published-content p { display: -webkit-box; overflow: hidden; margin: 0; color: #6b7f93; font-size: 12px; line-height: 18px; overflow-wrap: anywhere; word-break: break-word; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.published-publisher { display: flex; flex-direction: column; gap: 7px; }
.published-publisher__row { display: flex; min-width: 0; align-items: center; gap: 7px; }
.published-publisher__row > svg { width: 14px; height: 14px; flex: 0 0 14px; color: #39749a; }
.published-publisher__row > span { display: flex; min-width: 0; flex-direction: column; gap: 1px; }
.published-publisher__row strong, .published-publisher__row small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.published-publisher__row strong { color: #334e68; font-size: 12px; }
.published-publisher__row small { color: #8a9aab; font-size: 10px; }
.published-publisher__row--secondary > svg { color: #7b8c9d; }
.published-link { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
.published-link :deep(.el-link__inner) { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.published-link :deep(svg) { width: 14px; height: 14px; }
.published-link small { overflow: hidden; max-width: 100%; color: #8293a5; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.published-metrics { display: grid; grid-template-columns: repeat(2, minmax(88px, 1fr)); gap: 5px 8px; }
.published-metrics > span {
  display: grid;
  min-width: 0;
  grid-template-columns: 14px minmax(30px, 1fr) auto;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-radius: 5px;
  color: #60778d;
  background: #f5f8fb;
}
.published-metrics svg { width: 13px; height: 13px; }
.published-metrics small { font-size: 11px; }
.published-metrics strong { color: #263f55; font-size: 12px; }
.published-monitor-state {
  display: flex;
  min-height: 60px;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 8px 12px;
  border-radius: 5px;
  color: #7b8794;
  background: #f5f8fb;
}
.published-monitor-state > svg { width: 17px; height: 17px; flex: 0 0 17px; }
.published-monitor-state > span { display: flex; flex-direction: column; gap: 2px; }
.published-monitor-state strong { color: #526578; font-size: 12px; }
.published-monitor-state small { color: #8a9aab; font-size: 10px; }
.published-monitor-state.is-abnormal { color: #c47b2a; background: #fff8ed; }
.published-monitor-state.is-abnormal strong { color: #9a5e1d; }
.published-monitor-state.is-abnormal small { color: #b27a3b; }
.published-time { display: flex; align-items: center; justify-content: center; gap: 7px; color: #40566c; white-space: nowrap; }
.published-time svg { width: 14px; height: 14px; color: #527a98; }
.published-time strong { font-size: 11px; }
.published-task-result { display: flex; flex-direction: column; gap: 7px; }
.published-task-result__progress { display: grid; grid-template-columns: auto minmax(70px, 1fr); align-items: center; gap: 10px; }
.published-task-result__progress > span,
.published-task-result__counts > span,
.published-task-output > span { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.published-task-result__progress > span { color: #526a7f; font-size: 11px; }
.published-task-result svg,
.published-task-output svg { width: 13px; height: 13px; flex: 0 0 13px; }
.published-task-result__counts { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; font-size: 11px; }
.published-task-result__counts strong,
.published-task-output strong { font-size: 12px; }
.published-task-result__counts .is-success { color: #3e7c55; }
.published-task-result__counts .is-failed { color: #c04b4b; }
.published-task-result__counts .is-canceled { color: #7c8794; }
.published-task-output { display: flex; flex-direction: column; gap: 8px; }
.published-task-output > span { color: #527a98; }
.published-task-output small { min-width: 54px; color: #73879a; font-size: 11px; }
.published-task-output strong { color: #263f55; }
.published-task-output .has-missing,
.published-task-output .has-missing small,
.published-task-output .has-missing strong { color: #c04b4b; }
</style>
