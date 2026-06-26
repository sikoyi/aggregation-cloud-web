<script setup lang="ts">
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  PlaySquare,
  Server,
  ShieldCheck,
  Users,
  XCircle,
} from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'

import { http } from '@/api/http'
import StatusBadge from '@/components/StatusBadge.vue'
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

const cards = computed(() => {
  const data = overview.value
  return [
    { label: '今日下发', value: data?.today_task_total || 0, icon: PlaySquare, tone: 'blue' },
    { label: '运行中', value: data?.running_task_total || 0, icon: Clock3, tone: 'indigo' },
    { label: '成功', value: data?.succeeded_task_total || 0, icon: CheckCircle2, tone: 'green' },
    { label: '失败', value: data?.failed_task_total || 0, icon: XCircle, tone: 'red' },
    { label: '取消', value: data?.canceled_task_total || 0, icon: AlertTriangle, tone: 'amber' },
    { label: '在线 Runtime', value: data?.online_runtime_total || 0, icon: Server, tone: 'cyan' },
    { label: '在线设备', value: data?.online_slot_total || 0, icon: Activity, tone: 'emerald' },
    { label: '异常设备', value: data?.abnormal_slot_total || 0, icon: AlertTriangle, tone: 'orange' },
    { label: '账号', value: data?.account_total || 0, icon: Users, tone: 'slate' },
    { label: '代理', value: data?.proxy_total || 0, icon: ShieldCheck, tone: 'slate' },
  ]
})

async function loadDashboard() {
  loading.value = true
  error.value = ''
  try {
    overview.value = await http.get<DashboardOverview>('/api/dashboard/overview')
  } catch (err) {
    error.value = notifyError(err, '加载失败', '加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadDashboard)
</script>

<template>
  <section class="space-y-5">
    <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 class="text-xl font-semibold text-ink">总览</h1>
      </div>
      <el-button :icon="Activity" :loading="loading" @click="loadDashboard">刷新</el-button>
    </div>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <el-card v-for="item in cards" :key="item.label" shadow="never" class="metric-card">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-slate-600">{{ item.label }}</span>
          <component :is="item.icon" class="h-4 w-4 text-brand-600" />
        </div>
        <div class="mt-3 text-2xl font-semibold text-ink">{{ item.value }}</div>
      </el-card>
    </div>

    <div class="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
      <el-card shadow="never" class="table-card">
        <template #header>
          <span class="text-sm font-semibold text-ink">最近任务</span>
        </template>
        <el-table :data="overview?.recent_tasks || []" stripe border empty-text="暂无数据">
          <el-table-column label="ID" min-width="120" align="center" header-align="center">
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
          <span class="text-sm font-semibold text-ink">任务状态分布</span>
        </template>
        <div v-if="overview?.task_status_metrics?.length" class="space-y-2">
          <div
            v-for="item in overview.task_status_metrics"
            :key="item.label"
            class="flex items-center justify-between rounded-md border border-line px-3 py-2"
          >
            <span class="text-sm text-slate-600">{{ statusLabel(item.label) }}</span>
            <span class="text-sm font-semibold text-ink">{{ item.value }}</span>
          </div>
        </div>
        <el-empty v-else description="暂无状态数据" :image-size="72" />
      </el-card>
    </div>
  </section>
</template>
