<script setup lang="ts">
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Boxes,
  CheckCircle2,
  Clock3,
  FileCode2,
  FileText,
  Image,
  MessageSquareReply,
  PlaySquare,
  RefreshCw,
  RotateCcw,
  Send,
  Server,
  Settings2,
  ShieldCheck,
  Upload,
  Users,
  XCircle,
} from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { http } from '@/api/http'
import StatusBadge from '@/components/StatusBadge.vue'
import { REALTIME_EVENT_NAME, type RealtimeEventPayload } from '@/composables/useRealtimeEvents'
import { useAuthStore } from '@/stores/auth'
import type { AnyRecord } from '@/types/api'
import {
  buildDefaultQuickEntryPreferences,
  moveQuickEntryPreference,
  normalizeQuickEntryPreferences,
  type DashboardQuickEntryPreference,
} from '@/utils/dashboardQuickEntries'
import { formatDate, statusLabel, truncateId } from '@/utils/format'
import {
  buildUserPreferenceKey,
  readRecordPreference,
  writeRecordPreference,
} from '@/utils/localPreferences'
import { notifyError } from '@/utils/notify'

interface DashboardMetric {
  label: string
  value: number
}

interface DashboardOverview {
  today_task_total: number
  running_task_total: number
  succeeded_task_total: number
  failed_task_total: number
  canceled_task_total: number
  online_runtime_total: number
  online_slot_total: number
  abnormal_slot_total: number
  account_total: number
  script_total: number
  proxy_total: number
  recent_tasks: AnyRecord[]
  task_status_metrics: DashboardMetric[]
}

const loading = ref(false)
const error = ref('')
const overview = ref<DashboardOverview | null>(null)
const lastLoadedAt = ref('')
let realtimeRefreshTimer: number | undefined

// 系统入口负责提供稳定路由，运营只在当前浏览器调整显示和顺序。
const defaultQuickEntries = [
  {
    id: 'slots',
    label: '设备管理',
    section: '设备管理',
    to: '/slots',
    icon: Boxes,
    tone: 'orange',
  },
  {
    id: 'media-assets',
    label: '素材库',
    section: '资源中心',
    to: '/media-assets',
    icon: Image,
    tone: 'amber',
  },
  {
    id: 'published-contents',
    label: '发布内容',
    section: '互动中心',
    to: { path: '/published-contents', query: { action: 'create' } },
    icon: FileText,
    tone: 'green',
  },
  {
    id: 'interaction-sessions',
    label: '互动会话',
    section: '互动中心',
    to: { path: '/interaction-sessions', query: { action: 'create' } },
    icon: MessageSquareReply,
    tone: 'violet',
  },
  {
    id: 'tasks',
    label: '下发任务',
    section: '任务中心',
    to: { path: '/tasks', query: { action: 'create' } },
    icon: Send,
    tone: 'blue',
  },
  {
    id: 'accounts',
    label: '导入账号',
    section: '账号中心',
    to: { path: '/accounts', query: { action: 'create' } },
    icon: Upload,
    tone: 'cyan',
  },
  {
    id: 'proxies',
    label: '代理资源',
    section: '资源中心',
    to: '/proxies',
    icon: ShieldCheck,
    tone: 'slate',
  },
  {
    id: 'account-data',
    label: '账号数据',
    section: '账号中心',
    to: '/account-data',
    icon: Users,
    tone: 'indigo',
  },
]
type QuickEntryDefinition = (typeof defaultQuickEntries)[number]

const authStore = useAuthStore()
const defaultQuickEntryIds = defaultQuickEntries.map((entry) => entry.id)
const quickEntryMap = new Map<string, QuickEntryDefinition>(
  defaultQuickEntries.map((entry) => [entry.id, entry]),
)
const quickEntryPreferences = ref<DashboardQuickEntryPreference[]>(
  buildDefaultQuickEntryPreferences(defaultQuickEntryIds),
)
const quickEntryEditor = ref<DashboardQuickEntryPreference[]>([])
const quickEntryDialogVisible = ref(false)
const quickEntryPreferenceKey = computed(() => buildUserPreferenceKey(
  authStore.user?.id,
  'dashboard:quick-entries',
))
const quickEntries = computed(() => quickEntryPreferences.value
  .filter((item) => item.visible)
  .map((item) => quickEntryMap.get(item.id))
  .filter((entry): entry is QuickEntryDefinition => Boolean(entry)))

function loadQuickEntryPreferences() {
  const storedValue = readRecordPreference(window.localStorage, quickEntryPreferenceKey.value)
  quickEntryPreferences.value = normalizeQuickEntryPreferences(defaultQuickEntryIds, storedValue)
}

function openQuickEntryDialog() {
  quickEntryEditor.value = quickEntryPreferences.value.map((item) => ({ ...item }))
  quickEntryDialogVisible.value = true
}

function moveQuickEntry(id: string, direction: -1 | 1) {
  quickEntryEditor.value = moveQuickEntryPreference(quickEntryEditor.value, id, direction)
}

function resetQuickEntryEditor() {
  quickEntryEditor.value = buildDefaultQuickEntryPreferences(defaultQuickEntryIds)
}

function saveQuickEntryPreferences() {
  if (!quickEntryEditor.value.some((item) => item.visible)) {
    ElMessage.warning('至少保留一个快捷入口')
    return
  }
  quickEntryPreferences.value = quickEntryEditor.value.map((item) => ({ ...item }))
  writeRecordPreference(window.localStorage, quickEntryPreferenceKey.value, {
    entries: quickEntryPreferences.value,
  })
  quickEntryDialogVisible.value = false
  ElMessage.success('快捷入口已保存')
}

watch(quickEntryPreferenceKey, loadQuickEntryPreferences, { immediate: true })
const cards = computed(() => {
  const data = overview.value
  return [
    { label: '今日下发', value: data?.today_task_total || 0, icon: PlaySquare, tone: 'blue', hint: '当天创建任务' },
    { label: '运行中', value: data?.running_task_total || 0, icon: Clock3, tone: 'indigo', hint: '正在执行' },
    { label: '成功任务', value: data?.succeeded_task_total || 0, icon: CheckCircle2, tone: 'green', hint: '终态成功' },
    { label: '失败任务', value: data?.failed_task_total || 0, icon: XCircle, tone: 'red', hint: '需要排查' },
    { label: '取消任务', value: data?.canceled_task_total || 0, icon: AlertTriangle, tone: 'amber', hint: '人工取消' },
    { label: '在线 Runtime', value: data?.online_runtime_total || 0, icon: Server, tone: 'cyan', hint: 'Agent 连接' },
    { label: '在线设备', value: data?.online_slot_total || 0, icon: Activity, tone: 'emerald', hint: '可参与调度' },
    { label: '异常设备', value: data?.abnormal_slot_total || 0, icon: AlertTriangle, tone: 'orange', hint: '离线或错误' },
    { label: '账号总数', value: data?.account_total || 0, icon: Users, tone: 'slate', hint: '账号库存' },
    { label: '脚本总数', value: data?.script_total || 0, icon: FileCode2, tone: 'violet', hint: '可配置脚本' },
    { label: '代理总数', value: data?.proxy_total || 0, icon: ShieldCheck, tone: 'slate', hint: '代理资源' },
  ]
})

const summaryRows = computed(() => {
  const data = overview.value
  const finished = (data?.succeeded_task_total || 0) + (data?.failed_task_total || 0) + (data?.canceled_task_total || 0)
  const successRate = finished ? Math.round(((data?.succeeded_task_total || 0) / finished) * 100) : 0
  return [
    {
      label: '任务成功率',
      value: `${successRate}%`,
      detail: `成功 ${data?.succeeded_task_total || 0} / 终态 ${finished}`,
    },
    {
      label: '运行资源',
      value: `${data?.online_slot_total || 0} 台`,
      detail: `在线 Runtime ${data?.online_runtime_total || 0} 个`,
    },
    {
      label: '业务库存',
      value: `${data?.account_total || 0} 个账号`,
      detail: `脚本 ${data?.script_total || 0} / 代理 ${data?.proxy_total || 0}`,
    },
  ]
})

const statusMetrics = computed(() => overview.value?.task_status_metrics || [])
const maxStatusMetric = computed(() => Math.max(1, ...statusMetrics.value.map((item) => item.value)))

async function loadDashboard() {
  loading.value = true
  error.value = ''
  try {
    overview.value = await http.get<DashboardOverview>('/api/dashboard/overview')
    lastLoadedAt.value = new Date().toISOString()
  } catch (err) {
    error.value = notifyError(err, '加载失败', '加载失败')
  } finally {
    loading.value = false
  }
}

function scheduleRealtimeRefresh() {
  if (realtimeRefreshTimer) window.clearTimeout(realtimeRefreshTimer)
  realtimeRefreshTimer = window.setTimeout(() => {
    loadDashboard()
  }, 500)
}

function handleRealtimeEvent(event: Event) {
  const payload = (event as CustomEvent<RealtimeEventPayload>).detail
  if (payload?.topic === 'task' || payload?.topic === 'runtime') scheduleRealtimeRefresh()
}

onMounted(() => {
  loadDashboard()
  window.addEventListener(REALTIME_EVENT_NAME, handleRealtimeEvent)
})

onBeforeUnmount(() => {
  window.removeEventListener(REALTIME_EVENT_NAME, handleRealtimeEvent)
  if (realtimeRefreshTimer) window.clearTimeout(realtimeRefreshTimer)
})
</script>

<template>
  <section class="dashboard-page">
    <div class="dashboard-toolbar">
      <div class="min-w-0">
        <div class="dashboard-eyebrow">工作台</div>
        <h1 class="dashboard-title">运营总览</h1>
        <p class="dashboard-subtitle">实时关注任务执行、Runtime 在线状态和资源库存。</p>
      </div>
      <div class="dashboard-actions">
        <span v-if="lastLoadedAt" class="dashboard-refresh-time">更新于 {{ formatDate(lastLoadedAt) }}</span>
        <el-button type="primary" plain :icon="RefreshCw" :loading="loading" @click="loadDashboard">刷新</el-button>
      </div>
    </div>

    <el-alert v-if="error" class="dashboard-alert" type="error" :title="error" :closable="false" show-icon />

    <section class="quick-entry-section" aria-labelledby="quick-entry-title">
      <div class="quick-entry-heading">
        <div>
          <h2 id="quick-entry-title">快捷入口</h2>
          <p>常用业务</p>
        </div>
        <el-button plain :icon="Settings2" @click="openQuickEntryDialog">自定义</el-button>
      </div>
      <div class="quick-entry-grid">
        <RouterLink
          v-for="entry in quickEntries"
          :key="entry.label"
          :to="entry.to"
          :class="['quick-entry', `quick-entry--${entry.tone}`]"
        >
          <span class="quick-entry__icon">
            <component :is="entry.icon" class="h-5 w-5" />
          </span>
          <span class="quick-entry__content">
            <strong>{{ entry.label }}</strong>
            <small>{{ entry.section }}</small>
          </span>
          <ArrowRight class="quick-entry__arrow h-4 w-4" />
        </RouterLink>
      </div>
    </section>

    <el-dialog
      v-model="quickEntryDialogVisible"
      title="自定义快捷入口"
      width="min(520px, calc(100vw - 32px))"
      append-to-body
      destroy-on-close
    >
      <div class="quick-entry-editor">
        <div
          v-for="(item, index) in quickEntryEditor"
          :key="item.id"
          class="quick-entry-editor__row"
        >
          <el-checkbox v-model="item.visible" class="quick-entry-editor__checkbox">
            <span class="quick-entry-editor__identity">
              <span
                v-if="quickEntryMap.get(item.id)"
                :class="['quick-entry-editor__icon', 'quick-entry--' + quickEntryMap.get(item.id)?.tone]"
              >
                <component :is="quickEntryMap.get(item.id)?.icon" class="h-4 w-4" />
              </span>
              <span class="quick-entry-editor__text">
                <strong>{{ quickEntryMap.get(item.id)?.label }}</strong>
                <small>{{ quickEntryMap.get(item.id)?.section }}</small>
              </span>
            </span>
          </el-checkbox>
          <div class="quick-entry-editor__actions">
            <el-tooltip content="上移" placement="top">
              <el-button
                circle
                text
                :icon="ArrowUp"
                :disabled="index === 0"
                aria-label="上移"
                @click="moveQuickEntry(item.id, -1)"
              />
            </el-tooltip>
            <el-tooltip content="下移" placement="top">
              <el-button
                circle
                text
                :icon="ArrowDown"
                :disabled="index === quickEntryEditor.length - 1"
                aria-label="下移"
                @click="moveQuickEntry(item.id, 1)"
              />
            </el-tooltip>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="quick-entry-editor__footer">
          <el-button :icon="RotateCcw" @click="resetQuickEntryEditor">恢复默认</el-button>
          <div>
            <el-button @click="quickEntryDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="saveQuickEntryPreferences">保存</el-button>
          </div>
        </div>
      </template>
    </el-dialog>

    <div class="dashboard-summary">
      <div v-for="item in summaryRows" :key="item.label" class="dashboard-summary__item">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <small>{{ item.detail }}</small>
      </div>
    </div>

    <div class="dashboard-metrics">
      <el-card
        v-for="item in cards"
        :key="item.label"
        shadow="never"
        :class="['metric-card', `metric-card--${item.tone}`]"
      >
        <div class="metric-card__top">
          <span>{{ item.label }}</span>
          <span class="metric-card__icon">
            <component :is="item.icon" class="h-4 w-4" />
          </span>
        </div>
        <div class="metric-card__value">{{ item.value }}</div>
        <div class="metric-card__hint">{{ item.hint }}</div>
      </el-card>
    </div>

    <div class="dashboard-grid">
      <el-card shadow="never" class="table-card">
        <template #header>
          <div class="dashboard-card-header">
            <div>
              <span>最近任务</span>
              <small>最新创建和执行中的任务记录</small>
            </div>
          </div>
        </template>
        <el-table :data="overview?.recent_tasks || []" stripe border empty-text="暂无数据" class="dashboard-table">
          <el-table-column label="ID" width="92" align="center" header-align="center">
            <template #default="{ row }">
              <span class="font-mono text-xs" :title="String(row.id)">{{ truncateId(row.id) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="title" label="任务名称" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">{{ row.title || '-' }}</template>
          </el-table-column>
          <el-table-column prop="script_key" label="脚本" min-width="150" show-overflow-tooltip />
          <el-table-column label="状态" width="120" align="center" header-align="center">
            <template #default="{ row }"><StatusBadge :value="row.status" /></template>
          </el-table-column>
          <el-table-column label="创建时间" min-width="170" align="center" header-align="center">
            <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-card shadow="never" class="table-card">
        <template #header>
          <div class="dashboard-card-header">
            <div>
              <span>任务状态分布</span>
              <small>当前任务池的状态统计</small>
            </div>
          </div>
        </template>
        <div v-if="statusMetrics.length" class="status-list">
          <div v-for="item in statusMetrics" :key="item.label" class="status-row">
            <div class="status-row__main">
              <span>{{ statusLabel(item.label) }}</span>
              <strong>{{ item.value }}</strong>
            </div>
            <el-progress
              :percentage="Math.round((item.value / maxStatusMetric) * 100)"
              :show-text="false"
              :stroke-width="6"
            />
          </div>
        </div>
        <el-empty v-else description="暂无状态数据" :image-size="72" />
      </el-card>
    </div>
  </section>
</template>

<style scoped>
.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dashboard-toolbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  border: 1px solid #d9e2ec;
  border-radius: 8px;
  background: #ffffff;
  padding: 16px 18px;
}

.dashboard-eyebrow {
  color: #1f668f;
  font-size: 12px;
  font-weight: 700;
}

.dashboard-title {
  margin-top: 4px;
  color: #1f2933;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.25;
}

.dashboard-subtitle {
  margin-top: 6px;
  color: #66788a;
  font-size: 13px;
}

.dashboard-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
}

.dashboard-refresh-time {
  color: #7b8794;
  font-size: 12px;
}

.dashboard-alert {
  border-radius: 8px;
}

.quick-entry-section {
  border: 1px solid #d9e2ec;
  border-radius: 8px;
  background: #ffffff;
  padding: 14px 16px 16px;
}

.quick-entry-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.quick-entry-heading h2 {
  color: #1f2933;
  font-size: 15px;
  font-weight: 700;
}

.quick-entry-heading p {
  margin-top: 2px;
  color: #7b8794;
  font-size: 12px;
}

.quick-entry-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(150px, 1fr));
  gap: 10px;
}

.quick-entry {
  display: flex;
  align-items: center;
  min-width: 0;
  min-height: 64px;
  gap: 10px;
  border: 1px solid #e1e8ef;
  border-radius: 8px;
  background: #ffffff;
  padding: 10px 12px;
  transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
}

.quick-entry:hover {
  border-color: var(--entry-color);
  box-shadow: 0 4px 12px rgb(31 41 51 / 8%);
  transform: translateY(-1px);
}

.quick-entry__icon {
  display: inline-flex;
  flex: 0 0 36px;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 7px;
  color: var(--entry-color);
  background: var(--entry-bg);
}

.quick-entry__content {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.quick-entry__content strong {
  overflow: hidden;
  color: #243b53;
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-entry__content small {
  color: #7b8794;
  font-size: 11px;
}

.quick-entry__arrow {
  flex: 0 0 auto;
  margin-left: auto;
  color: #9aa5b1;
  transition: color 160ms ease, transform 160ms ease;
}

.quick-entry:hover .quick-entry__arrow {
  color: var(--entry-color);
  transform: translateX(2px);
}

.quick-entry--blue { --entry-color: #1f668f; --entry-bg: #eef8ff; }
.quick-entry--green { --entry-color: #15803d; --entry-bg: #f0fdf4; }
.quick-entry--violet { --entry-color: #6d28d9; --entry-bg: #f5f3ff; }
.quick-entry--cyan { --entry-color: #0e7490; --entry-bg: #ecfeff; }
.quick-entry--indigo { --entry-color: #4f46e5; --entry-bg: #eef2ff; }
.quick-entry--orange { --entry-color: #c2410c; --entry-bg: #fff7ed; }
.quick-entry--slate { --entry-color: #475569; --entry-bg: #f8fafc; }
.quick-entry--amber { --entry-color: #b45309; --entry-bg: #fffbeb; }

.quick-entry-editor {
  display: grid;
  gap: 8px;
}

.quick-entry-editor__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 54px;
  gap: 12px;
  border: 1px solid #e1e8ef;
  border-radius: 7px;
  padding: 8px 10px;
}

.quick-entry-editor__checkbox {
  flex: 1;
  min-width: 0;
  height: auto;
}

.quick-entry-editor__checkbox :deep(.el-checkbox__label) {
  min-width: 0;
  width: 100%;
}

.quick-entry-editor__identity {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 10px;
}

.quick-entry-editor__icon {
  display: inline-flex;
  flex: 0 0 32px;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  color: var(--entry-color);
  background: var(--entry-bg);
}

.quick-entry-editor__text {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.quick-entry-editor__text strong {
  color: #243b53;
  font-size: 13px;
}

.quick-entry-editor__text small {
  color: #7b8794;
  font-size: 11px;
}

.quick-entry-editor__actions,
.quick-entry-editor__footer {
  display: flex;
  align-items: center;
}

.quick-entry-editor__actions {
  flex: 0 0 auto;
  gap: 2px;
}

.quick-entry-editor__footer {
  justify-content: space-between;
  gap: 12px;
}
.dashboard-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border: 1px solid #d9e2ec;
  border-radius: 8px;
  background: #ffffff;
}

.dashboard-summary__item {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 14px 18px;
  border-right: 1px solid #e6edf3;
}

.dashboard-summary__item:last-child {
  border-right: 0;
}

.dashboard-summary__item span {
  color: #66788a;
  font-size: 12px;
}

.dashboard-summary__item strong {
  color: #1f2933;
  font-size: 20px;
  font-weight: 700;
}

.dashboard-summary__item small {
  overflow: hidden;
  color: #7b8794;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 12px;
}

.metric-card {
  border-radius: 8px;
}

.metric-card :deep(.el-card__body) {
  padding: 14px;
}

.metric-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: #66788a;
  font-size: 13px;
  font-weight: 600;
}

.metric-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: var(--metric-color);
  background: var(--metric-bg);
}

.metric-card__value {
  margin-top: 10px;
  color: #1f2933;
  font-size: 26px;
  font-weight: 700;
  line-height: 1.1;
}

.metric-card__hint {
  margin-top: 6px;
  color: #7b8794;
  font-size: 12px;
}

.metric-card--blue {
  --metric-color: #1f668f;
  --metric-bg: #eef8ff;
}

.metric-card--indigo {
  --metric-color: #4f46e5;
  --metric-bg: #eef2ff;
}

.metric-card--green {
  --metric-color: #15803d;
  --metric-bg: #f0fdf4;
}

.metric-card--red {
  --metric-color: #b91c1c;
  --metric-bg: #fef2f2;
}

.metric-card--amber {
  --metric-color: #b45309;
  --metric-bg: #fffbeb;
}

.metric-card--cyan {
  --metric-color: #0e7490;
  --metric-bg: #ecfeff;
}

.metric-card--emerald {
  --metric-color: #047857;
  --metric-bg: #ecfdf5;
}

.metric-card--orange {
  --metric-color: #c2410c;
  --metric-bg: #fff7ed;
}

.metric-card--violet {
  --metric-color: #6d28d9;
  --metric-bg: #f5f3ff;
}

.metric-card--slate {
  --metric-color: #475569;
  --metric-bg: #f8fafc;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
  gap: 16px;
}

.dashboard-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dashboard-card-header span {
  display: block;
  color: #1f2933;
  font-size: 14px;
  font-weight: 700;
}

.dashboard-card-header small {
  display: block;
  margin-top: 2px;
  color: #7b8794;
  font-size: 12px;
}

.dashboard-table :deep(.el-table__cell) {
  padding: 9px 0;
}

.status-list {
  display: grid;
  gap: 12px;
  padding: 14px;
}

.status-row {
  display: grid;
  gap: 8px;
}

.status-row__main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.status-row__main span {
  color: #52606d;
  font-size: 13px;
}

.status-row__main strong {
  color: #1f2933;
  font-size: 13px;
  font-weight: 700;
}

@media (max-width: 1024px) {
  .dashboard-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .dashboard-summary {
    grid-template-columns: 1fr;
  }

  .quick-entry-grid {
    grid-template-columns: repeat(2, minmax(150px, 1fr));
  }

  .dashboard-summary__item {
    border-right: 0;
    border-bottom: 1px solid #e6edf3;
  }

  .dashboard-summary__item:last-child {
    border-bottom: 0;
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .dashboard-actions {
    align-items: stretch;
    flex-direction: column;
    width: 100%;
  }

  .quick-entry-grid {
    grid-template-columns: 1fr;
  }
}
</style>
