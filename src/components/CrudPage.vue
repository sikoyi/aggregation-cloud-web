<script setup lang="ts">
import {
  Archive,
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
  X,
} from 'lucide-vue-next'
import { computed, onMounted, reactive, ref, watch } from 'vue'

import { http } from '@/api/http'
import DynamicForm from '@/components/DynamicForm.vue'
import JsonPreview from '@/components/JsonPreview.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import type { AnyRecord, PageResult } from '@/types/api'
import type { FieldConfig, IconMap, ResourceConfig, RowActionConfig } from '@/types/crud'
import { buildFormState, buildPayload } from '@/utils/form'
import { formatCell, truncateId } from '@/utils/format'

const props = defineProps<{
  config: ResourceConfig
}>()

const iconMap: IconMap = {
  archive: Archive,
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

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
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

function actionIcon(action: RowActionConfig) {
  return action.icon ? iconMap[action.icon] || MoreHorizontal : MoreHorizontal
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

function openEdit(record: AnyRecord) {
  modal.type = 'edit'
  modal.record = record
  modal.action = null
  formState.value = buildFormState(props.config.updateFields || [], record)
}

function closeModal() {
  modal.type = null
  modal.record = null
  modal.action = null
  formState.value = {}
  submitting.value = false
}

async function submitEntity() {
  submitting.value = true
  error.value = ''
  try {
    if (modal.type === 'create') {
      const payload = buildPayload(props.config.createFields || [], formState.value, 'create')
      const data = await http.post<AnyRecord>(props.config.createEndpoint || props.config.endpoint, payload)
      lastResult.value = data
    }
    if (modal.type === 'edit' && modal.record) {
      const payload = buildPayload(props.config.updateFields || [], formState.value, 'update')
      const data = await http.put<AnyRecord>(`${props.config.endpoint}/${rowId(modal.record)}`, payload)
      lastResult.value = data
    }
    closeModal()
    await loadRows()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '提交失败'
  } finally {
    submitting.value = false
  }
}

async function archiveRow(record: AnyRecord) {
  const message = props.config.archiveConfirm || `确认归档 ${rowId(record)}？`
  if (!window.confirm(message)) return
  await executeRequest(
    {
      key: 'archive',
      label: props.config.archiveLabel || '归档',
      method: 'DELETE',
      path: () => `${props.config.endpoint}/${rowId(record)}`,
      refresh: true,
      variant: 'danger',
      icon: 'archive',
    },
    record,
  )
}

function openAction(action: RowActionConfig, record: AnyRecord) {
  modal.type = 'action'
  modal.record = record
  modal.action = action
  formState.value = buildFormState(action.fields || [])
}

async function runAction(action: RowActionConfig, record: AnyRecord) {
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
  if (message && !window.confirm(message)) return

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

    if (action.refresh !== false) await loadRows()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '操作失败'
  } finally {
    submitting.value = false
  }
}

function initFilters() {
  Object.keys(filters).forEach((key) => delete filters[key])
  ;(props.config.filters || []).forEach((field) => {
    filters[field.key] = field.defaultValue ?? ''
  })
  page.value = 1
  lastResult.value = null
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
  <section class="space-y-4">
    <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 class="text-xl font-semibold text-ink">{{ config.title }}</h1>
      </div>
      <div class="flex items-center gap-2">
        <button class="btn btn-secondary" type="button" title="刷新" :disabled="loading" @click="loadRows">
          <RefreshCw class="h-4 w-4" />
        </button>
        <button
          v-if="!config.readOnly"
          class="btn btn-primary"
          type="button"
          :disabled="loading"
          @click="openCreate"
        >
          <Plus class="h-4 w-4" />
          {{ config.createLabel || '新增' }}
        </button>
      </div>
    </div>

    <div v-if="config.filters?.length" class="panel px-4 py-3">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-4">
        <label v-for="filter in config.filters" :key="filter.key" class="space-y-1.5">
          <span class="label">{{ filter.label }}</span>
          <select
            v-if="filter.type === 'select'"
            v-model="filters[filter.key]"
            class="input"
            @change="page = 1; loadRows()"
          >
            <option value="">全部</option>
            <option v-for="option in filter.options || []" :key="String(option.value)" :value="String(option.value)">
              {{ option.label }}
            </option>
          </select>
          <input
            v-else
            v-model="filters[filter.key]"
            class="input"
            :placeholder="filter.placeholder"
            @keydown.enter="page = 1; loadRows()"
          />
        </label>
      </div>
      <div class="mt-3 flex justify-end gap-2">
        <button class="btn btn-secondary" type="button" @click="resetFilters">清空</button>
        <button class="btn btn-primary" type="button" @click="page = 1; loadRows()">查询</button>
      </div>
    </div>

    <div v-if="error" class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ error }}
    </div>

    <div class="overflow-hidden border-y border-line bg-white">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-line text-left text-sm">
          <thead class="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th v-for="column in config.columns" :key="column.key" class="px-4 py-3 font-semibold">
                {{ column.label }}
              </th>
              <th class="w-28 px-4 py-3 text-right font-semibold">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr v-if="loading">
              <td :colspan="config.columns.length + 1" class="px-4 py-10 text-center text-slate-500">加载中</td>
            </tr>
            <tr v-else-if="!rows.length">
              <td :colspan="config.columns.length + 1" class="px-4 py-10 text-center text-slate-500">暂无数据</td>
            </tr>
            <tr v-for="row in rows" v-else :key="rowId(row)" class="hover:bg-slate-50">
              <td
                v-for="column in config.columns"
                :key="column.key"
                class="max-w-72 px-4 py-3 align-top text-slate-700"
                :class="column.className"
              >
                <StatusBadge v-if="column.type === 'status'" :value="row[column.key]" />
                <span v-else-if="column.type === 'id'" :title="String(row[column.key] || '')" class="font-mono text-xs">
                  {{ truncateId(row[column.key]) }}
                </span>
                <span v-else class="line-clamp-2 break-words">{{ formatCell(row, column) }}</span>
              </td>
              <td class="px-4 py-3 text-right align-top">
                <div class="flex items-center justify-end gap-1">
                  <button class="btn btn-ghost h-8 w-8 px-0" type="button" title="详情" @click="lastResult = row">
                    <Eye class="h-4 w-4" />
                  </button>
                  <button
                    v-if="!config.readOnly && config.updateFields?.length"
                    class="btn btn-ghost h-8 w-8 px-0"
                    type="button"
                    title="编辑"
                    @click="openEdit(row)"
                  >
                    <Edit3 class="h-4 w-4" />
                  </button>
                  <details v-if="config.rowActions?.length || (!config.readOnly && config.archiveLabel !== '')" class="relative">
                    <summary class="btn btn-ghost h-8 w-8 cursor-pointer list-none px-0" title="更多">
                      <MoreHorizontal class="h-4 w-4" />
                    </summary>
                    <div class="absolute right-0 z-20 mt-1 w-44 rounded-md border border-line bg-white p-1 text-left shadow-lg">
                      <button
                        v-for="action in config.rowActions || []"
                        :key="action.key"
                        class="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-slate-50"
                        :class="action.variant === 'danger' ? 'text-red-600' : 'text-slate-700'"
                        type="button"
                        @click="runAction(action, row)"
                      >
                        <component :is="actionIcon(action)" class="h-4 w-4" />
                        <span>{{ action.label }}</span>
                      </button>
                      <button
                        v-if="!config.readOnly && config.archiveLabel !== ''"
                        class="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                        type="button"
                        @click="archiveRow(row)"
                      >
                        <Archive class="h-4 w-4" />
                        <span>{{ config.archiveLabel || '归档' }}</span>
                      </button>
                    </div>
                  </details>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="flex flex-col gap-3 border-t border-line px-4 py-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
        <span>共 {{ total }} 条，第 {{ page }} / {{ totalPages }} 页</span>
        <div class="flex items-center gap-2">
          <button class="btn btn-secondary" type="button" :disabled="page <= 1" @click="page--; loadRows()">上一页</button>
          <button class="btn btn-secondary" type="button" :disabled="page >= totalPages" @click="page++; loadRows()">下一页</button>
        </div>
      </div>
    </div>

    <div v-if="lastResult" class="space-y-2">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold text-slate-700">响应数据</h2>
        <button class="btn btn-ghost h-8 px-2" type="button" title="关闭" @click="lastResult = null">
          <X class="h-4 w-4" />
        </button>
      </div>
      <JsonPreview :value="lastResult" />
    </div>

    <div v-if="modal.type" class="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-4">
      <div class="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-md bg-white shadow-xl">
        <div class="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 class="text-base font-semibold text-ink">{{ modalTitle }}</h2>
          <button class="btn btn-ghost h-8 w-8 px-0" type="button" title="关闭" @click="closeModal">
            <X class="h-4 w-4" />
          </button>
        </div>
        <div class="space-y-4 px-5 py-4">
          <DynamicForm v-model="formState" :fields="modalFields" />
          <div v-if="error" class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {{ error }}
          </div>
        </div>
        <div class="flex justify-end gap-2 border-t border-line px-5 py-4">
          <button class="btn btn-secondary" type="button" @click="closeModal">取消</button>
          <button
            class="btn btn-primary"
            type="button"
            :disabled="submitting"
            @click="modal.type === 'action' ? submitAction() : submitEntity()"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
