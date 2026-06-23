<script setup lang="ts">
import { Play, RefreshCw, SearchCheck, TimerReset } from 'lucide-vue-next'
import { ref } from 'vue'

import { http } from '@/api/http'
import JsonPreview from '@/components/JsonPreview.vue'

const taskId = ref('')
const limit = ref(10)
const loading = ref('')
const error = ref('')
const result = ref<unknown>(null)

async function run(key: string, request: () => Promise<unknown>) {
  loading.value = key
  error.value = ''
  try {
    result.value = await request()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '操作失败'
  } finally {
    loading.value = ''
  }
}
</script>

<template>
  <section class="space-y-5">
    <div>
      <h1 class="text-xl font-semibold text-ink">任务分发</h1>
    </div>

    <div v-if="error" class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ error }}
    </div>

    <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div class="rounded-md border border-line bg-white p-4 shadow-panel">
        <h2 class="text-sm font-semibold text-ink">分发控制</h2>
        <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label class="space-y-1.5">
            <span class="label">任务 ID</span>
            <input v-model="taskId" class="input" placeholder="指定任务 ID" />
          </label>
          <label class="space-y-1.5">
            <span class="label">扫描数量</span>
            <input v-model.number="limit" class="input" type="number" min="1" max="100" />
          </label>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <button
            class="btn btn-primary"
            type="button"
            :disabled="!taskId || loading === 'task'"
            @click="run('task', () => http.post(`/api/dispatcher/tasks/${taskId}/dispatch`))"
          >
            <Play class="h-4 w-4" />
            指定分发
          </button>
          <button
            class="btn btn-secondary"
            type="button"
            :disabled="loading === 'next'"
            @click="run('next', () => http.post('/api/dispatcher/dispatch-next'))"
          >
            <SearchCheck class="h-4 w-4" />
            下一条
          </button>
          <button
            class="btn btn-secondary"
            type="button"
            :disabled="loading === 'scan'"
            @click="run('scan', () => http.post('/api/dispatcher/dispatch-scan', undefined, { limit }))"
          >
            <RefreshCw class="h-4 w-4" />
            扫描分发
          </button>
        </div>
      </div>

      <div class="rounded-md border border-line bg-white p-4 shadow-panel">
        <h2 class="text-sm font-semibold text-ink">超时扫描</h2>
        <div class="mt-4 flex flex-wrap gap-2">
          <button
            class="btn btn-secondary"
            type="button"
            :disabled="loading === 'task-timeouts'"
            @click="run('task-timeouts', () => http.post('/api/tasks/scan-timeouts'))"
          >
            <TimerReset class="h-4 w-4" />
            任务超时
          </button>
          <button
            class="btn btn-secondary"
            type="button"
            :disabled="loading === 'runtime-timeouts'"
            @click="run('runtime-timeouts', () => http.post('/api/runtimes/scan-timeouts'))"
          >
            <TimerReset class="h-4 w-4" />
            Runtime 超时
          </button>
        </div>
      </div>
    </div>

    <div v-if="result" class="space-y-2">
      <h2 class="text-sm font-semibold text-slate-700">响应数据</h2>
      <JsonPreview :value="result" />
    </div>
  </section>
</template>
