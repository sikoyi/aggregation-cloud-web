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

    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />

    <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <el-card shadow="never" class="tool-card">
        <template #header>
          <span class="text-sm font-semibold text-ink">分发控制</span>
        </template>
        <el-form label-position="top">
          <el-row :gutter="16">
            <el-col :xs="24" :md="12">
              <el-form-item label="任务 ID">
                <el-input v-model="taskId" clearable placeholder="指定任务 ID" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :md="12">
              <el-form-item label="扫描数量">
                <el-input-number v-model="limit" :min="1" :max="100" class="w-full" controls-position="right" />
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
        <el-space wrap>
          <el-button
            type="primary"
            :icon="Play"
            :disabled="!taskId"
            :loading="loading === 'task'"
            @click="run('task', () => http.post(`/api/dispatcher/tasks/${taskId}/dispatch`))"
          >
            指定分发
          </el-button>
          <el-button
            :icon="SearchCheck"
            :loading="loading === 'next'"
            @click="run('next', () => http.post('/api/dispatcher/dispatch-next'))"
          >
            下一条
          </el-button>
          <el-button
            :icon="RefreshCw"
            :loading="loading === 'scan'"
            @click="run('scan', () => http.post('/api/dispatcher/dispatch-scan', undefined, { limit }))"
          >
            扫描分发
          </el-button>
        </el-space>
      </el-card>

      <el-card shadow="never" class="tool-card">
        <template #header>
          <span class="text-sm font-semibold text-ink">超时扫描</span>
        </template>
        <el-space wrap>
          <el-button
            :icon="TimerReset"
            :loading="loading === 'task-timeouts'"
            @click="run('task-timeouts', () => http.post('/api/tasks/scan-timeouts'))"
          >
            任务超时
          </el-button>
          <el-button
            :icon="TimerReset"
            :loading="loading === 'runtime-timeouts'"
            @click="run('runtime-timeouts', () => http.post('/api/runtimes/scan-timeouts'))"
          >
            Runtime 超时
          </el-button>
        </el-space>
      </el-card>
    </div>

    <el-card v-if="result" shadow="never" class="result-card">
      <template #header>
        <span class="text-sm font-semibold text-slate-700">响应数据</span>
      </template>
      <JsonPreview :value="result" />
    </el-card>
  </section>
</template>
