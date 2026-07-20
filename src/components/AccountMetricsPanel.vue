<script setup lang="ts">
import { RefreshCw } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import { http } from '@/api/http'
import type { AnyRecord } from '@/types/api'
import { formatDate } from '@/utils/format'
import { notifyError } from '@/utils/notify'

const props = defineProps<{
  account: AnyRecord
}>()

type PeriodValue = '24h' | '7d' | '30d' | 'all'
type MetricKey = 'followers_count' | 'following_count' | 'posts_count' | 'total_likes_count' | 'total_replies_count'

const periodOptions: Array<{ label: string; value: PeriodValue }> = [
  { label: '近 24 小时', value: '24h' },
  { label: '近 7 天', value: '7d' },
  { label: '近 30 天', value: '30d' },
  { label: '全部', value: 'all' },
]

const metricDefs: Array<{ key: MetricKey; label: string; color: string }> = [
  { key: 'followers_count', label: '粉丝', color: '#2563eb' },
  { key: 'following_count', label: '关注', color: '#16a34a' },
  { key: 'posts_count', label: '帖子', color: '#f97316' },
  { key: 'total_likes_count', label: '总点赞', color: '#9333ea' },
  { key: 'total_replies_count', label: '总回复', color: '#dc2626' },
]

const loading = ref(false)
const period = ref<PeriodValue>('7d')
const curve = ref<AnyRecord | null>(null)

const accountId = computed(() => String(props.account?.id || ''))
const accountName = computed(() =>
  String(props.account?.login_username || props.account?.username || props.account?.display_name || props.account?.id || '-'),
)
const points = computed<AnyRecord[]>(() => Array.isArray(curve.value?.points) ? curve.value.points : [])
const tablePoints = computed<AnyRecord[]>(() => [...points.value].reverse())
const trends = computed<AnyRecord[]>(() => Array.isArray(curve.value?.trends) ? curve.value.trends : [])

function metricNumber(value: unknown) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function numberText(value: unknown) {
  const numberValue = metricNumber(value)
  return numberValue === null ? '-' : String(numberValue)
}

function trendFor(key: MetricKey) {
  return trends.value.find((item) => item.metric_key === key) || {}
}

function deltaText(value: unknown) {
  const numberValue = metricNumber(value)
  if (numberValue === null) return '-'
  return numberValue > 0 ? `+${numberValue}` : String(numberValue)
}

function trendRate(value: unknown) {
  const numberValue = metricNumber(value)
  if (numberValue === null) return '-'
  return `${(numberValue * 100).toFixed(1)}%`
}

function trendType(value: unknown) {
  const direction = String(value || '')
  if (direction === 'up') return 'success'
  if (direction === 'down') return 'danger'
  return 'info'
}

function trendLabel(value: unknown) {
  const direction = String(value || '')
  const labels: Record<string, string> = {
    up: '上升',
    down: '下降',
    flat: '持平',
    unknown: '暂无趋势',
  }
  return labels[direction] || '暂无趋势'
}

function chartPolyline(key: MetricKey) {
  if (points.value.length < 2) return ''
  const values = points.value.map((point) => metricNumber(point[key]))
  const validValues = values.filter((value): value is number => value !== null)
  if (!validValues.length) return ''
  const min = Math.min(...validValues)
  const max = Math.max(...validValues)
  const range = max - min || 1
  return values
    .map((value, index) => {
      const x = 36 + (index * 648) / Math.max(points.value.length - 1, 1)
      const normalized = value === null ? min : value
      const y = 176 - ((normalized - min) * 136) / range
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

function chartDateRange() {
  if (!points.value.length) return '暂无采集数据'
  const first = formatDate(points.value[0]?.captured_at)
  const last = formatDate(points.value[points.value.length - 1]?.captured_at)
  return first === last ? first : `${first} ~ ${last}`
}

async function loadCurve() {
  if (!accountId.value) return
  loading.value = true
  try {
    curve.value = await http.get<AnyRecord>(`/api/accounts/${encodeURIComponent(accountId.value)}/metrics/curve`, {
      period: period.value,
    })
  } catch (err) {
    notifyError(err, '加载账号趋势失败', '加载账号趋势失败')
  } finally {
    loading.value = false
  }
}

watch([accountId, period], loadCurve, { immediate: true })
</script>

<template>
  <div v-loading="loading" class="account-metrics-panel">
    <div class="account-metrics-panel__header">
      <div>
        <div class="account-metrics-panel__title">账号趋势</div>
        <div class="account-metrics-panel__subtitle">当前账号：{{ accountName }}</div>
      </div>
      <div class="account-metrics-panel__actions">
        <el-radio-group v-model="period" size="small">
          <el-radio-button v-for="option in periodOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </el-radio-button>
        </el-radio-group>
        <el-button :icon="RefreshCw" :loading="loading" @click="loadCurve">刷新</el-button>
      </div>
    </div>

    <div class="trend-grid">
      <div v-for="metric in metricDefs" :key="metric.key" class="trend-card">
        <div class="trend-card__head">
          <span>{{ metric.label }}</span>
          <el-tag size="small" :type="trendType(trendFor(metric.key).direction)" effect="light">
            {{ trendLabel(trendFor(metric.key).direction) }}
          </el-tag>
        </div>
        <strong>{{ numberText(trendFor(metric.key).latest_value) }}</strong>
        <div class="trend-card__meta">
          <span>总变化 {{ deltaText(trendFor(metric.key).total_delta) }}</span>
          <span>最近 {{ deltaText(trendFor(metric.key).latest_delta) }}</span>
          <span>增长率 {{ trendRate(trendFor(metric.key).growth_rate) }}</span>
        </div>
      </div>
    </div>

    <div class="trend-chart">
      <div class="trend-chart__header">
        <div>
          <strong>指标走势</strong>
          <span>{{ chartDateRange() }}</span>
        </div>
        <div class="trend-chart__legend">
          <span v-for="metric in metricDefs" :key="metric.key">
            <i :style="{ backgroundColor: metric.color }" />
            {{ metric.label }}
          </span>
        </div>
      </div>
      <el-empty v-if="points.length < 2" description="至少需要 2 次指标采集才能形成曲线" :image-size="70" />
      <svg v-else viewBox="0 0 720 220" role="img" class="trend-chart__svg">
        <line x1="36" y1="40" x2="36" y2="176" class="axis-line" />
        <line x1="36" y1="176" x2="684" y2="176" class="axis-line" />
        <line v-for="y in [74, 108, 142]" :key="y" x1="36" :y1="y" x2="684" :y2="y" class="grid-line" />
        <polyline
          v-for="metric in metricDefs"
          :key="metric.key"
          :points="chartPolyline(metric.key)"
          fill="none"
          :stroke="metric.color"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <text x="36" y="204" class="chart-label">{{ formatDate(points[0]?.captured_at) }}</text>
        <text x="684" y="204" text-anchor="end" class="chart-label">
          {{ formatDate(points[points.length - 1]?.captured_at) }}
        </text>
      </svg>
    </div>

    <el-table :data="tablePoints" border stripe table-layout="auto" empty-text="暂无指标快照">
      <el-table-column label="采集时间" min-width="170" align="center">
        <template #default="{ row }">{{ formatDate(row.captured_at) }}</template>
      </el-table-column>
      <el-table-column prop="followers_count" label="粉丝" width="100" align="center" />
      <el-table-column prop="following_count" label="关注" width="100" align="center" />
      <el-table-column prop="posts_count" label="帖子" width="100" align="center" />
      <el-table-column prop="total_likes_count" label="总点赞" width="110" align="center" />
      <el-table-column prop="total_replies_count" label="总回复" width="110" align="center" />
    </el-table>
  </div>
</template>

<style scoped>
.account-metrics-panel {
  min-width: 0;
}

.account-metrics-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.account-metrics-panel__title {
  color: #0f172a;
  font-size: 15px;
  font-weight: 700;
}

.account-metrics-panel__subtitle {
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
}

.account-metrics-panel__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.trend-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.trend-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 12px;
  background: #fff;
}

.trend-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #64748b;
  font-size: 12px;
}

.trend-card strong {
  display: block;
  margin-top: 8px;
  color: #0f172a;
  font-size: 22px;
}

.trend-card__meta {
  display: grid;
  gap: 4px;
  margin-top: 8px;
  color: #64748b;
  font-size: 12px;
}

.trend-chart {
  margin-bottom: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 12px;
  background: #fff;
}

.trend-chart__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.trend-chart__header strong {
  display: block;
  color: #0f172a;
}

.trend-chart__header span {
  color: #64748b;
  font-size: 12px;
}

.trend-chart__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.trend-chart__legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #475569;
}

.trend-chart__legend i {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 999px;
}

.trend-chart__svg {
  width: 100%;
  height: 240px;
}

.axis-line {
  stroke: #cbd5e1;
  stroke-width: 1.5;
}

.grid-line {
  stroke: #e2e8f0;
  stroke-width: 1;
  stroke-dasharray: 4 4;
}

.chart-label {
  fill: #64748b;
  font-size: 12px;
}

@media (max-width: 1180px) {
  .trend-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .account-metrics-panel__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .trend-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .trend-chart__header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
