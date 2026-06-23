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
  { label: 'Slot', endpoint: '/api/execution-slots', total: 0, icon: Boxes },
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
      <button class="btn btn-secondary" type="button" :disabled="loading" @click="loadDashboard">
        <Activity class="h-4 w-4" />
        刷新
      </button>
    </div>

    <div v-if="error" class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ error }}
    </div>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <div v-for="item in stats" :key="item.endpoint" class="rounded-md border border-line bg-white p-4 shadow-panel">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-slate-600">{{ item.label }}</span>
          <component :is="item.icon" class="h-4 w-4 text-brand-600" />
        </div>
        <div class="mt-3 text-2xl font-semibold text-ink">{{ item.total }}</div>
      </div>
    </div>

    <div class="overflow-hidden border-y border-line bg-white">
      <div class="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 class="text-sm font-semibold text-ink">最近任务</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-line text-left text-sm">
          <thead class="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th class="px-4 py-3">ID</th>
              <th class="px-4 py-3">标题</th>
              <th class="px-4 py-3">脚本</th>
              <th class="px-4 py-3">状态</th>
              <th class="px-4 py-3">创建时间</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr v-if="!recentTasks.length">
              <td colspan="5" class="px-4 py-8 text-center text-slate-500">暂无数据</td>
            </tr>
            <tr v-for="task in recentTasks" :key="String(task.id)" class="hover:bg-slate-50">
              <td class="px-4 py-3 font-mono text-xs" :title="String(task.id)">{{ truncateId(task.id) }}</td>
              <td class="px-4 py-3">{{ task.title || '-' }}</td>
              <td class="px-4 py-3">{{ task.script_key }}</td>
              <td class="px-4 py-3"><StatusBadge :value="task.status" /></td>
              <td class="px-4 py-3">{{ formatDate(task.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
