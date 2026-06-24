<script setup lang="ts">
import { Activity, Boxes, PlaySquare, ScrollText, Server, ShieldCheck, Users } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'

import { http } from '@/api/http'
import StatusBadge from '@/components/StatusBadge.vue'
import type { AnyRecord, PageResult } from '@/types/api'
import { formatDate, truncateId } from '@/utils/format'

const loading = ref(false)
const error = ref('')
const recentTasks = ref<AnyRecord[]>([])
const stats = ref([
  { label: '账号', endpoint: '/api/accounts', total: 0, icon: Users },
  { label: '设备', endpoint: '/api/execution-slots', total: 0, icon: Boxes },
  { label: '代理', endpoint: '/api/resource-center/proxies', total: 0, icon: ShieldCheck },
  { label: '脚本', endpoint: '/api/scripts', total: 0, icon: ScrollText },
  { label: '任务', endpoint: '/api/tasks', total: 0, icon: PlaySquare },
  { label: 'Runtime', endpoint: '/api/runtimes', total: 0, icon: Server },
])

async function loadDashboard() {
  loading.value = true
  error.value = ''
  try {
    const settled = await Promise.allSettled(
      stats.value.map((item) => http.get<PageResult<AnyRecord>>(item.endpoint, { page: 1, page_size: 1 })),
    )
    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') stats.value[index].total = result.value.total
    })
    const tasks = await http.get<PageResult<AnyRecord>>('/api/tasks', { page: 1, page_size: 6 })
    recentTasks.value = tasks.items
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败'
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

    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <el-card v-for="item in stats" :key="item.endpoint" shadow="never" class="metric-card">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-slate-600">{{ item.label }}</span>
          <component :is="item.icon" class="h-4 w-4 text-brand-600" />
        </div>
        <div class="mt-3 text-2xl font-semibold text-ink">{{ item.total }}</div>
      </el-card>
    </div>

    <el-card shadow="never" class="table-card">
      <template #header>
        <span class="text-sm font-semibold text-ink">最近任务</span>
      </template>
      <el-table :data="recentTasks" stripe border empty-text="暂无数据">
        <el-table-column label="ID" min-width="140">
          <template #default="{ row }">
            <span class="font-mono text-xs" :title="String(row.id)">{{ truncateId(row.id) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.title || '-' }}</template>
        </el-table-column>
        <el-table-column prop="script_key" label="脚本" min-width="160" show-overflow-tooltip />
        <el-table-column label="状态" width="130">
          <template #default="{ row }"><StatusBadge :value="row.status" /></template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="180">
          <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </section>
</template>
