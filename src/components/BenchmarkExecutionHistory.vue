<script setup lang="ts">
import { Eye, RefreshCw } from 'lucide-vue-next'
import { ref, watch } from 'vue'
import { http } from '@/api/http'
import { formatDate } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import TaskDetailDrawer from '@/components/TaskDetailDrawer.vue'

const props = defineProps<{ reviewId: string; taskId: string | null }>()
interface Attempt { id: string; status: string; created_at: string; finished_at: string | null }
const auth = useAuthStore()
const history = ref<{ root_task_id: string | null; items: Attempt[] }>({ root_task_id: null, items: [] })
const loading = ref(false)
const error = ref(false)
const detailVisible = ref(false)
const detailId = ref<string | null>(null)
let request = 0
const labels: Record<string, string> = { succeeded: '发布成功', failed: '发布失败', all_failed: '发布失败', partial_failed: '部分失败',
  expired: '已超时', lost: '结果丢失', canceled: '已取消', queued: '等待发布', running: '发布中', dispatched: '已下发', accepted: '已接收' }
async function load() {
  const id = ++request
  loading.value = true
  error.value = false
  history.value = { root_task_id: null, items: [] }
  try {
    const result = await http.get<typeof history.value>(`/api/benchmark-trackers/reviews/${encodeURIComponent(props.reviewId)}/executions`)
    if (id === request) history.value = result
  } catch { if (id === request) error.value = true }
  finally { if (id === request) loading.value = false }
}
watch(() => [props.reviewId, props.taskId], () => { detailVisible.value = false; void load() }, { immediate: true })
function open(id: string) { detailId.value = id; detailVisible.value = true }
</script>

<template>
  <section v-if="taskId || history.items.length || error" class="execution-history" aria-label="发布执行记录">
    <h3>发布执行记录 <small v-if="history.root_task_id">首次任务 #{{ history.root_task_id }}</small></h3>
    <div v-if="error" role="alert">执行记录加载失败 <el-button :icon="RefreshCw" text @click="load">重试</el-button></div>
    <el-table v-else v-loading="loading" :data="history.items" max-height="260" row-key="id">
      <el-table-column label="执行" width="95"><template #default="{ $index }">{{ $index ? `重试 ${$index}` : '首次执行' }}</template></el-table-column>
      <el-table-column prop="id" label="任务 ID" min-width="100" />
      <el-table-column label="状态" min-width="110"><template #default="{ row }"><el-tag :type="row.status === 'succeeded' ? 'success' : ['failed', 'all_failed', 'expired', 'lost'].includes(row.status) ? 'danger' : 'info'">{{ labels[row.status] || '处理中' }}</el-tag></template></el-table-column>
      <el-table-column label="创建时间" min-width="175"><template #default="{ row }">{{ formatDate(row.created_at) }}</template></el-table-column>
      <el-table-column v-if="auth.can('tasks.view')" label="操作" width="70"><template #default="{ row }"><el-tooltip content="查看执行详情"><el-button :icon="Eye" text circle aria-label="查看执行详情" @click="open(row.id)" /></el-tooltip></template></el-table-column>
    </el-table>
    <TaskDetailDrawer v-model="detailVisible" :task-id="detailId" />
  </section>
</template>

<style scoped>
.execution-history { margin-top: 20px; min-width: 0; }
.execution-history h3 { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; font-size: 14px; margin: 0 0 12px; }
.execution-history small { font-size: 12px; font-weight: normal; color: var(--el-text-color-secondary); }
</style>
