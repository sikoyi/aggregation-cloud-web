<script setup lang="ts">
import { RefreshCw, Search, SlidersHorizontal } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'

import { http, resolveBackendUrl } from '@/api/http'
import { usePersistentFilters } from '@/composables/usePersistentFilters'
import { businessPlatformLabel, businessPlatformOptions } from '@/config/options'
import type { PageResult } from '@/types/api'
import { formatDate } from '@/utils/format'
import { notifyError } from '@/utils/notify'

interface AccountMetricRecord {
  id: string
  business_platform: string
  account_id: string
  account_name: string
  username?: string | null
  display_name?: string | null
  avatar_url?: string | null
  captured_at: string
  followers_count?: number | null
  following_count?: number | null
  posts_count?: number | null
  total_likes_count?: number | null
  total_replies_count?: number | null
  source: string
  task_run_id?: string | null
}

const loading = ref(false)
const rows = ref<AccountMetricRecord[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const { filters, resetFilters: resetCachedFilters } = usePersistentFilters(
  'list:account-metric-records',
  {
    keyword: '',
    businessPlatform: '',
    capturedRange: [] as string[],
  },
)
const capturedRange = computed<[Date, Date] | null>({
  get: () => {
    if (filters.capturedRange.length !== 2) return null
    const range: [Date, Date] = [
      new Date(filters.capturedRange[0]),
      new Date(filters.capturedRange[1]),
    ]
    return range.every((item) => !Number.isNaN(item.getTime())) ? range : null
  },
  set: (value) => {
    filters.capturedRange = value
      ? [value[0].toISOString(), value[1].toISOString()]
      : []
  },
})

const sourceLabels: Record<string, string> = {
  apify_account_monitor: '账号监听采集',
  browser_runtime: '运行环境上报',
  runtime: '运行环境上报',
}

function accountInitial(value: string) {
  return String(value || '?').trim().slice(0, 1).toUpperCase()
}

function sourceLabel(value: string) {
  return sourceLabels[value] || value || '未知来源'
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('zh-CN').format(value)
}

async function loadRows() {
  loading.value = true
  try {
    const data = await http.get<PageResult<AccountMetricRecord>>(
      '/api/accounts/metric-snapshots',
      {
        keyword: filters.keyword.trim() || undefined,
        business_platform: filters.businessPlatform || undefined,
        captured_from: capturedRange.value?.[0]?.toISOString(),
        captured_to: capturedRange.value?.[1]?.toISOString(),
        page: page.value,
        page_size: pageSize.value,
      },
    )
    rows.value = data.items
    total.value = data.total
  } catch (err) {
    notifyError(err, '加载失败', '无法加载账号采集记录')
  } finally {
    loading.value = false
  }
}

function submitFilters() {
  page.value = 1
  void loadRows()
}

function clearFilters() {
  resetCachedFilters()
  page.value = 1
  void loadRows()
}

defineExpose({ loadRows })
onMounted(loadRows)
</script>

<template>
  <div class="metric-records">
    <div class="filter-panel">
      <div class="filter-title">
        <span><SlidersHorizontal :size="15" /> 筛选条件</span>
        <el-tooltip content="刷新采集记录" placement="bottom">
          <el-button circle :icon="RefreshCw" :loading="loading" @click="loadRows" />
        </el-tooltip>
      </div>
      <div class="filter-grid">
        <el-input
          v-model="filters.keyword"
          clearable
          placeholder="账号 ID / 登录账号 / 用户名"
          @keyup.enter="submitFilters"
        />
        <el-select v-model="filters.businessPlatform" clearable placeholder="业务 App">
          <el-option
            v-for="item in businessPlatformOptions"
            :key="String(item.value)"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-date-picker
          v-model="capturedRange"
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
        <el-table-column label="记录 ID" prop="id" width="78" align="center" />
        <el-table-column label="账号信息" min-width="190">
          <template #default="{ row }">
            <div class="account-cell">
              <el-avatar
                :size="36"
                :src="resolveBackendUrl(row.avatar_url) || undefined"
                class="account-avatar"
              >
                {{ accountInitial(row.account_name) }}
              </el-avatar>
              <div>
                <strong>{{ row.account_name }}</strong>
                <small>{{ row.username ? '@' + row.username : '账号 #' + row.account_id }}</small>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="业务 App" width="105" align="center">
          <template #default="{ row }">
            <el-tag effect="plain">{{ businessPlatformLabel(row.business_platform) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="账号指标" min-width="255">
          <template #default="{ row }">
            <div class="metric-list">
              <span><small>粉丝</small><strong>{{ formatNumber(row.followers_count) }}</strong></span>
              <span><small>关注</small><strong>{{ formatNumber(row.following_count) }}</strong></span>
              <span><small>帖子</small><strong>{{ formatNumber(row.posts_count) }}</strong></span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="互动数据" min-width="170">
          <template #default="{ row }">
            <div class="metric-list metric-list--interaction">
              <span><small>点赞</small><strong>{{ formatNumber(row.total_likes_count) }}</strong></span>
              <span><small>回复</small><strong>{{ formatNumber(row.total_replies_count) }}</strong></span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="数据来源" min-width="130" align="center">
          <template #default="{ row }">
            <div class="source-cell">
              <el-tag type="info" effect="light">{{ sourceLabel(row.source) }}</el-tag>
              <small v-if="row.task_run_id">任务 #{{ row.task_run_id }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="采集时间" width="175" align="center">
          <template #default="{ row }">{{ formatDate(row.captured_at) }}</template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无账号采集记录" :image-size="72" />
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
  </div>
</template>

<style scoped>
.filter-panel,
.records-table { border: 1px solid #dbe4ed; border-radius: 6px; background: #fff; }
.filter-panel { margin-bottom: 12px; padding: 12px; }
.filter-title,
.filter-title > span,
.filter-actions,
.account-cell { display: flex; align-items: center; }
.filter-title { justify-content: space-between; gap: 12px; margin-bottom: 10px; color: #26384a; font-size: 13px; font-weight: 700; }
.filter-title > span { gap: 6px; }
.filter-grid { display: grid; grid-template-columns: minmax(220px, 1fr) minmax(150px, .55fr) minmax(320px, 1.3fr); gap: 10px; }
.filter-date { width: 100% !important; }
.filter-actions { gap: 10px; margin-top: 10px; }
.records-table { overflow: hidden; }
.pagination { display: flex; justify-content: flex-end; padding: 12px; border-top: 1px solid #e5ebf1; }
.account-cell { min-width: 0; gap: 10px; }
.account-cell > div { min-width: 0; }
.account-cell strong,
.account-cell small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.account-cell strong { color: #243548; font-size: 13px; }
.account-cell small { margin-top: 4px; color: #7b8b9b; font-size: 11px; }
.account-avatar { border: 1px solid #d5e2ec; color: #245f87; background: #edf6fc; }
.metric-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.metric-list--interaction { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.metric-list span { padding: 5px 7px; border-radius: 4px; background: #f5f8fb; text-align: center; }
.metric-list small,
.metric-list strong { display: block; }
.metric-list small { color: #8190a0; font-size: 10px; }
.metric-list strong { margin-top: 2px; color: #26384a; font-size: 13px; }
.source-cell { display: flex; align-items: center; flex-direction: column; gap: 4px; }
.source-cell small { color: #8190a0; font-size: 10px; }

@media (max-width: 900px) {
  .filter-grid { grid-template-columns: 1fr; }
}
</style>
