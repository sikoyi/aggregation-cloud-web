<script setup lang="ts">
import {
  ExternalLink,
  FileClock,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'

import { http, resolveBackendUrl } from '@/api/http'
import AccountMetricRecordsPanel from '@/components/AccountMetricRecordsPanel.vue'
import { usePersistentFilters } from '@/composables/usePersistentFilters'
import type { PageResult } from '@/types/api'
import { formatDate, statusLabel, statusTagType } from '@/utils/format'
import { notifyError } from '@/utils/notify'

interface BenchmarkSyncRun {
  id: string
  tracker_id: string
  target_account_id: string
  target_account_name: string
  target_avatar_url?: string | null
  source_profile_url: string
  source_username?: string | null
  source_display_name?: string | null
  source_avatar_url?: string | null
  attempt_no: number
  status: string
  phase: string
  collected_post_count: number
  discovered_post_count: number
  action_count: number
  succeeded_count: number
  failed_count: number
  pending_count: number
  skipped_count: number
  error_message?: string | null
  scheduled_at: string
  started_at?: string | null
  finished_at?: string | null
  created_at: string
}

interface BenchmarkSyncAction {
  id: string
  run_id: string
  mapping_id?: string | null
  task_run_id?: string | null
  action_type: string
  status: string
  title: string
  description?: string | null
  source_content_url?: string | null
  target_content_url?: string | null
  details: Record<string, unknown>
  error_message?: string | null
  finished_at?: string | null
  created_at: string
  updated_at: string
}

const loading = ref(false)
const rows = ref<BenchmarkSyncRun[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const activeSection = ref('metrics')
const metricRecordsRef = ref<InstanceType<typeof AccountMetricRecordsPanel> | null>(null)
const { filters, resetFilters: resetCachedFilters } = usePersistentFilters(
  'list:benchmark-sync-records',
  {
    keyword: '',
    status: '',
    actionType: '',
    actionStatus: '',
    createdRange: [] as string[],
  },
)
const timeRange = computed<[Date, Date] | null>({
  get: (): [Date, Date] | null => {
    if (filters.createdRange.length !== 2) return null
    const range: [Date, Date] = [
      new Date(filters.createdRange[0]),
      new Date(filters.createdRange[1]),
    ]
    return range.every((item) => !Number.isNaN(item.getTime())) ? range : null
  },
  set: (value: [Date, Date] | null) => {
    filters.createdRange = value
      ? [value[0].toISOString(), value[1].toISOString()]
      : []
  },
})

const detailVisible = ref(false)
const detailLoading = ref(false)
const detailRun = ref<BenchmarkSyncRun | null>(null)
const detailActions = ref<BenchmarkSyncAction[]>([])

const actionTypeOptions = [
  { label: '资料同步', value: 'profile_sync' },
  { label: '内容发布', value: 'content_publish' },
  { label: '内容删除', value: 'content_delete' },
]

const actionStatusOptions = [
  { label: '排队中', value: 'queued' },
  { label: '执行中', value: 'running' },
  { label: '等待采集确认', value: 'waiting_capture' },
  { label: '成功', value: 'succeeded' },
  { label: '失败', value: 'failed' },
  { label: '已跳过', value: 'skipped' },
]

const runStatusOptions = [
  { label: '排队中', value: 'queued' },
  { label: '启动中', value: 'starting' },
  { label: '采集中', value: 'running' },
  { label: '采集成功', value: 'succeeded' },
  { label: '采集失败', value: 'failed' },
  { label: '已取消', value: 'canceled' },
]

const actionStatusLabels: Record<string, string> = Object.fromEntries(
  actionStatusOptions.map((item) => [item.value, item.label]),
)
const actionTypeLabels: Record<string, string> = Object.fromEntries(
  actionTypeOptions.map((item) => [item.value, item.label]),
)

const detailTitle = computed(() => (
  detailRun.value ? `同步批次 #${detailRun.value.id}` : '同步动作明细'
))

function accountInitial(value: string | null | undefined) {
  return String(value || '?').trim().slice(0, 1).toUpperCase()
}

function sourceAccountName(row: any) {
  return row.source_display_name || row.source_username || '等待采集资料'
}

function runStatusLabel(status: string) {
  if (status === 'succeeded') return '采集成功'
  if (status === 'failed') return '采集失败'
  if (status === 'running') return '采集中'
  return statusLabel(status)
}

function phaseLabel(phase: string) {
  return phase === 'posts' ? '帖子采集' : '资料采集'
}

function actionStatusLabel(status: string) {
  return actionStatusLabels[status] || statusLabel(status)
}

function actionStatusType(status: string) {
  if (status === 'waiting_capture') return 'warning'
  if (status === 'skipped') return 'info'
  return statusTagType(status)
}

async function loadRows() {
  loading.value = true
  try {
    const data = await http.get<PageResult<BenchmarkSyncRun>>(
      '/api/benchmark-trackers/sync-records',
      {
        keyword: filters.keyword.trim() || undefined,
        status: filters.status || undefined,
        action_type: filters.actionType || undefined,
        action_status: filters.actionStatus || undefined,
        created_from: timeRange.value?.[0]?.toISOString(),
        created_to: timeRange.value?.[1]?.toISOString(),
        page: page.value,
        page_size: pageSize.value,
      },
    )
    rows.value = data.items
    total.value = data.total
  } catch (err) {
    notifyError(err, '加载失败', '无法加载对标同步记录')
  } finally {
    loading.value = false
  }
}

function reloadActiveSection() {
  if (activeSection.value === 'metrics') {
    void metricRecordsRef.value?.loadRows()
    return
  }
  void loadRows()
}

function submitFilters() {
  page.value = 1
  loadRows()
}

function clearFilters() {
  resetCachedFilters()
  page.value = 1
  loadRows()
}

async function openDetail(row: any) {
  detailRun.value = row
  detailActions.value = []
  detailVisible.value = true
  detailLoading.value = true
  try {
    const data = await http.get<PageResult<BenchmarkSyncAction>>(
      `/api/benchmark-trackers/sync-records/${row.id}/actions`,
      { page: 1, page_size: 100 },
    )
    detailActions.value = data.items
  } catch (err) {
    notifyError(err, '加载失败', '无法加载该批次的同步动作')
  } finally {
    detailLoading.value = false
  }
}

onMounted(loadRows)
</script>

<template>
  <section class="sync-records">
    <el-card shadow="never" class="sync-records__workspace">
      <template #header>
        <div class="page-header">
          <div class="page-title">
            <span class="page-title__icon"><FileClock :size="19" /></span>
            <div>
              <h1>数据同步记录</h1>
              <p>统一查看账号指标采集，以及对标资料和内容的同步结果。</p>
            </div>
          </div>
          <el-tooltip content="刷新记录" placement="bottom">
            <el-button circle :icon="RefreshCw" :loading="loading" @click="reloadActiveSection" />
          </el-tooltip>
        </div>
      </template>

      <div class="sync-records__body">
        <el-tabs v-model="activeSection" class="sync-records__tabs">
          <el-tab-pane label="账号采集记录" name="metrics" lazy>
            <AccountMetricRecordsPanel ref="metricRecordsRef" />
          </el-tab-pane>
          <el-tab-pane label="对标同步记录" name="benchmark" lazy>
            <div class="filter-panel">
          <div class="filter-title"><SlidersHorizontal :size="15" /> 筛选条件</div>
          <div class="filter-grid">
            <el-input
              v-model="filters.keyword"
              clearable
              placeholder="系统账号 / 对标账号 / 批次 ID"
              @keyup.enter="submitFilters"
            />
            <el-select v-model="filters.status" clearable placeholder="采集状态">
              <el-option
                v-for="item in runStatusOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <el-select v-model="filters.actionType" clearable placeholder="同步动作">
              <el-option
                v-for="item in actionTypeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <el-select v-model="filters.actionStatus" clearable placeholder="动作结果">
              <el-option
                v-for="item in actionStatusOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <el-date-picker
              v-model="timeRange"
              type="datetimerange"
              range-separator="至"
              start-placeholder="开始时间"
              end-placeholder="结束时间"
              class="filter-date"
            />
          </div>
          <div class="filter-actions">
            <el-button @click="clearFilters">清空</el-button>
            <el-button type="primary" :icon="Search" @click="submitFilters">查询</el-button>
          </div>
        </div>

        <div class="records-table">
          <el-table v-loading="loading" :data="rows" stripe>
            <el-table-column label="批次 ID" prop="id" width="68" align="center" />
            <el-table-column label="系统账号" min-width="140">
              <template #default="{ row }">
                <div class="account-cell">
                  <el-avatar
                    :size="36"
                    :src="resolveBackendUrl(row.target_avatar_url) || undefined"
                    class="account-avatar"
                  >
                    {{ accountInitial(row.target_account_name) }}
                  </el-avatar>
                  <div>
                    <strong>{{ row.target_account_name }}</strong>
                    <small>账号 #{{ row.target_account_id }}</small>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="对标账号" min-width="150">
              <template #default="{ row }">
                <div class="account-cell">
                  <el-avatar
                    :size="36"
                    :src="resolveBackendUrl(row.source_avatar_url) || undefined"
                    class="source-avatar"
                  >
                    {{ accountInitial(sourceAccountName(row)) }}
                  </el-avatar>
                  <div>
                    <strong>{{ sourceAccountName(row) }}</strong>
                    <small>{{ row.source_username ? `@${row.source_username}` : row.source_profile_url }}</small>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="采集状态" width="110" align="center">
              <template #default="{ row }">
                <div class="status-cell">
                  <el-tag :type="statusTagType(row.status)" effect="light">
                    {{ runStatusLabel(row.status) }}
                  </el-tag>
                  <small>{{ phaseLabel(row.phase) }} · 第 {{ row.attempt_no }} 次</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="帖子采集" width="100" align="center">
              <template #default="{ row }">
                <div class="post-counts">
                  <span><strong>{{ row.collected_post_count }}</strong><small>采集</small></span>
                  <span><strong>{{ row.discovered_post_count }}</strong><small>新增</small></span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="同步结果" min-width="145">
              <template #default="{ row }">
                <div v-if="row.action_count" class="result-counts">
                  <span class="is-success">成功 {{ row.succeeded_count }}</span>
                  <span class="is-pending">处理中 {{ row.pending_count }}</span>
                  <span class="is-danger">失败 {{ row.failed_count }}</span>
                  <span class="is-muted">跳过 {{ row.skipped_count }}</span>
                </div>
                <span v-else class="empty-result">本轮没有产生同步动作</span>
              </template>
            </el-table-column>
            <el-table-column label="执行时间" width="145">
              <template #default="{ row }">
                <div class="time-cell">
                  <strong>{{ formatDate(row.finished_at || row.started_at || row.created_at) }}</strong>
                  <small v-if="row.error_message" class="error-text">{{ row.error_message }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="76" align="center" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openDetail(row)">查看明细</el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无对标同步记录" :image-size="72" />
            </template>
          </el-table>
          <div class="pagination">
            <el-pagination
              v-model:current-page="page"
              v-model:page-size="pageSize"
              :total="total"
              :page-sizes="[20, 50, 100]"
              layout="total, sizes, prev, pager, next"
              @current-change="loadRows"
              @size-change="submitFilters"
            />
          </div>
        </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-card>

    <el-dialog v-model="detailVisible" :title="detailTitle" width="900px" destroy-on-close>
      <div v-if="detailRun" class="detail-summary">
        <div><small>系统账号</small><strong>{{ detailRun.target_account_name }}</strong></div>
        <div><small>对标账号</small><strong>{{ sourceAccountName(detailRun) }}</strong></div>
        <div><small>采集帖子</small><strong>{{ detailRun.collected_post_count }} 条</strong></div>
        <div><small>同步动作</small><strong>{{ detailRun.action_count }} 项</strong></div>
      </div>
      <el-table v-loading="detailLoading" :data="detailActions" stripe max-height="520">
        <el-table-column label="动作" min-width="150">
          <template #default="{ row }">
            <div class="action-cell">
              <el-tag effect="plain">{{ actionTypeLabels[row.action_type] || row.action_type }}</el-tag>
              <strong>{{ row.title }}</strong>
              <small v-if="row.description">{{ row.description }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="actionStatusType(row.status)" effect="light">
              {{ actionStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="关联内容" min-width="220">
          <template #default="{ row }">
            <div class="link-list">
              <a v-if="row.source_content_url" :href="row.source_content_url" target="_blank" rel="noreferrer">
                <ExternalLink :size="13" /> 对标源帖
              </a>
              <a v-if="row.target_content_url" :href="row.target_content_url" target="_blank" rel="noreferrer">
                <ExternalLink :size="13" /> 系统账号帖子
              </a>
              <span v-if="!row.source_content_url && !row.target_content_url">资料同步，无帖子链接</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="任务 / 时间" width="180">
          <template #default="{ row }">
            <div class="time-cell">
              <strong>{{ row.task_run_id ? `任务 #${row.task_run_id}` : '未创建任务' }}</strong>
              <small>{{ formatDate(row.finished_at || row.created_at) }}</small>
              <small v-if="row.error_message" class="error-text">{{ row.error_message }}</small>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="该历史批次暂无动作明细" :image-size="68" />
        </template>
      </el-table>
      <template #footer>
        <el-button type="primary" @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.sync-records__workspace { border-color: #d9e2ec; border-radius: 8px; }
.sync-records__workspace :deep(.el-card__header) { padding: 0; }
.sync-records__workspace :deep(.el-card__body) { padding: 0; }
.page-header,
.page-title,
.account-cell,
.filter-title,
.filter-actions,
.link-list a { display: flex; align-items: center; }
.page-header { justify-content: space-between; gap: 16px; padding: 13px 16px; }
.page-title { gap: 10px; }
.page-title__icon {
  display: inline-flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  color: #1f668f;
  background: #eef8ff;
}
.page-title h1 { color: #1f2933; font-size: 18px; font-weight: 700; line-height: 1.25; }
.page-title p { margin-top: 3px; color: #66788a; font-size: 12px; }
.sync-records__body { padding: 14px 16px 16px; background: #f8fafc; }
.sync-records__tabs :deep(.el-tabs__header) { margin: 0 0 12px; }
.sync-records__tabs :deep(.el-tabs__nav-wrap::after) { height: 1px; background: #dbe4ed; }
.sync-records__tabs :deep(.el-tabs__item) { height: 36px; font-size: 13px; }
.filter-panel,
.records-table { border: 1px solid #dbe4ed; border-radius: 6px; background: #fff; }
.filter-panel { margin-bottom: 12px; padding: 12px; }
.filter-title { gap: 6px; margin-bottom: 10px; color: #26384a; font-size: 13px; font-weight: 700; }
.filter-grid { display: grid; grid-template-columns: 1.25fr repeat(3, minmax(130px, .8fr)) minmax(300px, 1.35fr); gap: 10px; }
.filter-date { width: 100% !important; }
.filter-actions { gap: 10px; margin-top: 10px; }
.records-table { overflow: hidden; }
.pagination { display: flex; justify-content: flex-end; padding: 12px; border-top: 1px solid #e5ebf1; }
.account-cell { min-width: 0; gap: 10px; }
.account-cell > div { min-width: 0; }
.account-cell strong,
.account-cell small,
.time-cell strong,
.time-cell small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.account-cell strong { color: #243548; font-size: 13px; }
.account-cell small { margin-top: 4px; color: #7b8b9b; font-size: 11px; }
.account-avatar { border: 1px solid #d5e2ec; color: #245f87; background: #edf6fc; }
.source-avatar { border: 1px solid #e2d7c8; color: #8a5b22; background: #fff7e9; }
.status-cell { display: flex; align-items: center; flex-direction: column; gap: 5px; }
.status-cell small { color: #8190a0; font-size: 10px; }
.post-counts { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.post-counts span { padding: 5px 7px; border-radius: 4px; background: #f5f8fb; }
.post-counts strong,
.post-counts small { display: block; }
.post-counts strong { color: #26384a; font-size: 14px; }
.post-counts small { color: #8190a0; font-size: 10px; }
.result-counts { display: flex; flex-wrap: wrap; gap: 6px; }
.result-counts span { padding: 3px 7px; border-radius: 4px; font-size: 11px; }
.is-success { color: #237a4b; background: #edf9f1; }
.is-pending { color: #23699a; background: #edf6fc; }
.is-danger { color: #c2413b; background: #fff1f0; }
.is-muted { color: #64748b; background: #f1f5f9; }
.empty-result { color: #94a3b8; font-size: 12px; }
.time-cell strong { color: #34495e; font-size: 12px; font-weight: 500; }
.time-cell small { margin-top: 4px; color: #8190a0; font-size: 10px; }
.time-cell .error-text { color: #c2413b; }
.detail-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
.detail-summary > div { padding: 9px 11px; border: 1px solid #dbe4ed; border-radius: 5px; background: #f8fafc; }
.detail-summary small,
.detail-summary strong { display: block; }
.detail-summary small { color: #7b8b9b; font-size: 10px; }
.detail-summary strong { margin-top: 4px; overflow: hidden; color: #26384a; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.action-cell { display: flex; align-items: flex-start; flex-direction: column; gap: 5px; }
.action-cell strong { color: #26384a; font-size: 13px; }
.action-cell small { max-width: 280px; color: #718096; font-size: 11px; line-height: 1.45; }
.link-list { align-items: flex-start; flex-direction: column; gap: 6px; }
.link-list a { gap: 5px; color: #2f6f97; font-size: 12px; }
.link-list span { color: #94a3b8; font-size: 11px; }

@media (max-width: 1200px) {
  .filter-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 720px) {
  .page-header { align-items: flex-start; }
  .filter-grid,
  .detail-summary { grid-template-columns: 1fr; }
}
</style>
