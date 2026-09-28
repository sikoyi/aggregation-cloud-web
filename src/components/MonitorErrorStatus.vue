<script setup lang="ts">
import { computed, ref } from 'vue'
import { http } from '@/api/http'
import { formatDate } from '@/utils/format'
import { monitorErrorDetails, safeMonitorError } from '@/utils/monitorError'
import type { AnyRecord } from '@/types/api'

const props = defineProps<{ label: string; data: AnyRecord; endpoint?: string }>()
const visible = ref(false)
const loading = ref(false)
const loadError = ref('')
const current = ref<AnyRecord>({})
const details = computed(() => monitorErrorDetails(current.value))
async function open() {
  current.value = props.data
  loadError.value = ''
  visible.value = true
  if (!props.endpoint || loading.value) return
  loading.value = true
  try {
    current.value = await http.get<AnyRecord>(props.endpoint)
  } catch (error) {
    loadError.value = safeMonitorError(error instanceof Error ? error.message : '读取最新异常失败')
  } finally { loading.value = false }
}
</script>

<template>
  <button type="button" class="monitor-error-status" :aria-label="`${label}，查看详细原因`" @click.stop="open">{{ label }}</button>
  <el-dialog v-model="visible" title="监听异常详情" width="640px" append-to-body class="monitor-error-dialog">
    <div v-loading="loading">
      <el-alert v-if="loadError" :title="loadError" type="warning" :closable="false" />
      <dl>
        <dt>详细原因</dt><dd class="reason">{{ details.reason }}</dd>
        <dt>失败时间</dt><dd>{{ details.time ? formatDate(String(details.time)) : '未记录' }}</dd>
        <dt>失败阶段</dt><dd>{{ details.phase ? safeMonitorError(details.phase) : '未记录' }}</dd>
        <dt>采集记录 ID</dt><dd>{{ details.runId ? safeMonitorError(details.runId) : '未记录' }}</dd>
        <template v-if="details.taskId"><dt>任务 ID</dt><dd>{{ safeMonitorError(details.taskId) }}</dd></template>
      </dl>
    </div>
    <template #footer><el-button @click="visible = false">关闭</el-button></template>
  </el-dialog>
</template>

<style scoped>
.monitor-error-status { color: var(--el-color-danger); background: var(--el-color-danger-light-9); border: 1px solid var(--el-color-danger-light-8); border-radius: 4px; padding: 2px 7px; font: inherit; font-size: 12px; cursor: pointer; }
.monitor-error-status:hover { text-decoration: underline; }
dl { display: grid; gap: 10px 16px; grid-template-columns: 100px minmax(0, 1fr); }
dt { color: var(--el-text-color-secondary); }
dd { margin: 0; overflow-wrap: anywhere; white-space: pre-wrap; }
.reason { max-height: 320px; overflow: auto; }
:global(.monitor-error-dialog) { max-width: calc(100vw - 32px); }
</style>
