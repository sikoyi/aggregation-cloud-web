<script setup lang="ts">
import {
  Copy,
  Edit3,
  Link2,
  ListChecks,
  MoreHorizontal,
  Play,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Unlink,
  Users,
} from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'

import { http } from '@/api/http'
import ActionResultDialog from '@/components/ActionResultDialog.vue'
import DynamicForm from '@/components/DynamicForm.vue'
import RemoteSelect from '@/components/RemoteSelect.vue'
import RelationCell from '@/components/RelationCell.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import TaskDetailDrawer from '@/components/TaskDetailDrawer.vue'
import type { AnyRecord, PageResult } from '@/types/api'
import type { ColumnConfig, FieldConfig, IconMap, ResourceConfig, RowActionConfig } from '@/types/crud'
import { buildFormState, buildPayload } from '@/utils/form'
import { formatCell, truncateId } from '@/utils/format'

const props = defineProps<{
  config: ResourceConfig
}>()

const iconMap: IconMap = {
  copy: Copy,
  edit: Edit3,
  link: Link2,
  list: ListChecks,
  play: Play,
  power: Power,
  powerOff: PowerOff,
  trash: Trash2,
  unlink: Unlink,
  users: Users,
}

const loading = ref(false)
const submitting = ref(false)
const error = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const rows = ref<AnyRecord[]>([])
const selectedRows = ref<AnyRecord[]>([])
const filters = reactive<AnyRecord>({})
const resultDialogVisible = ref(false)
const resultTitle = ref('')
const resultValue = ref<unknown>(null)
const resultColumns = ref<ColumnConfig[]>([])
const taskDetailVisible = ref(false)
const taskDetailId = ref<string | null>(null)
const tableRef = ref()

const modal = reactive<{
  type: 'create' | 'edit' | 'action' | null
  record: AnyRecord | null
  action: RowActionConfig | null
}>({
  type: null,
  record: null,
  action: null,
})

const formState = ref<AnyRecord>({})

const idKey = computed(() => props.config.idKey || 'id')
const modalFields = computed<FieldConfig[]>(() => {
  if (modal.type === 'create') return props.config.createFields || []
  if (modal.type === 'edit') return props.config.updateFields || []
  return modal.action?.fields || []
})
const modalTitle = computed(() => {
  if (modal.type === 'create') return props.config.createLabel || `新增${props.config.title}`
  if (modal.type === 'edit') return `编辑${props.config.title}`
  return modal.action?.label || '执行操作'
})
// 启用/禁用是高频状态动作，统一放到状态列开关里，右侧菜单只保留其它业务操作。
function isInlineStatusAction(action: RowActionConfig) {
  return ['enable', 'disable'].includes(action.key) && !action.fields?.length
}

function findInlineStatusAction(key: 'enable' | 'disable') {
  return [...(props.config.rowActions || []), ...(props.config.batchActions || [])].find(
    (action) => action.key === key && !action.fields?.length,
  )
}

const hasInlineStatusSwitch = computed(() => Boolean(findInlineStatusAction('enable') && findInlineStatusAction('disable')))
const rowActionsForMenu = computed(() => (props.config.rowActions || []).filter((action) => !isInlineStatusAction(action)))
// 高频行操作可以配置为直接按钮，减少用户反复展开下拉菜单的成本。
const inlineActionKeys = computed(() => new Set(props.config.inlineActionKeys || []))
const inlineRowActions = computed(() => rowActionsForMenu.value.filter((action) => inlineActionKeys.value.has(action.key)))
const dropdownRowActions = computed(() => rowActionsForMenu.value.filter((action) => !inlineActionKeys.value.has(action.key)))
const canEditRow = computed(() => !props.config.readOnly && Boolean(props.config.updateFields?.length))
const canDeleteRow = computed(() => !props.config.readOnly && Boolean(props.config.deleteLabel))
const showDirectDelete = computed(() => canDeleteRow.value && (props.config.directDelete || !dropdownRowActions.value.length))
const showOperationColumn = computed(
  () => canEditRow.value || Boolean(inlineRowActions.value.length || dropdownRowActions.value.length || showDirectDelete.value),
)
const operationColumnWidth = computed(() => {
  const actionCount =
    (canEditRow.value ? 1 : 0) +
    inlineRowActions.value.length +
    (showDirectDelete.value ? 1 : 0) +
    (dropdownRowActions.value.length ? 1 : 0)
  return Math.max(104, Math.min(220, 52 + actionCount * 36))
})
const batchActions = computed<RowActionConfig[]>(() => {
  const actions: RowActionConfig[] = []
  const seen = new Set<string>()

  ;(props.config.batchActions || []).forEach((action) => {
    actions.push(action)
    seen.add(action.key)
  })

  ;(props.config.rowActions || [])
    .filter(isInlineStatusAction)
    .forEach((action) => {
      if (seen.has(action.key)) return
      actions.push({
        ...action,
        label: action.label.startsWith('批量') ? action.label : `批量${action.label}`,
        confirm: undefined,
      })
      seen.add(action.key)
    })

  if (!props.config.readOnly && props.config.deleteLabel && !seen.has('__delete')) {
    actions.push({
      key: '__delete',
      label: `批量${props.config.deleteLabel}`,
      method: 'DELETE',
      path: (record) => `${props.config.endpoint}/${rowId(record)}`,
      variant: 'danger',
      icon: 'trash',
    })
  }

  return actions
})
const selectedCount = computed(() => selectedRows.value.length)
const hasSelectedRows = computed(() => selectedCount.value > 0)
const activeFilterCount = computed(
  () => Object.values(filters).filter((value) => hasFilterValue(value)).length,
)
const hasActiveFilters = computed(() => activeFilterCount.value > 0)
const emptyDescription = computed(() => (hasActiveFilters.value ? '没有符合筛选条件的数据' : '暂无数据'))

function rowId(row: AnyRecord) {
  return String(row[idKey.value])
}

function hasFilterValue(value: unknown) {
  if (Array.isArray(value)) return value.length > 0
  if (value && typeof value === 'object') return Object.keys(value).length > 0
  return value !== '' && value !== undefined && value !== null
}

function openTaskDetail(record: AnyRecord) {
  taskDetailId.value = rowId(record)
  taskDetailVisible.value = true
}

function openResultDialog(action: RowActionConfig, data: unknown) {
  resultTitle.value = action.label
  resultValue.value = data
  resultColumns.value = action.resultColumns || []
  resultDialogVisible.value = true
}

function actionIcon(action: RowActionConfig) {
  return action.icon ? iconMap[action.icon] || MoreHorizontal : MoreHorizontal
}

function isEnabledStatus(value: unknown) {
  const status = String(value || '')
  return status !== '' && status !== 'disabled'
}

function isSwitchableStatusColumn(column: ColumnConfig) {
  return column.type === 'statusSwitch' || (column.key === 'status' && hasInlineStatusSwitch.value)
}

function shouldShowStatusBadgeWithSwitch(value: unknown) {
  return !['', 'enabled', 'disabled'].includes(String(value || ''))
}

async function toggleEnabledStatus(row: AnyRecord, nextValue: boolean) {
  const key = nextValue ? 'enable' : 'disable'
  const configuredAction = findInlineStatusAction(key)
  const action: RowActionConfig = configuredAction
    ? { ...configuredAction, confirm: undefined, refresh: true }
    : {
        key,
        label: nextValue ? '启用' : '禁用',
        method: 'POST',
        path: () => `${props.config.endpoint}/${rowId(row)}/${key}`,
        refresh: true,
      }
  await executeRequest(action, row)
}

function buildListParams() {
  const params: AnyRecord = {
    page: page.value,
    page_size: pageSize.value,
  }
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== undefined && value !== null) params[key] = value
  })
  return params
}

async function loadRows() {
  loading.value = true
  error.value = ''
  try {
    const data = await http.get<PageResult<AnyRecord>>(props.config.endpoint, buildListParams())
    rows.value = data.items
    total.value = data.total
    selectedRows.value = []
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size
  page.value = 1
  loadRows()
}

function resetFilters() {
  Object.keys(filters).forEach((key) => {
    filters[key] = ''
  })
  page.value = 1
  loadRows()
}

function openCreate() {
  modal.type = 'create'
  modal.record = null
  modal.action = null
  formState.value = buildFormState(props.config.createFields || [])
}

async function openEdit(record: AnyRecord) {
  loading.value = true
  error.value = ''
  try {
    // 部分资源的编辑表单需要额外子资源，例如脚本参数，需要先加载详情再打开弹窗。
    const editRecord = props.config.loadEditRecord ? await props.config.loadEditRecord(record) : record
    modal.type = 'edit'
    modal.record = editRecord
    modal.action = null
    formState.value = buildFormState(props.config.updateFields || [], editRecord)
  } catch (err) {
    const message = err instanceof Error ? err.message : '加载编辑数据失败'
    error.value = message
    ElMessage.error(message)
  } finally {
    loading.value = false
  }
}

function closeModal() {
  modal.type = null
  modal.record = null
  modal.action = null
  formState.value = {}
  submitting.value = false
}

async function confirmAction(message?: string, type: 'warning' | 'error' = 'warning') {
  if (!message) return true
  try {
    await ElMessageBox.confirm(message, '确认操作', {
      type,
      confirmButtonText: '确认',
      cancelButtonText: '取消',
    })
    return true
  } catch {
    return false
  }
}

async function submitEntity() {
  submitting.value = true
  error.value = ''
  try {
    if (modal.type === 'create') {
      const payload = buildPayload(props.config.createFields || [], formState.value, 'create')
      // 有些资源创建时需要把表单拆成主表与子资源两次请求，例如脚本和脚本参数。
      const body = props.config.createBody ? props.config.createBody(payload) : payload
      const data = await http.post<AnyRecord>(props.config.createEndpoint || props.config.endpoint, body)
      if (props.config.afterCreate) await props.config.afterCreate(data, payload)
    }
    if (modal.type === 'edit' && modal.record) {
      const payload = buildPayload(props.config.updateFields || [], formState.value, 'update')
      const body = props.config.updateBody ? props.config.updateBody(payload, modal.record) : payload
      const data = await http.put<AnyRecord>(`${props.config.endpoint}/${rowId(modal.record)}`, body)
      if (props.config.afterUpdate) await props.config.afterUpdate(data, payload, modal.record)
    }
    closeModal()
    ElMessage.success('保存成功')
    await loadRows()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '提交失败'
  } finally {
    submitting.value = false
  }
}

async function deleteRow(record: AnyRecord) {
  const message = props.config.deleteConfirm || `确认删除 ${rowId(record)}？`
  if (!(await confirmAction(message, 'error'))) return
  await executeRequest(
    {
      key: 'delete',
      label: props.config.deleteLabel || '删除',
      method: 'DELETE',
      path: () => `${props.config.endpoint}/${rowId(record)}`,
      refresh: true,
      variant: 'danger',
      icon: 'trash',
    },
    record,
  )
}

function handleSelectionChange(selection: AnyRecord[]) {
  selectedRows.value = selection
}

function clearSelection() {
  tableRef.value?.clearSelection?.()
  selectedRows.value = []
}

async function requestAction(action: RowActionConfig, record: AnyRecord, payload: AnyRecord = {}) {
  const path = action.path(record, payload)
  const params = typeof action.params === 'function' ? action.params(payload, record) : action.params
  const body =
    typeof action.body === 'function'
      ? action.body(payload, record)
      : action.body !== undefined
        ? action.body
        : action.fields?.length
          ? payload
          : undefined

  if (action.method === 'GET') return http.get(path, params)
  if (action.method === 'POST') return http.post(path, body, params)
  if (action.method === 'PUT') return http.put(path, body)
  return http.delete(path)
}

async function runBatchAction(action: RowActionConfig) {
  if (!selectedRows.value.length) return
  const actionName = action.label.replace(/^批量/, '')
  const isDanger = action.variant === 'danger' || action.method === 'DELETE'
  const message =
    action.key === '__delete'
      ? `确认删除已选 ${selectedRows.value.length} 条数据？此操作不可恢复。`
      : `确认对已选 ${selectedRows.value.length} 条数据执行${actionName}？`
  if (!(await confirmAction(message, isDanger ? 'error' : 'warning'))) return

  submitting.value = true
  error.value = ''
  const failures: string[] = []
  try {
    for (const row of selectedRows.value) {
      try {
        await requestAction(action, row)
      } catch (err) {
        const message = err instanceof Error ? err.message : '操作失败'
        failures.push(`${rowId(row)}：${message}`)
      }
    }
    if (failures.length) {
      throw new Error(`部分数据处理失败：${failures.slice(0, 3).join('；')}`)
    }
    ElMessage.success(`已处理 ${selectedRows.value.length} 条`)
    clearSelection()
    await loadRows()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '批量操作失败'
    ElMessage.error(error.value)
  } finally {
    submitting.value = false
  }
}

function openAction(action: RowActionConfig, record: AnyRecord) {
  modal.type = 'action'
  modal.record = record
  modal.action = action
  // 行级操作常需要复用当前行的默认值，例如基于模板创建任务时带出模板参数。
  formState.value = buildFormState(action.fields || [], record)
}

async function runAction(action: RowActionConfig, record: AnyRecord) {
  if (props.config.key === 'tasks' && action.key === 'detail') {
    openTaskDetail(record)
    return
  }
  if (action.fields?.length) {
    openAction(action, record)
    return
  }
  await executeRequest(action, record)
}

async function submitAction() {
  if (!modal.action || !modal.record) return
  await executeRequest(modal.action, modal.record, buildPayload(modal.action.fields || [], formState.value, 'action'))
  closeModal()
}

async function executeRequest(action: RowActionConfig, record: AnyRecord, payload: AnyRecord = {}) {
  const message = typeof action.confirm === 'function' ? action.confirm(record) : action.confirm
  const isDanger = action.variant === 'danger' || action.method === 'DELETE'
  if (!(await confirmAction(message, isDanger ? 'error' : 'warning'))) return

  submitting.value = true
  error.value = ''
  try {
    const data = await requestAction(action, record, payload)
    if (action.method === 'GET') openResultDialog(action, data)

    if (action.method !== 'GET') ElMessage.success('操作完成')
    if (action.refresh !== false) await loadRows()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '操作失败'
  } finally {
    submitting.value = false
  }
}

function handleDropdown(command: string, row: AnyRecord) {
  if (command === '__delete') {
    deleteRow(row)
    return
  }
  const action = dropdownRowActions.value.find((item) => item.key === command)
  if (action) runAction(action, row)
}

function initFilters() {
  Object.keys(filters).forEach((key) => delete filters[key])
  ;(props.config.filters || []).forEach((field) => {
    filters[field.key] = field.defaultValue ?? ''
  })
  page.value = 1
  resultDialogVisible.value = false
  resultTitle.value = ''
  resultValue.value = null
  resultColumns.value = []
  taskDetailVisible.value = false
  taskDetailId.value = null
}

watch(
  () => props.config.key,
  () => {
    initFilters()
    loadRows()
  },
)

onMounted(() => {
  initFilters()
  loadRows()
})
</script>

<template>
  <section class="resource-page space-y-4">
    <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 class="text-xl font-semibold text-ink">{{ config.title }}</h1>
      </div>
      <el-space wrap>
        <el-tooltip content="刷新" placement="bottom">
          <el-button :icon="RefreshCw" circle :loading="loading" @click="loadRows" />
        </el-tooltip>
        <el-button
          v-if="!config.readOnly"
          type="primary"
          :icon="Plus"
          :disabled="loading"
          @click="openCreate"
        >
          {{ config.createLabel || '新增' }}
        </el-button>
      </el-space>
    </div>

    <el-card v-if="config.filters?.length" shadow="never" class="filter-card">
      <div class="filter-card__header">
        <div class="filter-card__title">
          <Search class="h-4 w-4 text-brand-600" />
          <span>筛选条件</span>
          <el-tag v-if="hasActiveFilters" size="small" type="info" effect="plain">
            {{ activeFilterCount }} 项已生效
          </el-tag>
        </div>
      </div>
      <el-form inline label-position="left" class="compact-filter-form">
        <div class="filter-grid">
          <el-form-item v-for="filter in config.filters" :key="filter.key" :label="filter.label">
              <RemoteSelect
                v-if="filter.type === 'remoteSelect' && filter.remote"
                :model-value="filters[filter.key]"
                :config="filter.remote"
                :placeholder="filter.placeholder || '全部'"
                @update:model-value="filters[filter.key] = $event; page = 1; loadRows()"
              />
              <el-select
                v-else-if="filter.type === 'select'"
                :model-value="String(filters[filter.key] ?? '')"
                clearable
                filterable
                class="w-full"
                placeholder="全部"
                @update:model-value="filters[filter.key] = $event"
                @change="page = 1; loadRows()"
              >
                <el-option
                  v-for="option in filter.options || []"
                  :key="String(option.value)"
                  :label="option.label"
                  :value="String(option.value)"
                />
              </el-select>
              <el-input
                v-else
                :model-value="String(filters[filter.key] ?? '')"
                clearable
                :placeholder="filter.placeholder"
                @update:model-value="filters[filter.key] = $event"
                @keydown.enter="page = 1; loadRows()"
              />
          </el-form-item>
        </div>
        <div class="filter-actions">
          <el-button :icon="RotateCcw" :disabled="!hasActiveFilters || loading" @click="resetFilters">清空</el-button>
          <el-button type="primary" :icon="Search" :loading="loading" @click="page = 1; loadRows()">查询</el-button>
        </div>
      </el-form>
    </el-card>

    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />

    <div v-if="batchActions.length && hasSelectedRows" class="batch-toolbar">
      <div class="batch-toolbar__summary">
        <ListChecks class="h-4 w-4 text-slate-500" />
        <span>已选</span>
        <strong>{{ selectedCount }}</strong>
        <span>条</span>
      </div>
      <div class="batch-toolbar__actions">
        <el-button
          v-for="action in batchActions"
          :key="action.key"
          size="small"
          :type="action.variant === 'danger' ? 'danger' : action.variant === 'success' ? 'success' : undefined"
          plain
          :icon="actionIcon(action)"
          :disabled="!selectedRows.length || submitting"
          :loading="submitting"
          @click="runBatchAction(action)"
        >
          {{ action.label }}
        </el-button>
        <el-button size="small" text :disabled="!selectedRows.length || submitting" @click="clearSelection">
          取消选择
        </el-button>
      </div>
    </div>

    <el-card shadow="never" class="table-card">
      <el-table
        ref="tableRef"
        v-loading="loading"
        :data="rows"
        :row-key="rowId"
        stripe
        border
        highlight-current-row
        scrollbar-always-on
        class="resource-table"
        table-layout="auto"
        @selection-change="handleSelectionChange"
      >
        <el-table-column v-if="batchActions.length" type="selection" width="48" />

        <el-table-column
          v-for="column in config.columns"
          :key="column.key"
          :prop="column.key"
          :label="column.label"
          :min-width="column.minWidth || 150"
          :width="column.width"
          :align="column.align || 'left'"
          :header-align="column.align || 'left'"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <div v-if="isSwitchableStatusColumn(column)" class="flex items-center gap-2">
              <el-switch
                :model-value="isEnabledStatus(row[column.key])"
                active-text="启用"
                inactive-text="禁用"
                inline-prompt
                :loading="submitting"
                @change="(value) => toggleEnabledStatus(row, Boolean(value))"
              />
              <StatusBadge v-if="shouldShowStatusBadgeWithSwitch(row[column.key])" :value="row[column.key]" />
            </div>
            <StatusBadge v-else-if="column.type === 'status'" :value="row[column.key]" />
            <RelationCell
              v-else-if="column.type === 'relation' && column.relation"
              :value="row[column.key]"
              :config="column.relation"
              :row="row"
            />
            <span v-else-if="column.type === 'id'" :title="String(row[column.key] || '')" class="font-mono text-xs">
              {{ truncateId(row[column.key]) }}
            </span>
            <el-tag v-else-if="column.type === 'tag'" effect="plain" round>
              {{ formatCell(row, column) }}
            </el-tag>
            <span v-else>{{ formatCell(row, column) }}</span>
          </template>
        </el-table-column>

        <el-table-column
          v-if="showOperationColumn"
          label="操作"
          :width="operationColumnWidth"
          fixed="right"
          align="center"
          header-align="center"
        >
          <template #default="{ row }">
            <el-space :size="2">
              <el-tooltip v-if="canEditRow" content="编辑" placement="top">
                <el-button text circle :icon="Edit3" :disabled="submitting" @click="openEdit(row)" />
              </el-tooltip>
              <el-tooltip v-for="action in inlineRowActions" :key="action.key" :content="action.label" placement="top">
                <el-button
                  text
                  circle
                  :type="action.variant === 'danger' ? 'danger' : action.variant === 'success' ? 'success' : undefined"
                  :icon="actionIcon(action)"
                  :disabled="submitting"
                  @click="runAction(action, row)"
                />
              </el-tooltip>
              <el-tooltip
                v-if="showDirectDelete"
                :content="config.deleteLabel"
                placement="top"
              >
                <el-button text circle type="danger" :icon="Trash2" :disabled="submitting" @click="deleteRow(row)" />
              </el-tooltip>
              <el-dropdown
                v-if="dropdownRowActions.length"
                trigger="click"
                :disabled="submitting"
                @command="(command) => handleDropdown(String(command), row)"
              >
                <el-button text circle :icon="MoreHorizontal" />
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item
                      v-for="action in dropdownRowActions"
                      :key="action.key"
                      :command="action.key"
                      :class="action.variant === 'danger' ? 'text-red-600' : ''"
                    >
                      <component :is="actionIcon(action)" class="mr-2 h-4 w-4" />
                      {{ action.label }}
                    </el-dropdown-item>
                    <el-dropdown-item
                      v-if="!showDirectDelete && !config.readOnly && config.deleteLabel"
                      command="__delete"
                      class="text-red-600"
                    >
                      <Trash2 class="mr-2 h-4 w-4" />
                      {{ config.deleteLabel }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </el-space>
          </template>
        </el-table-column>

        <template #empty>
          <el-empty :description="emptyDescription" :image-size="72">
            <el-button v-if="hasActiveFilters" size="small" :icon="RotateCcw" @click="resetFilters">
              清空筛选
            </el-button>
          </el-empty>
        </template>
      </el-table>

      <div class="table-pagination">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          background
          layout="total, sizes, prev, pager, next"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          @current-change="loadRows"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <el-dialog
      :model-value="Boolean(modal.type)"
      :title="modalTitle"
      width="760px"
      destroy-on-close
      append-to-body
      @close="closeModal"
    >
      <DynamicForm v-model="formState" :fields="modalFields" />
      <el-alert v-if="error" class="mt-3" :title="error" type="error" show-icon :closable="false" />
      <template #footer>
        <el-button @click="closeModal">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="modal.type === 'action' ? submitAction() : submitEntity()">
          保存
        </el-button>
      </template>
    </el-dialog>

    <ActionResultDialog
      v-model="resultDialogVisible"
      :title="resultTitle"
      :value="resultValue"
      :columns="resultColumns"
    />

    <TaskDetailDrawer v-if="config.key === 'tasks'" v-model="taskDetailVisible" :task-id="taskDetailId" />
  </section>
</template>

<style scoped>
.filter-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.filter-card__title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #1f2933;
  font-size: 13px;
  font-weight: 700;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px 14px;
}

.filter-grid :deep(.el-form-item) {
  margin-right: 0;
  margin-bottom: 0;
}

.filter-grid :deep(.el-form-item__label) {
  min-width: 72px;
  color: #52606d;
  font-size: 12px;
  font-weight: 600;
}

.filter-grid :deep(.el-select),
.filter-grid :deep(.el-input) {
  width: 100%;
}

.filter-actions {
  display: flex;
  justify-content: flex-start;
  gap: 8px;
  margin-top: 12px;
}

.batch-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 48px;
  padding: 10px 14px;
  border: 1px solid #dbe4f0;
  border-radius: 8px;
  background: #f8fafc;
}

.batch-toolbar__summary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 92px;
  color: #475569;
  font-size: 13px;
}

.batch-toolbar__summary strong {
  color: #1e3a5f;
  font-weight: 700;
}

.batch-toolbar__actions {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.batch-toolbar :deep(.el-button) {
  margin-left: 0;
}

.resource-table :deep(.el-table__cell) {
  padding: 9px 0;
}

.resource-table :deep(th.el-table__cell) {
  padding: 8px 0;
}

.resource-table :deep(.el-table__empty-block) {
  min-height: 220px;
}

.resource-table :deep(.el-button.is-circle) {
  width: 30px;
  height: 30px;
}

.table-pagination {
  display: flex;
  justify-content: flex-end;
  padding: 14px 16px;
  border-top: 1px solid #e6edf3;
}

@media (max-width: 768px) {
  .filter-grid {
    grid-template-columns: 1fr;
  }

  .batch-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .batch-toolbar__actions {
    width: 100%;
  }

  .table-pagination {
    justify-content: flex-start;
    overflow-x: auto;
  }
}
</style>
