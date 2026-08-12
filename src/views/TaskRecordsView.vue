<script setup lang="ts">
import { ClipboardList, Plus, RefreshCw } from 'lucide-vue-next'
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import CrudPage from '@/components/CrudPage.vue'
import { resources } from '@/config/resources'
import { useAuthStore } from '@/stores/auth'

const taskConfig = computed(() => resources.tasks)
const taskPageRef = ref<InstanceType<typeof CrudPage> | null>(null)
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

function refreshTasks() {
  taskPageRef.value?.loadRows()
}

function openDispatch() {
  taskPageRef.value?.openCreate()
}

// 工作台快捷入口进入任务记录后直接打开任务下发表单。
watch(
  () => route.query.action,
  async (action) => {
    if (action !== 'create') return
    await nextTick()
    await taskPageRef.value?.openCreate()
    const query = { ...route.query }
    delete query.action
    await router.replace({ path: route.path, query })
  },
  { immediate: true, flush: 'post' },
)
</script>

<template>
  <section class="task-records">
    <el-card shadow="never" class="task-records__workspace">
      <div class="task-records__header">
        <div class="task-records__title">
          <div class="task-records__icon"><ClipboardList class="h-5 w-5" /></div>
          <div class="min-w-0">
            <h1>任务记录</h1>
            <p>查看任务状态和执行结果，设备明细集中在任务详情中。</p>
          </div>
        </div>
        <div class="task-records__actions">
          <el-tooltip content="刷新" placement="bottom">
            <el-button :icon="RefreshCw" circle @click="refreshTasks" />
          </el-tooltip>
          <el-button v-if="auth.can('tasks.dispatch')" type="primary" :icon="Plus" @click="openDispatch">下发任务</el-button>
        </div>
      </div>

      <div class="task-records__body">
        <CrudPage ref="taskPageRef" :config="taskConfig" embedded hide-header-actions />
      </div>
    </el-card>
  </section>
</template>

<style scoped>
.task-records__workspace { --task-records-content-inset: 16px; border-radius: 8px; border-color: #d9e2ec; }
.task-records__workspace :deep(.el-card__body) { padding: 0; }
.task-records__header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 13px var(--task-records-content-inset); border-bottom: 1px solid #e6edf3; background: #fff; }
.task-records__title,
.task-records__actions { display: flex; align-items: center; }
.task-records__title { min-width: 0; gap: 10px; }
.task-records__actions { flex: 0 0 auto; justify-content: flex-end; gap: 10px; }
.task-records__icon { display: inline-flex; width: 34px; height: 34px; flex: 0 0 34px; align-items: center; justify-content: center; border-radius: 8px; color: #1f668f; background: #eef8ff; }
.task-records__title h1 { color: #1f2933; font-size: 18px; font-weight: 700; line-height: 1.25; }
.task-records__title p { margin-top: 3px; color: #66788a; font-size: 12px; }
.task-records__body { padding: 14px var(--task-records-content-inset) 16px; background: #f8fafc; }
@media (max-width: 768px) {
  .task-records__header { align-items: flex-start; flex-direction: column; }
  .task-records__actions { width: 100%; }
  .task-records__body { padding: 12px; }
}
</style>
