<script setup lang="ts">
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileCode2,
  PlaySquare,
  RefreshCw,
  Server,
  ShieldCheck,
  Users,
  XCircle,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { http } from '@/api/http'
import StatusBadge from '@/components/StatusBadge.vue'
import { REALTIME_EVENT_NAME, type RealtimeEventPayload } from '@/composables/useRealtimeEvents'
import type { AnyRecord } from '@/types/api'
import { formatDate, statusLabel, truncateId } from '@/utils/format'
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
}
</style>
