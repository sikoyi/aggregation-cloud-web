<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { http } from '@/api/http'
import RelationCell from '@/components/RelationCell.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import type { AnyRecord } from '@/types/api'
import type { RemoteSelectConfig } from '@/types/crud'
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
const activeTab = ref('basic')
const currentTaskId = ref<string | null>(null)
const taskHistory = ref<string[]>([])

const scriptRelationConfig: RemoteSelectConfig = {
  endpoint: '/api/scripts',
  labelKey: 'name',
  valueKey: 'script_key',
  detailPath: (value: string) => `/api/scripts/by-key/${encodeURIComponent(value)}`,
}

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

const paramRows = computed(() => objectRows(task.value?.params, PARAM_LABELS, HIDDEN_PARAM_KEYS))
const isChildTask = computed(() => Boolean(task.value?.parent_task_run_id))

const detailTitle = computed(() => {
  if (!task.value) return '任务详情'
  return `任务详情：${task.value.title || truncateId(task.value.id)}`
})

function text(value: unknown) {
  return value === undefined || value === null || value === '' ? '-' : String(value)
}

const PARAM_LABELS: Record<string, string> = {
  slot_ids: '设备列表',
  execution_count: '每台设备执行次数',
  child_total: '设备执行总数',
  self_check: '自检标记',
  source: '来源',
}

const HIDDEN_PARAM_KEYS = new Set([
  'batch_index',
  'batch_total',
  'execution_index',
  'execution_total',
  'slot_index',
  'slot_total',
  'slot_id',
])

function objectRows(value: unknown, labels: Record<string, string>, hiddenKeys = new Set<string>()) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.entries(value as AnyRecord)
    .filter(([key, item]) => !hiddenKeys.has(key) && item !== undefined && item !== null && item !== '')
    .map(([key, item]) => ({
      key,
      label: labels[key] || key,
      value: formatValue(item),
    }))
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '-'
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return formatMaybeDate(value)
  if (Array.isArray(value)) return value.map((item) => formatValue(item)).join('、') || '-'
  if (typeof value === 'object') {
    const entries = Object.entries(value as AnyRecord)
      .filter(([, item]) => item !== undefined && item !== null && item !== '')
      .map(([key, item]) => `${key}: ${formatValue(item)}`)
    return entries.join('；') || '-'
  }
  return String(value)
}

function formatMaybeDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return value
  return formatDate(value)
}

function taskTime(key: string) {
  return formatDate(task.value?.[key])
}

function openChildDetail(row: AnyRecord) {
  const childId = String(row.id || '')
  if (!childId || !currentTaskId.value) return
  taskHistory.value.push(currentTaskId.value)
  currentTaskId.value = childId
  activeTab.value = 'basic'
  loadDetail(childId)
}

function backToPreviousTask() {
  const previousId = taskHistory.value.pop()
  if (!previousId) return
  currentTaskId.value = previousId
  activeTab.value = 'children'
  loadDetail(previousId)
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
    if (open && taskId) {
      currentTaskId.value = taskId
      taskHistory.value = []
      activeTab.value = 'basic'
      loadDetail(taskId)
    }
  },
  { immediate: true },
)
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="detailTitle"
    width="860px"
    class="task-detail-dialog"
    destroy-on-close
    append-to-body
    align-center
  >
    <div v-loading="loading" class="task-detail-body">
      <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />

      <template v-if="task">
        <div v-if="taskHistory.length" class="mb-3">
          <el-button size="small" @click="backToPreviousTask">返回父任务</el-button>
        </div>
        <el-tabs v-model="activeTab" class="task-detail-tabs">
          <el-tab-pane label="基础信息" name="basic">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="任务 ID">
                <span class="font-mono text-xs" :title="String(task.id || '')">{{ truncateId(task.id) }}</span>
              </el-descriptions-item>
              <el-descriptions-item label="状态">
                <StatusBadge :value="task.status" />
              </el-descriptions-item>
              <el-descriptions-item label="任务名称">{{ text(task.title) }}</el-descriptions-item>
              <el-descriptions-item label="业务平台">{{ text(task.business_platform) }}</el-descriptions-item>
              <el-descriptions-item label="脚本">
                <RelationCell :value="task.script_key" :config="scriptRelationConfig" />
              </el-descriptions-item>
              <el-descriptions-item v-if="isChildTask" label="账号">
                <span class="font-mono text-xs" :title="String(task.account_id || '')">{{ truncateId(task.account_id) }}</span>
              </el-descriptions-item>
              <el-descriptions-item v-if="isChildTask" label="设备">
                <span class="font-mono text-xs" :title="String(task.slot_id || '')">{{ truncateId(task.slot_id) }}</span>
              </el-descriptions-item>
              <el-descriptions-item v-if="isChildTask" label="错误信息">
                {{ text(task.error_message) }}
              </el-descriptions-item>
              <el-descriptions-item label="来源模板">
                <span class="font-mono text-xs" :title="String(task.template_id || '')">{{ truncateId(task.template_id) }}</span>
              </el-descriptions-item>
              <el-descriptions-item label="超时秒">{{ text(task.timeout_seconds) }}</el-descriptions-item>
              <el-descriptions-item label="计划时间">{{ taskTime('scheduled_at') }}</el-descriptions-item>
              <el-descriptions-item label="创建时间">{{ taskTime('created_at') }}</el-descriptions-item>
              <el-descriptions-item label="更新时间">{{ taskTime('updated_at') }}</el-descriptions-item>
              <el-descriptions-item label="领取时间">{{ taskTime('claimed_at') }}</el-descriptions-item>
              <el-descriptions-item label="开始时间">{{ taskTime('started_at') }}</el-descriptions-item>
              <el-descriptions-item label="结束时间">{{ taskTime('finished_at') }}</el-descriptions-item>
            </el-descriptions>

            <div class="detail-section">
              <div class="detail-section__title">执行结果</div>
              <el-alert
                v-if="resultDescription"
                class="mb-3"
                :title="resultDescription"
                type="success"
                show-icon
                :closable="false"
              />
              <el-empty v-if="!resultDescription" description="暂无执行结果" :image-size="56" />
            </div>

            <div class="detail-section">
              <div class="detail-section__title">脚本参数快照</div>
              <el-empty v-if="!paramRows.length" description="暂无脚本参数" :image-size="56" />
              <el-table v-else :data="paramRows" border stripe>
                <el-table-column prop="label" label="参数" width="180" />
                <el-table-column prop="value" label="值" show-overflow-tooltip />
              </el-table>
            </div>
          </el-tab-pane>

          <el-tab-pane label="设备执行记录" name="children">
            <el-table :data="children" border stripe empty-text="暂无设备执行记录">
              <el-table-column label="子任务 ID" min-width="130">
                <template #default="{ row }">
                  <span class="font-mono text-xs" :title="String(row.id || '')">{{ truncateId(row.id) }}</span>
                </template>
              </el-table-column>
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
              <el-table-column label="操作" width="90" align="center" header-align="center">
                <template #default="{ row }">
                  <el-button text type="primary" @click="openChildDetail(row)">查看</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="执行时间线" name="events">
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
                </div>
              </el-timeline-item>
            </el-timeline>
          </el-tab-pane>

          <el-tab-pane label="分配记录" name="assignments">
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
  </el-dialog>
</template>

<style scoped>
.task-detail-body {
  min-height: 280px;
  max-height: 68vh;
  overflow-y: auto;
}

.task-detail-tabs :deep(.el-tabs__header) {
  margin-bottom: 14px;
}

.task-detail-tabs :deep(.el-table) {
  width: 100%;
}

.detail-section {
  margin-top: 16px;
}

.detail-section__title {
  margin-bottom: 8px;
  color: #1f2937;
  font-size: 13px;
  font-weight: 700;
}
</style>
