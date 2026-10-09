<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Copy, Maximize2 } from 'lucide-vue-next'
import { ElNotification } from 'element-plus'
import TaskParameterValue from '@/components/TaskParameterValue.vue'
import { parseParameterDisplay } from '@/utils/taskParameterDisplay'

import { http } from '@/api/http'
import RelationCell from '@/components/RelationCell.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import type { AnyRecord, PageResult } from '@/types/api'
import { businessPlatformLabel } from '@/config/options'
import type { RemoteSelectConfig } from '@/types/crud'
import { formatDate, statusLabel, truncateId } from '@/utils/format'
import { notifyError } from '@/utils/notify'
import { isTaskGroup, taskResultAlertType } from '@/utils/taskResultCounts'

const props = defineProps<{
  modelValue: boolean
  taskId: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const loading = ref(false)
const compact = ref(false)
const detailMedia = window.matchMedia('(max-width: 600px)')
function updateCompact() { compact.value = detailMedia.matches }
onMounted(() => { updateCompact(); detailMedia.addEventListener('change', updateCompact) })
onBeforeUnmount(() => { detailMedia.removeEventListener('change', updateCompact) })
const error = ref('')
const task = ref<AnyRecord | null>(null)
const events = ref<AnyRecord[]>([])
const children = ref<AnyRecord[]>([])
const childLoading = ref(false)
const childPage = ref(1)
const childPageSize = ref(20)
const childTotal = ref(0)
const paramRows = ref<Array<{ key: string; label: string; value: string }>>([])
const activeTab = ref('basic')
const currentTaskId = ref<string | null>(null)
const taskHistory = ref<string[]>([])
const activeSlotGroups = ref<string[]>([])
const snapshotVisible = ref(false)
const snapshotText = computed(() => JSON.stringify({
  parameters: paramRows.value.map(row => ({ key: row.key, name: row.label, value: parseParameterDisplay(row.value) })),
  device_groups: parameterSlotGroups.value.map(group => ({ name: group.group_name, count: group.slot_count,
    devices: group.slots.map(slot => ({ name: slot.slot_name, device_id: slot.provider_slot_id })),
  })),
}, null, 2))
watch(() => [props.taskId, props.modelValue], () => { snapshotVisible.value = false })
async function copySnapshot() {
  try {
    await navigator.clipboard.writeText(snapshotText.value)
    ElNotification.success({ title: '已复制参数快照', message: '仅包含当前可见参数' })
  } catch (error) { notifyError(error, '复制失败') }
}

const scriptRelationConfig: RemoteSelectConfig = {
  endpoint: '/api/task-script-options',
  labelKey: 'name',
  valueKey: 'script_key',
  detailPath: (value: string) => `/api/task-script-options/by-key/${encodeURIComponent(value)}`,
}

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const resultDescription = computed(() => {
  const result = task.value?.result
  if (result && typeof result === 'object' && 'description' in result) {
    return String((result as AnyRecord).description || task.value?.error_message || '')
  }
  return String(task.value?.error_message || '')
})

const resultType = computed(() => taskResultAlertType(task.value?.status))

const isSingleExecution = computed(() => Boolean(task.value && !isTaskGroup(task.value)))
const executionRows = computed(() => isSingleExecution.value && task.value ? [task.value] : children.value)

const showChildAccountColumn = computed(() => (
  executionRows.value.some((item) => Boolean(String(item.account_id || '').trim()))
))

const detailTitle = computed(() => {
  if (!task.value) return '任务详情'
  return `任务详情：${task.value.title || truncateId(task.value.id)}`
})

interface TaskParameterSlot {
  provider_slot_id?: string | null
  slot_name: string
  available: boolean
}

interface TaskParameterSlotGroup {
  group_id?: string | null
  group_name: string
  slot_count: number
  slots: TaskParameterSlot[]
}

const parameterSlotGroups = computed<TaskParameterSlotGroup[]>(() => {
  const groups = task.value?.parameter_slot_groups
  return Array.isArray(groups) ? groups : []
})

const parameterSlotTotal = computed(() => (
  parameterSlotGroups.value.reduce((total, group) => total + group.slot_count, 0)
))

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
  '_generation_plan',
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
  const hasGroupedSlots = Array.isArray(currentTask.parameter_slot_groups)
    && currentTask.parameter_slot_groups.length > 0
  const rows = await Promise.all(
    Object.entries(params as AnyRecord)
      .filter(([key, item]) => (
        !HIDDEN_PARAM_KEYS.has(key)
        && !(key === 'slot_ids' && hasGroupedSlots)
        && item !== undefined
        && item !== null
        && item !== ''
      ))
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
    const script = await http.get<AnyRecord>(`/api/task-script-options/by-key/${encodeURIComponent(scriptKey)}`)
    return await http.get<ScriptParamDefinition[]>(`/api/task-script-options/${encodeURIComponent(String(script.id))}/params`)
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
  if (type === 'execution_slot') return text(resource.display_name || resource.provider_slot_id)
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

function accountPrimaryLabel(row: AnyRecord) {
  if (!row.account_id) return '-'
  return text(row.account_display_name || row.account_username || row.account_login_username || `账号 ${row.account_id}`)
}

function accountSecondaryLabel(row: AnyRecord) {
  if (!row.account_id) return ''
  const primary = accountPrimaryLabel(row)
  const username = String(row.account_username || '').trim()
  const loginUsername = String(row.account_login_username || '').trim()
  const details: string[] = []
  if (username && username !== primary) details.push(`@${username.replace(/^@/, '')}`)
  if (loginUsername && loginUsername !== primary && loginUsername !== username) details.push(loginUsername)
  details.push(`账号 ID ${row.account_id}`)
  return details.join(' · ')
}

function slotGroupKey(group: TaskParameterSlotGroup, index: number) {
  return group.group_id || `${group.group_name}-${index}`
}

function openChildDetail(row: AnyRecord) {
  const childId = String(row.id || '')
  if (!childId || !currentTaskId.value) return
  if (childId === currentTaskId.value) {
    activeTab.value = 'events'
    return
  }
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

let detailRequestId = 0
let childRequestId = 0

function invalidateRequests() {
  detailRequestId += 1
  childRequestId += 1
  loading.value = false
  childLoading.value = false
}

async function loadChildren(taskId: string) {
  const requestId = ++childRequestId
  childLoading.value = true
  children.value = []
  error.value = ''
  try {
    const childData = await http.get<PageResult<AnyRecord>>(
      '/api/tasks/' + encodeURIComponent(taskId) + '/children',
      { page: childPage.value, page_size: childPageSize.value },
    )
    if (requestId !== childRequestId) return
    children.value = childData.items || []
    childTotal.value = Number(childData.total || 0)
  } catch (err) {
    if (requestId === childRequestId) error.value = notifyError(err, '加载失败', '加载设备执行记录失败')
  } finally {
    if (requestId === childRequestId) childLoading.value = false
  }
}

async function changeChildPage(page: number) {
  if (!currentTaskId.value) return
  childPage.value = page
  await loadChildren(currentTaskId.value)
}

async function changeChildPageSize(pageSize: number) {
  if (!currentTaskId.value) return
  childPageSize.value = pageSize
  childPage.value = 1
  await loadChildren(currentTaskId.value)
}

async function loadDetail(taskId: string) {
  invalidateRequests()
  const requestId = detailRequestId
  loading.value = true
  task.value = null
  events.value = []
  error.value = ''
  paramRows.value = []
  activeSlotGroups.value = []
  children.value = []
  childTotal.value = 0
  childPage.value = 1
  try {
    const [detail, eventData] = await Promise.all([
      http.get<AnyRecord>(`/api/tasks/${encodeURIComponent(taskId)}`),
      http.get<{ items: AnyRecord[] }>(`/api/tasks/${encodeURIComponent(taskId)}/events`),
    ])
    if (requestId !== detailRequestId) return
    task.value = detail
    events.value = eventData.items || []
    if (isTaskGroup(detail)) await loadChildren(taskId)
    if (requestId !== detailRequestId) return
    const rows = await buildParamRows(detail)
    if (requestId === detailRequestId) paramRows.value = rows
  } catch (err) {
    if (requestId === detailRequestId) error.value = notifyError(err, '加载失败', '加载任务详情失败')
  } finally {
    if (requestId === detailRequestId) loading.value = false
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
    } else {
      invalidateRequests()
    }
  },
  { immediate: true },
)

onBeforeUnmount(invalidateRequests)
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="detailTitle"
    width="min(1120px, calc(100vw - 32px))"
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
            <el-descriptions class="task-basic-info" :column="compact ? 1 : 2" :label-width="compact ? 90 : 110" border>
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
              <el-descriptions-item v-if="isSingleExecution" label="账号">
                <span class="font-mono text-xs" :title="String(task.account_id || '')">{{ truncateId(task.account_id) }}</span>
              </el-descriptions-item>
              <el-descriptions-item v-if="isSingleExecution" label="设备名称">
                {{ text(task.slot_name) }}
              </el-descriptions-item>
              <el-descriptions-item v-if="isSingleExecution" label="设备 ID">
                <span class="font-mono text-xs">{{ text(task.provider_slot_id) }}</span>
              </el-descriptions-item>
              <el-descriptions-item v-if="isSingleExecution" label="错误信息" :span="compact ? 1 : 2">
                <div class="task-error-detail" tabindex="0" aria-label="任务错误详情">{{ text(task.error_message) }}</div>
              </el-descriptions-item>
              <el-descriptions-item label="来源模板">
                <span :title="task.template_name ? '' : String(task.template_id || '')">
                  {{ task.template_name || (task.template_id ? '模板已删除或不可用' : '-') }}
                </span>
              </el-descriptions-item>
              <el-descriptions-item label="超时秒">{{ text(task.timeout_seconds) }}</el-descriptions-item>
              <el-descriptions-item v-if="task.child_generated != null" label="子任务生成">
                {{ task.child_generated }} / {{ task.child_total }}
              </el-descriptions-item>
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
                :type="resultType"
                show-icon
                :closable="false"
              />
              <el-empty v-if="!resultDescription" description="暂无执行结果" :image-size="56" />
            </div>

            <div class="detail-section">
              <div class="parameter-heading"><div class="detail-section__title">脚本参数快照</div><el-button :icon="Maximize2" @click="snapshotVisible = true">查看完整快照</el-button></div>
              <div v-if="parameterSlotGroups.length" class="task-slot-snapshot">
                <div class="task-slot-snapshot__header">
                  <span>设备列表</span>
                  <span>共 {{ parameterSlotTotal }} 台</span>
                </div>
                <el-collapse v-model="activeSlotGroups" class="task-slot-groups">
                  <el-collapse-item
                    v-for="(group, index) in parameterSlotGroups"
                    :key="slotGroupKey(group, index)"
                    :name="slotGroupKey(group, index)"
                  >
                    <template #title>
                      <div class="task-slot-group__title">
                        <span>- {{ group.group_name }}</span>
                        <span>{{ group.slot_count }} 台</span>
                      </div>
                    </template>
                    <el-table :data="group.slots" border size="small" empty-text="暂无设备">
                      <el-table-column label="设备名称" min-width="220">
                        <template #default="{ row }">
                          <span :class="{ 'task-slot-unavailable': !row.available }">{{ text(row.slot_name) }}</span>
                        </template>
                      </el-table-column>
                      <el-table-column label="设备 ID" min-width="240">
                        <template #default="{ row }">
                          <code v-if="row.provider_slot_id" class="task-slot-provider-id">{{ row.provider_slot_id }}</code>
                          <span v-else class="task-slot-unavailable">无法获取</span>
                        </template>
                      </el-table-column>
                    </el-table>
                  </el-collapse-item>
                </el-collapse>
              </div>
              <el-empty
                v-if="!paramRows.length && !parameterSlotGroups.length"
                description="暂无脚本参数"
                :image-size="56"
              />
              <el-table v-if="paramRows.length" :data="paramRows" border stripe class="task-param-table">
                <el-table-column prop="label" label="参数" :width="compact ? 90 : 180" />
                <el-table-column label="值" min-width="200"><template #default="{ row }"><TaskParameterValue :key="`${currentTaskId}-${row.key}`" :value="parseParameterDisplay(row.value)" /></template></el-table-column>
              </el-table>
            </div>
          </el-tab-pane>

          <el-tab-pane label="设备执行记录" name="children">
            <el-table v-loading="childLoading" :data="executionRows" border stripe empty-text="暂无设备执行记录">
              <el-table-column label="任务 ID" min-width="130">
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
              <el-table-column v-if="showChildAccountColumn" label="账号" min-width="250">
                <template #default="{ row }">
                  <div class="task-account-cell" :title="accountSecondaryLabel(row)">
                    <strong>{{ accountPrimaryLabel(row) }}</strong>
                    <span>{{ accountSecondaryLabel(row) }}</span>
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
              <el-table-column v-if="!isSingleExecution" label="操作" :width="90" fixed="right" align="center" header-align="center">
                <template #default="{ row }">
                  <el-button text type="primary" @click="openChildDetail(row)">查看</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div v-if="!isSingleExecution" class="task-child-pagination">
              <el-pagination
                v-model:current-page="childPage"
                v-model:page-size="childPageSize"
                :page-sizes="[20, 50, 100]"
                :total="childTotal"
                layout="total, sizes, prev, pager, next"
                background
                @current-change="changeChildPage"
                @size-change="changeChildPageSize"
              />
            </div>
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

        </el-tabs>
      </template>
    </div>
  </el-dialog>
  <el-dialog v-model="snapshotVisible" title="完整参数快照" width="min(900px, 94vw)" append-to-body>
    <pre class="parameter-snapshot">{{ snapshotText }}</pre>
    <template #footer><el-button @click="snapshotVisible = false">关闭</el-button><el-button :icon="Copy" @click="copySnapshot">复制快照</el-button></template>
  </el-dialog>
</template>

<style scoped>
.parameter-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.parameter-snapshot { max-height: 65dvh; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 13px; line-height: 1.6; }
.task-basic-info :deep(.el-descriptions__table) { table-layout: fixed; width: 100%; }
.task-basic-info :deep(.el-descriptions__label) { white-space: nowrap; }
.task-basic-info :deep(.el-descriptions__content) { overflow-wrap: anywhere; word-break: break-word; }
.task-error-detail { max-height: 240px; overflow-y: auto; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.6; }
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
  color: var(--app-text, #1f2937);
  font-size: 13px;
  font-weight: 700;
}

.task-slot-snapshot {
  overflow: hidden;
  border: 1px solid var(--app-border, #dbe4ee);
  border-radius: 4px;
}

.task-slot-snapshot__header,
.task-slot-group__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.task-slot-snapshot__header {
  padding: 10px 14px;
  color: var(--app-text, #334155);
  background: var(--app-surface-muted, #f8fafc);
  font-size: 13px;
  font-weight: 600;
}

.task-slot-snapshot__header span:last-child,
.task-slot-group__title span:last-child {
  color: var(--app-text-muted, #64748b);
  font-weight: 400;
}

.task-slot-groups {
  border-top: 1px solid var(--app-border, #e2e8f0);
  border-bottom: 0;
}

.task-slot-groups :deep(.el-collapse-item__header) {
  height: 44px;
  padding: 0 14px;
  border-bottom-color: var(--app-border, #e2e8f0);
}

.task-slot-groups :deep(.el-collapse-item__wrap) {
  border-bottom-color: var(--app-border, #e2e8f0);
}

.task-slot-groups :deep(.el-collapse-item__content) {
  padding: 0 14px 14px;
}

.task-slot-group__title {
  width: 100%;
  padding-right: 10px;
  color: var(--app-text, #1e293b);
}

.task-slot-provider-id {
  color: var(--app-text, #334155);
  font-size: 12px;
}

.task-slot-unavailable {
  color: var(--app-text-muted, #94a3b8);
}

.task-param-table {
  margin-top: 12px;
}

.task-child-pagination {
  display: flex;
  justify-content: flex-end;
  padding-top: 14px;
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
  color: var(--app-text-muted, #64748b);
  font-size: 11px;
}

.task-account-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
  line-height: 1.35;
}

.task-account-cell strong,
.task-account-cell span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-account-cell strong {
  color: var(--app-text, #1f2937);
  font-size: 13px;
  font-weight: 600;
}

.task-account-cell span {
  color: var(--app-text-muted, #64748b);
  font-size: 11px;
}
</style>
