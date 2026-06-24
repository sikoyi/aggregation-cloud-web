<script setup lang="ts">
import {
  Copy,
  Edit3,
  Eye,
  Link2,
  ListChecks,
  MoreHorizontal,
  Play,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Trash2,
  Unlink,
  Users,
} from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'

import { http } from '@/api/http'
import DynamicForm from '@/components/DynamicForm.vue'
import JsonPreview from '@/components/JsonPreview.vue'
import RemoteSelect from '@/components/RemoteSelect.vue'
import RelationCell from '@/components/RelationCell.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import TaskDetailDrawer from '@/components/TaskDetailDrawer.vue'
import type { AnyRecord, PageResult } from '@/types/api'
import type { FieldConfig, IconMap, ResourceConfig, RowActionConfig } from '@/types/crud'
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
const filters = reactive<AnyRecord>({})
const lastResult = ref<unknown>(null)
const taskDetailVisible = ref(false)
const taskDetailId = ref<string | null>(null)

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

function rowId(row: AnyRecord) {
  return String(row[idKey.value])
}

function openTaskDetail(record: AnyRecord) {
  taskDetailId.value = rowId(record)
  taskDetailVisible.value = true
}

function openRowDetail(record: AnyRecord) {
  if (props.config.key === 'tasks') {
    openTaskDetail(record)
    return
  }
  lastResult.value = record
}

function actionIcon(action: RowActionConfig) {
  return action.icon ? iconMap[action.icon] || MoreHorizontal : MoreHorizontal
}

function isEnabledStatus(value: unknown) {
  return String(value || '') === 'enabled'
}

async function toggleEnabledStatus(row: AnyRecord, nextValue: boolean) {
  const action: RowActionConfig = {
    key: nextValue ? 'enable' : 'disable',
    label: nextValue ? '启用' : '禁用',
    method: 'POST',
    path: () => `${props.config.endpoint}/${rowId(row)}/${nextValue ? 'enable' : 'disable'}`,
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

async function confirmAction(message?: string) {
  if (!message) return true
  try {
    await ElMessageBox.confirm(message, '确认操作', {
      type: 'warning',
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
      const followup = props.config.afterCreate ? await props.config.afterCreate(data, payload) : undefined
      lastResult.value = followup === undefined ? data : { entity: data, followup }
    }
    if (modal.type === 'edit' && modal.record) {
      const payload = buildPayload(props.config.updateFields || [], formState.value, 'update')
      const body = props.config.updateBody ? props.config.updateBody(payload, modal.record) : payload
      const data = await http.put<AnyRecord>(`${props.config.endpoint}/${rowId(modal.record)}`, body)
      const followup = props.config.afterUpdate ? await props.config.afterUpdate(data, payload, modal.record) : undefined
      lastResult.value = followup === undefined ? data : { entity: data, followup }
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
  if (!(await confirmAction(message))) return
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
  if (!(await confirmAction(message))) return

  submitting.value = true
  error.value = ''
  try {
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

    if (action.method === 'GET') lastResult.value = await http.get(path, params)
    if (action.method === 'POST') lastResult.value = await http.post(path, body, params)
    if (action.method === 'PUT') lastResult.value = await http.put(path, body)
    if (action.method === 'DELETE') lastResult.value = await http.delete(path)

    ElMessage.success(action.method === 'GET' ? '查询完成' : '操作完成')
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
  const action = props.config.rowActions?.find((item) => item.key === command)
  if (action) runAction(action, row)
}

function initFilters() {
  Object.keys(filters).forEach((key) => delete filters[key])
  ;(props.config.filters || []).forEach((field) => {
    filters[field.key] = field.defaultValue ?? ''
  })
  page.value = 1
  lastResult.value = null
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
      <el-form inline label-position="left" class="compact-filter-form">
        <div class="flex flex-wrap items-end gap-x-4 gap-y-2">
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
        <div class="mt-2 flex justify-end gap-2">
          <el-button @click="resetFilters">清空</el-button>
          <el-button type="primary" @click="page = 1; loadRows()">查询</el-button>
        </div>
      </el-form>
    </el-card>

    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />

    <el-card shadow="never" class="table-card">
      <el-table
        v-loading="loading"
        :data="rows"
        stripe
        border
        table-layout="auto"
        empty-text="暂无数据"
      >
        <el-table-column
          v-for="column in config.columns"
          :key="column.key"
          :prop="column.key"
          :label="column.label"
          :min-width="column.minWidth || 150"
          :width="column.width"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <StatusBadge v-if="column.type === 'status'" :value="row[column.key]" />
            <el-switch
              v-else-if="column.type === 'statusSwitch'"
              :model-value="isEnabledStatus(row[column.key])"
              active-text="启用"
              inactive-text="禁用"
              inline-prompt
              :loading="submitting"
              @change="(value) => toggleEnabledStatus(row, Boolean(value))"
            />
            <RelationCell
              v-else-if="column.type === 'relation' && column.relation"
              :value="row[column.key]"
              :config="column.relation"
              :row="row"
            />
            <span v-else-if="column.type === 'id'" :title="String(row[column.key] || '')" class="font-mono text-xs">
              {{ truncateId(row[column.key]) }}
            </span>
            <span v-else>{{ formatCell(row, column) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="150" fixed="right" align="right">
          <template #default="{ row }">
            <el-space :size="2">
              <el-tooltip v-if="!config.hideDetailAction" content="详情" placement="top">
                <el-button text circle :icon="Eye" @click="openRowDetail(row)" />
              </el-tooltip>
              <el-tooltip v-if="!config.readOnly && config.updateFields?.length" content="编辑" placement="top">
                <el-button text circle :icon="Edit3" @click="openEdit(row)" />
              </el-tooltip>
              <el-tooltip
                v-if="!config.rowActions?.length && !config.readOnly && config.deleteLabel"
                :content="config.deleteLabel"
                placement="top"
              >
                <el-button text circle type="danger" :icon="Trash2" @click="deleteRow(row)" />
              </el-tooltip>
              <el-dropdown
                v-if="config.rowActions?.length"
                trigger="click"
                @command="(command) => handleDropdown(String(command), row)"
              >
                <el-button text circle :icon="MoreHorizontal" />
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item
                      v-for="action in config.rowActions || []"
                      :key="action.key"
                      :command="action.key"
                      :class="action.variant === 'danger' ? 'text-red-600' : ''"
                    >
                      <component :is="actionIcon(action)" class="mr-2 h-4 w-4" />
                      {{ action.label }}
                    </el-dropdown-item>
                    <el-dropdown-item
                      v-if="!config.readOnly && config.deleteLabel"
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
      </el-table>

      <div class="mt-4 flex justify-end">
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

    <el-card v-if="lastResult" shadow="never" class="result-card">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-sm font-semibold text-slate-700">响应数据</span>
          <el-button text @click="lastResult = null">关闭</el-button>
        </div>
      </template>
      <JsonPreview :value="lastResult" />
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

    <TaskDetailDrawer v-if="config.key === 'tasks'" v-model="taskDetailVisible" :task-id="taskDetailId" />
  </section>
</template>
