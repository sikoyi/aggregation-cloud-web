<script setup lang="ts">
import {
  BarChart3,
  CheckCircle2,
  FileText,
  MessageSquareText,
  RefreshCw,
  Target,
  TrendingUp,
  Users,
} from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'

import { http } from '@/api/http'
import StatusBadge from '@/components/StatusBadge.vue'
import type { AnyRecord } from '@/types/api'
import { formatDate, statusLabel, truncateId } from '@/utils/format'
import { notifyError } from '@/utils/notify'

type PeriodValue = '7d' | '30d' | 'all'

interface ReportMetric {
  label: string
  value: number
  detail?: string | null
}

interface TaskTrendPoint {
  date: string
  total: number
  succeeded: number
  failed: number
  canceled: number
}

interface PublishedTrendPoint {
  date: string
  total: number
  comment_count: number
  like_count: number
  share_count: number
  view_count: number
}

interface OperationsReport {
  period: PeriodValue
  generated_at: string
  summary: ReportMetric[]
  task_status: ReportMetric[]
  account_login_status: ReportMetric[]
  content_status: ReportMetric[]
  published_content_status: ReportMetric[]
  task_trend: TaskTrendPoint[]
  published_content_trend: PublishedTrendPoint[]
  top_published_contents: AnyRecord[]
}

const periodOptions: Array<{ label: string; value: PeriodValue }> = [
  { label: '近 7 天', value: '7d' },
  { label: '近 30 天', value: '30d' },
  { label: '全部', value: 'all' },
]

const summaryIconMap = [Target, CheckCircle2, FileText, MessageSquareText, Users, TrendingUp]

const loading = ref(false)
const error = ref('')
const period = ref<PeriodValue>('7d')
const report = ref<OperationsReport | null>(null)

const summaryCards = computed(() =>
  (report.value?.summary || []).map((item, index) => ({
    ...item,
    icon: summaryIconMap[index] || BarChart3,
    tone: ['blue', 'green', 'indigo', 'violet', 'cyan', 'amber'][index] || 'blue',
  })),
)
const maxTaskTotal = computed(() => Math.max(1, ...taskTrend.value.map((item) => item.total)))
const maxPublishedValue = computed(() =>
  Math.max(1, ...publishedTrend.value.map((item) => item.comment_count + item.like_count + item.share_count + item.view_count)),
)
const taskTrend = computed(() => report.value?.task_trend || [])
const publishedTrend = computed(() => report.value?.published_content_trend || [])

async function loadReport() {
  loading.value = true
  error.value = ''
  try {
    report.value = await http.get<OperationsReport>('/api/reports/operations', { period: period.value })
  } catch (err) {
    error.value = notifyError(err, '加载运营报表失败', '加载运营报表失败')
  } finally {
    loading.value = false
  }
}

function percent(value: number, max: number) {
  return Math.max(3, Math.round((value / Math.max(max, 1)) * 100))
}

function metricValue(value: unknown) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return '0'
  return Number.isInteger(numberValue) ? String(numberValue) : numberValue.toFixed(1)
}

function interactionTotal(row: PublishedTrendPoint) {
  return row.comment_count + row.like_count + row.share_count + row.view_count
}

onMounted(loadReport)
</script>

<template>
  <section class="report-page">
    <div class="report-toolbar">
      <div class="min-w-0">
        <div class="report-eyebrow">运营分析</div>
        <h1 class="report-title">运营报表</h1>
        <p class="report-subtitle">汇总任务执行、发布内容、账号状态和内容库存，方便运营快速判断趋势。</p>
      </div>
      <div class="report-actions">
        <span v-if="report?.generated_at" class="report-time">更新于 {{ formatDate(report.generated_at) }}</span>
        <el-radio-group v-model="period" size="small" @change="loadReport">
          <el-radio-button v-for="option in periodOptions" :key="option.value" :label="option.value">
            {{ option.label }}
          </el-radio-button>
        </el-radio-group>
        <el-button type="primary" plain :icon="RefreshCw" :loading="loading" @click="loadReport">刷新</el-button>
      </div>
    </div>

    <el-alert v-if="error" type="error" :title="error" :closable="false" show-icon />

    <div v-loading="loading" class="report-content">
      <div class="summary-grid">
        <el-card
          v-for="item in summaryCards"
          :key="item.label"
          shadow="never"
          :class="['summary-card', `summary-card--${item.tone}`]"
        >
          <div class="summary-card__head">
            <span>{{ item.label }}</span>
            <span class="summary-card__icon">
              <component :is="item.icon" class="h-4 w-4" />
            </span>
          </div>
          <strong>{{ metricValue(item.value) }}</strong>
          <small>{{ item.detail || '-' }}</small>
        </el-card>
      </div>

      <div class="report-grid">
        <el-card shadow="never" class="report-card">
          <template #header>
            <div class="report-card__header">
              <span>任务趋势</span>
              <small>按父任务创建日期统计</small>
            </div>
          </template>
          <div v-if="taskTrend.length" class="trend-bars">
            <div v-for="item in taskTrend" :key="item.date" class="trend-row">
              <div class="trend-row__label">{{ item.date }}</div>
              <div class="trend-row__bar">
                <span class="bar-total" :style="{ width: `${percent(item.total, maxTaskTotal)}%` }" />
              </div>
              <div class="trend-row__value">
                {{ item.total }} 个
                <small>成功 {{ item.succeeded }} / 失败 {{ item.failed }} / 取消 {{ item.canceled }}</small>
              </div>
            </div>
          </div>
          <el-empty v-else description="暂无任务趋势数据" :image-size="72" />
        </el-card>

        <el-card shadow="never" class="report-card">
          <template #header>
            <div class="report-card__header">
              <span>发布内容互动趋势</span>
              <small>按发布时间或创建时间统计</small>
            </div>
          </template>
          <div v-if="publishedTrend.length" class="trend-bars">
            <div v-for="item in publishedTrend" :key="item.date" class="trend-row">
              <div class="trend-row__label">{{ item.date }}</div>
              <div class="trend-row__bar">
                <span class="bar-published" :style="{ width: `${percent(interactionTotal(item), maxPublishedValue)}%` }" />
              </div>
              <div class="trend-row__value">
                {{ item.total }} 条
                <small>评 {{ item.comment_count }} / 赞 {{ item.like_count }} / 享 {{ item.share_count }} / 看 {{ item.view_count }}</small>
              </div>
            </div>
          </div>
          <el-empty v-else description="暂无发布趋势数据" :image-size="72" />
        </el-card>
      </div>

      <div class="report-grid report-grid--three">
        <el-card shadow="never" class="report-card">
          <template #header><div class="report-card__header"><span>任务状态</span></div></template>
          <div class="status-list">
            <div v-for="item in report?.task_status || []" :key="item.label" class="status-row">
              <StatusBadge :value="item.label" />
              <strong>{{ item.value }}</strong>
            </div>
          </div>
        </el-card>

        <el-card shadow="never" class="report-card">
          <template #header><div class="report-card__header"><span>账号登录状态</span></div></template>
          <div class="status-list">
            <div v-for="item in report?.account_login_status || []" :key="item.label" class="status-row">
              <span>{{ statusLabel(item.label) }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
        </el-card>

        <el-card shadow="never" class="report-card">
          <template #header><div class="report-card__header"><span>内容使用状态</span></div></template>
          <div class="status-list">
            <div v-for="item in report?.content_status || []" :key="item.label" class="status-row">
              <StatusBadge :value="item.label" />
              <strong>{{ item.value }}</strong>
            </div>
          </div>
        </el-card>
      </div>

      <el-card shadow="never" class="report-card">
        <template #header>
          <div class="report-card__header">
            <span>高互动发布内容</span>
            <small>按评论、点赞、分享、浏览汇总排序</small>
          </div>
        </template>
        <el-table :data="report?.top_published_contents || []" border stripe empty-text="暂无发布内容数据">
          <el-table-column label="ID" width="88" align="center">
            <template #default="{ row }">
              <span class="font-mono text-xs" :title="String(row.id || '')">{{ truncateId(row.id) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="title" label="内容标题" min-width="220" show-overflow-tooltip />
          <el-table-column prop="author_account_name" label="发布账号" min-width="150" align="center" />
          <el-table-column prop="comment_count" label="评论" width="90" align="center" />
          <el-table-column prop="like_count" label="点赞" width="90" align="center" />
          <el-table-column prop="share_count" label="分享" width="90" align="center" />
          <el-table-column prop="view_count" label="浏览" width="90" align="center" />
          <el-table-column label="发布时间" min-width="170" align="center">
            <template #default="{ row }">{{ formatDate(row.published_at) }}</template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>
  </section>
</template>

<style scoped>
.report-page,
.report-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.report-toolbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  border: 1px solid #dbe5f2;
  border-radius: 8px;
  padding: 18px 20px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
}

.report-eyebrow {
  color: #2563eb;
  font-size: 12px;
  font-weight: 700;
}

.report-title {
  margin: 4px 0;
  color: #0f172a;
  font-size: 24px;
  font-weight: 800;
}

.report-subtitle,
.report-time,
.report-card__header small {
  color: #64748b;
  font-size: 13px;
}

.report-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
}

.summary-card {
  border-radius: 8px;
}

.summary-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #64748b;
  font-size: 13px;
}

.summary-card__icon {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #eff6ff;
  color: #2563eb;
}

.summary-card strong {
  display: block;
  margin-top: 10px;
  color: #0f172a;
  font-size: 26px;
  line-height: 1;
}

.summary-card small {
  display: block;
  margin-top: 8px;
  color: #64748b;
}

.summary-card--green .summary-card__icon { background: #ecfdf5; color: #16a34a; }
.summary-card--indigo .summary-card__icon { background: #eef2ff; color: #4f46e5; }
.summary-card--violet .summary-card__icon { background: #f5f3ff; color: #7c3aed; }
.summary-card--cyan .summary-card__icon { background: #ecfeff; color: #0891b2; }
.summary-card--amber .summary-card__icon { background: #fffbeb; color: #d97706; }

.report-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.report-grid--three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.report-card {
  border-radius: 8px;
}

.report-card__header {
  display: flex;
  min-height: 34px;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
}

.report-card__header span {
  color: #0f172a;
  font-weight: 700;
}

.trend-bars {
  display: grid;
  gap: 12px;
}

.trend-row {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr) 190px;
  align-items: center;
  gap: 10px;
}

.trend-row__label {
  color: #475569;
  font-size: 12px;
}

.trend-row__bar {
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: #e2e8f0;
}

.trend-row__bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
}

.bar-total {
  background: linear-gradient(90deg, #2563eb, #60a5fa);
}

.bar-published {
  background: linear-gradient(90deg, #16a34a, #86efac);
}

.trend-row__value {
  display: grid;
  gap: 2px;
  color: #0f172a;
  font-size: 13px;
  text-align: right;
}

.trend-row__value small {
  color: #64748b;
  font-size: 12px;
}

.status-list {
  display: grid;
  gap: 10px;
}

.status-row {
  display: flex;
  min-height: 34px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid #eef2f7;
  color: #475569;
}

.status-row:last-child {
  border-bottom: 0;
}

.status-row strong {
  color: #0f172a;
}

@media (max-width: 1280px) {
  .summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .report-grid,
  .report-grid--three {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .report-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }

  .trend-row {
    grid-template-columns: 1fr;
  }

  .trend-row__value {
    text-align: left;
  }
}
</style>
