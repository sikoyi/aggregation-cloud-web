<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { http } from '@/api/http'
import RelationCell from '@/components/RelationCell.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import type { AnyRecord } from '@/types/api'
import { businessPlatformLabel } from '@/config/options'
import type { RemoteSelectConfig } from '@/types/crud'
import { formatDate, statusLabel, truncateId } from '@/utils/format'
import { notifyError } from '@/utils/notify'

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
const paramRows = ref<Array<{ key: string; label: string; value: string }>>([])
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
  account_selection_strategy: '账号筛选策略',
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
  'selected_account_id',
  'selected_account_ids',
])

interface ScriptParamDefinition {
  param_key: string
  name: string
  param_type: string
}

async function buildParamRows(currentTask: AnyRecord) {
  const params = currentTask.params
  if (!params || typeof params !== 'object' || Array.isArray(params)) return []

  const definitions = await loadParamDefinitions(String(currentTask.script_key || ''))
  const definitionMap = new Map(definitions.map((item) => [item.param_key, item]))
  const rows = await Promise.all(
    Object.entries(params as AnyRecord)
      .filter(([key, item]) => !HIDDEN_PARAM_KEYS.has(key) && item !== undefined && item !== null && item !== '')
      .map(async ([key, item]) => {
        const definition = definitionMap.get(key)
        return {
          key,
          label: definition?.name || PARAM_LABELS[key] || key,
          value: key === 'account_selection_strategy'
            ? accountSelectionStrategyLabel(item)
            : await formatParamValue(item, definition),
        }
      }),
  )
  return rows
}

async function loadParamDefinitions(scriptKey: string): Promise<ScriptParamDefinition[]> {
  if (!scriptKey) return []
  try {
    const script = await http.get<AnyRecord>(`/api/scripts/by-key/${encodeURIComponent(scriptKey)}`)
    return await http.get<ScriptParamDefinition[]>(`/api/scripts/${encodeURIComponent(String(script.id))}/params`)
  } catch {
    return []
  }
}

async function formatParamValue(value: unknown, definition?: ScriptParamDefinition) {
  const type = definition?.param_type || ''
  if (['proxy', 'res', 'proxy_group', 'account', 'execution_slot'].includes(type)) {
    return formatResourceParamValue(value, type)
  }
  return formatValue(value)
}

async function formatResourceParamValue(value: unknown, type: string) {
  // 资源类参数在任务里保存 ID，详情页回显时转换成运营更容易识别的名称。
  const ids = normalizeResourceIds(value, type)
  if (!ids.length) return '-'
  const labels = await Promise.all(ids.map((id) => loadResourceLabel(id, type)))
  return labels.join('、')
}

function normalizeResourceIds(value: unknown, type: string) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  if (type === 'proxy_group' && value && typeof value === 'object') {
    const record = value as AnyRecord
    const groupId = record.group_id || record.id || record.value
    return groupId ? [String(groupId)] : []
  }
  return value ? [String(value)] : []
}

function accountSelectionStrategyLabel(value: unknown) {
  const labels: Record<string, string> = {
    all: '全部账号',
    not_logged_in: '仅未登录账号',
  }
  return labels[String(value || '')] || text(value)
}

async function loadResourceLabel(id: string, type: string) {
  try {
    const resource = await http.get<AnyRecord>(resourceDetailPath(id, type))
    const name = resourceDisplayName(resource, type)
    if (type === 'proxy_group') return name
    if (type === 'execution_slot') {
      const deviceId = text(resource.provider_slot_id)
      return name === deviceId ? deviceId : `${name}（设备 ID：${deviceId}）`
    }
    return `${name}（${truncateId(id)}）`
  } catch {
    if (type === 'execution_slot') return '设备信息加载失败'
    return truncateId(id)
  }
}

function resourceDetailPath(id: string, type: string) {
  if (type === 'account') return `/api/accounts/${encodeURIComponent(id)}`
  if (type === 'proxy_group') return `/api/resource-center/proxy-groups/${encodeURIComponent(id)}`
  if (type === 'execution_slot') return `/api/execution-slots/${encodeURIComponent(id)}`
  return `/api/resource-center/proxies/${encodeURIComponent(id)}`
}

function resourceDisplayName(resource: AnyRecord, type: string) {
  if (type === 'account') {
    return text(resource.login_username || resource.username || resource.display_name || resource.platform_account_id)
  }
  if (type === 'proxy_group') return text(resource.name)
  if (type === 'execution_slot') return text(resource.display_name || resource.provider_slot_id || resource.provider_slot_no)
  return text(resource.name || resource.source_proxy_url || resource.host)
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
  paramRows.value = []
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
    paramRows.value = await buildParamRows(detail)
  } catch (err) {
    error.value = notifyError(err, '加载失败', '加载任务详情失败')
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
              <el-descriptions-item label="业务平台">{{ businessPlatformLabel(task.business_platform) }}</el-descriptions-item>
              <el-descriptions-item label="脚本">
                <RelationCell :value="task.script_key" :config="scriptRelationConfig" />
              </el-descriptions-item>
              <el-descriptions-item v-if="isChildTask" label="账号">
                <span class="font-mono text-xs" :title="String(task.account_id || '')">{{ truncateId(task.account_id) }}</span>
              </el-descriptions-item>
              <el-descriptions-item v-if="isChildTask" label="设备名称">
                {{ text(task.slot_name) }}
              </el-descriptions-item>
              <el-descriptions-item v-if="isChildTask" label="设备 ID">
                <span class="font-mono text-xs">{{ text(task.provider_slot_id) }}</span>
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
              <el-table-column label="设备" min-width="190">
                <template #default="{ row }">
                  <div class="task-device-cell">
                    <span>{{ text(row.slot_name) }}</span>
                    <code>{{ text(row.provider_slot_id) }}</code>
                  </div>
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
              <el-table-column label="设备" min-width="190">
                <template #default="{ row }">
                  <div class="task-device-cell">
                    <span>{{ text(row.slot_name) }}</span>
                    <code>{{ text(row.provider_slot_id) }}</code>
                  </div>
                </template>
              </el-table-column>
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

.task-device-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
  line-height: 1.35;
}

.task-device-cell span,
.task-device-cell code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-device-cell code {
  color: #64748b;
  font-size: 11px;
}
</style>
