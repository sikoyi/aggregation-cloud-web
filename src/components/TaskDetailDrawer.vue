<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { http } from '@/api/http'
import JsonPreview from '@/components/JsonPreview.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import type { AnyRecord } from '@/types/api'
import { formatDate, statusLabel, truncateId } from '@/utils/format'

const props = defineProps<{
  modelValue: boolean
  taskId: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const loading = ref(false)
const error = ref('')
const task = ref<AnyRecord | null>(null)
const events = ref<AnyRecord[]>([])
const assignments = ref<AnyRecord[]>([])
const children = ref<AnyRecord[]>([])

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const resultDescription = computed(() => {
  const result = task.value?.result
  if (result && typeof result === 'object' && 'description' in result) {
    return String((result as AnyRecord).description || '')
  }
  return ''
})

const drawerTitle = computed(() => {
  if (!task.value) return '任务详情'
  return `任务详情：${task.value.title || truncateId(task.value.id)}`
})

function text(value: unknown) {
  return value === undefined || value === null || value === '' ? '-' : String(value)
}

function taskTime(key: string) {
  return formatDate(task.value?.[key])
}

function timelineTitle(event: AnyRecord) {
  const from = event.status_from ? statusLabel(event.status_from) : ''
  const to = event.status_to ? statusLabel(event.status_to) : ''
  if (from && to) return `${event.event_type}：${from} -> ${to}`
  if (to) return `${event.event_type}：${to}`
  return String(event.event_type || '任务事件')
}

async function loadDetail(taskId: string) {
  loading.value = true
  error.value = ''
  try {
    const [detail, eventData, assignmentData, childData] = await Promise.all([
      http.get<AnyRecord>(`/api/tasks/${encodeURIComponent(taskId)}`),
      http.get<{ items: AnyRecord[] }>(`/api/tasks/${encodeURIComponent(taskId)}/events`),
      http.get<{ items: AnyRecord[] }>(`/api/tasks/${encodeURIComponent(taskId)}/assignments`),
      http.get<{ items: AnyRecord[] }>(`/api/tasks/${encodeURIComponent(taskId)}/children`),
    ])
    task.value = detail
    events.value = eventData.items || []
    assignments.value = assignmentData.items || []
    children.value = childData.items || []
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载任务详情失败'
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.modelValue, props.taskId] as const,
  ([open, taskId]) => {
    if (open && taskId) loadDetail(taskId)
  },
  { immediate: true },
)
</script>

<template>
  <el-drawer v-model="visible" :title="drawerTitle" size="860px" destroy-on-close>
    <div v-loading="loading" class="space-y-4">
      <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />

      <template v-if="task">
        <el-card shadow="never">
          <template #header>
            <span class="text-sm font-semibold text-ink">基础信息</span>
          </template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="任务 ID">
              <span class="font-mono text-xs" :title="String(task.id || '')">{{ truncateId(task.id) }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="状态">
              <StatusBadge :value="task.status" />
            </el-descriptions-item>
            <el-descriptions-item label="标题">{{ text(task.title) }}</el-descriptions-item>
            <el-descriptions-item label="业务平台">{{ text(task.business_platform) }}</el-descriptions-item>
            <el-descriptions-item label="脚本 Key">{{ text(task.script_key) }}</el-descriptions-item>
            <el-descriptions-item label="来源模板">
              <span class="font-mono text-xs" :title="String(task.template_id || '')">{{ truncateId(task.template_id) }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="账号">
              <span class="font-mono text-xs" :title="String(task.account_id || '')">{{ truncateId(task.account_id) }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="设备">
              <span class="font-mono text-xs" :title="String(task.slot_id || '')">{{ truncateId(task.slot_id) }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="超时秒">{{ text(task.timeout_seconds) }}</el-descriptions-item>
            <el-descriptions-item label="计划时间">{{ taskTime('scheduled_at') }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ taskTime('created_at') }}</el-descriptions-item>
            <el-descriptions-item label="更新时间">{{ taskTime('updated_at') }}</el-descriptions-item>
            <el-descriptions-item label="领取时间">{{ taskTime('claimed_at') }}</el-descriptions-item>
            <el-descriptions-item label="开始时间">{{ taskTime('started_at') }}</el-descriptions-item>
            <el-descriptions-item label="结束时间">{{ taskTime('finished_at') }}</el-descriptions-item>
            <el-descriptions-item label="错误信息">{{ text(task.error_message) }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card shadow="never">
          <template #header>
            <span class="text-sm font-semibold text-ink">执行结果</span>
          </template>
          <el-alert
            v-if="resultDescription"
            class="mb-3"
            :title="resultDescription"
            type="success"
            show-icon
            :closable="false"
          />
          <JsonPreview :value="task.result || {}" />
        </el-card>

        <el-tabs>
          <el-tab-pane label="参数快照">
            <JsonPreview :value="task.params || {}" />
          </el-tab-pane>

          <el-tab-pane label="设备执行记录">
            <el-table :data="children" border stripe empty-text="暂无设备执行记录">
              <el-table-column label="子任务 ID" min-width="130">
                <template #default="{ row }">
                  <span class="font-mono text-xs" :title="String(row.id || '')">{{ truncateId(row.id) }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
              <el-table-column label="设备" min-width="130">
                <template #default="{ row }">
                  <span class="font-mono text-xs" :title="String(row.slot_id || '')">{{ truncateId(row.slot_id) }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="status" label="状态" width="120">
                <template #default="{ row }">
                  <StatusBadge :value="row.status" />
                </template>
              </el-table-column>
              <el-table-column label="结果描述" min-width="180" show-overflow-tooltip>
                <template #default="{ row }">{{ text(row.result?.description || row.error_message) }}</template>
              </el-table-column>
              <el-table-column label="开始时间" min-width="170">
                <template #default="{ row }">{{ formatDate(row.started_at) }}</template>
              </el-table-column>
              <el-table-column label="结束时间" min-width="170">
                <template #default="{ row }">{{ formatDate(row.finished_at) }}</template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="执行时间线">
            <el-empty v-if="!events.length" description="暂无事件" />
            <el-timeline v-else>
              <el-timeline-item
                v-for="event in events"
                :key="String(event.id)"
                :timestamp="formatDate(event.created_at)"
                placement="top"
              >
                <div class="rounded-md border border-line bg-white p-3">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-medium text-ink">{{ timelineTitle(event) }}</span>
                    <StatusBadge v-if="event.status_to" :value="event.status_to" />
                  </div>
                  <p v-if="event.message" class="mt-2 text-sm text-slate-600">{{ event.message }}</p>
                  <JsonPreview v-if="event.metadata && Object.keys(event.metadata).length" class="mt-3" :value="event.metadata" />
                </div>
              </el-timeline-item>
            </el-timeline>
          </el-tab-pane>

          <el-tab-pane label="分配记录">
            <el-table :data="assignments" border stripe empty-text="暂无分配记录">
              <el-table-column prop="runtime_id" label="Runtime" min-width="160" show-overflow-tooltip />
              <el-table-column prop="slot_id" label="设备" min-width="160" show-overflow-tooltip />
              <el-table-column prop="status" label="状态" width="120">
                <template #default="{ row }">
                  <StatusBadge :value="row.status" />
                </template>
              </el-table-column>
              <el-table-column label="分配时间" min-width="170">
                <template #default="{ row }">{{ formatDate(row.assigned_at) }}</template>
              </el-table-column>
              <el-table-column label="更新时间" min-width="170">
                <template #default="{ row }">{{ formatDate(row.updated_at) }}</template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </template>
    </div>
  </el-drawer>
</template>
