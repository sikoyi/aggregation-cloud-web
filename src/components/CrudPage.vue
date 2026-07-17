<script setup lang="ts">
import {
  Copy,
  Download,
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
  Upload,
  Users,
} from 'lucide-vue-next'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import { http, resolveBackendUrl } from '@/api/http'
import { getEnabledAiProviderOptions, resolveEnabledAiProvider } from '@/api/interactionAi'
import { FALLBACK_SYSTEM_DEFAULTS, getSystemDefaults, type SystemDefaults } from '@/api/systemSettings'
import AccountTableCell from '@/components/AccountTableCell.vue'
import DynamicForm from '@/components/DynamicForm.vue'
import RemoteSelect from '@/components/RemoteSelect.vue'
import RelationCell from '@/components/RelationCell.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { REALTIME_EVENT_NAME, type RealtimeEventPayload } from '@/composables/useRealtimeEvents'
import type { AnyRecord, PageResult } from '@/types/api'
import type { ColumnConfig, FieldConfig, IconMap, ResourceConfig, RowActionConfig } from '@/types/crud'
import { buildFormState, buildPayload } from '@/utils/form'
import { formatCell, getCellValue, truncateId } from '@/utils/format'
import { getErrorMessage, notifyError } from '@/utils/notify'

const AccountGroupMemberEditor = defineAsyncComponent(() => import('@/components/AccountGroupMemberEditor.vue'))
const ActionResultDialog = defineAsyncComponent(() => import('@/components/ActionResultDialog.vue'))
const BusinessDispatchForm = defineAsyncComponent(() => import('@/components/BusinessDispatchForm.vue'))
const ContentGroupMemberEditor = defineAsyncComponent(() => import('@/components/ContentGroupMemberEditor.vue'))
const InteractionSessionDetailDialog = defineAsyncComponent(() => import('@/components/InteractionSessionDetailDialog.vue'))
const ProxyGroupMemberEditor = defineAsyncComponent(() => import('@/components/ProxyGroupMemberEditor.vue'))
const PublishedContentDetailDialog = defineAsyncComponent(() => import('@/components/PublishedContentDetailDialog.vue'))
const SlotGroupMemberEditor = defineAsyncComponent(() => import('@/components/SlotGroupMemberEditor.vue'))
const TaskDetailDrawer = defineAsyncComponent(() => import('@/components/TaskDetailDrawer.vue'))

const props = defineProps<{
  config: ResourceConfig
  embedded?: boolean
  hideHeaderActions?: boolean
}>()

const iconMap: IconMap = {
  copy: Copy,
  download: Download,
  edit: Edit3,
  link: Link2,
  list: ListChecks,
  play: Play,
  power: Power,
  powerOff: PowerOff,
  rotate: RotateCcw,
  trash: Trash2,
  unlink: Unlink,
  upload: Upload,
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
const resultLoading = ref(false)
const taskDetailVisible = ref(false)
const taskDetailId = ref<string | null>(null)
const interactionSessionDetailVisible = ref(false)
const interactionSessionDetailId = ref<string | null>(null)
const publishedContentDetailVisible = ref(false)
const publishedContentDetailId = ref<string | null>(null)
const assetViewerVisible = ref(false)
const assetViewerTitle = ref('')
const assetViewerUrl = ref('')
const assetViewerKind = ref<'image' | 'video'>('image')
const assetViewerFilename = ref('')
const assetViewerRecord = ref<AnyRecord | null>(null)
const tableRef = ref()
const slotGroupEditTab = ref('base')
let realtimeRefreshTimer: number | undefined

const modal = reactive<{
  type: 'create' | 'edit' | 'action' | 'batch' | null
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
  if (modal.type === 'batch') return modal.action?.label || '批量操作'
  return modal.action?.label || '执行操作'
})
const isTaskDispatchModal = computed(() => props.config.key === 'tasks' && modal.type === 'create')
const isPublishedContentDispatchModal = computed(() => props.config.key === 'publishedContents' && modal.type === 'create')
const isInteractionSessionCreateModal = computed(() => props.config.key === 'interactionSessions' && modal.type === 'create')
const modalWidth = computed(() => {
  if (isInteractionSessionCreateModal.value) return '1240px'
  if (isTaskDispatchModal.value || isPublishedContentDispatchModal.value) return '1120px'
  if (
    modal.type === 'edit'
    && (
      props.config.accountGroupMembers
      || props.config.slotGroupMembers
      || props.config.proxyGroupMembers
      || props.config.contentGroupMembers
    )
  ) return '1180px'
  return '760px'
})
const dispatchFormMode = computed<'task' | 'published' | 'interaction' | null>(() => {
  if (isTaskDispatchModal.value) return 'task'
  if (isPublishedContentDispatchModal.value) return 'published'
  if (isInteractionSessionCreateModal.value) return 'interaction'
  return null
})
const showModalSaveButton = computed(() => {
  if (modal.type !== 'edit') return true
  if ((props.config.slotGroupMembers || props.config.proxyGroupMembers || props.config.contentGroupMembers) && slotGroupEditTab.value === 'members') return false
  return true
})
const groupMembersTabLabel = computed(() => {
  if (props.config.proxyGroupMembers) return '组内代理'
  if (props.config.contentGroupMembers) return '组内内容'
  return '组内设备'
})
const modalSubmitLabel = computed(() => (
  isTaskDispatchModal.value
    ? '确认执行'
    : isPublishedContentDispatchModal.value || isInteractionSessionCreateModal.value
      ? '确认下发'
      : '保存'
))
// 启用/禁用是高频状态动作，统一放到状态列开关里，右侧菜单只保留其它业务操作。
const statusSwitchActionKeys = computed(() => {
  const keys = new Set(['enable', 'disable'])
  props.config.columns
    .map((column) => column.statusSwitch)
    .filter(Boolean)
    .forEach((config) => {
      keys.add(config!.activeActionKey)
      keys.add(config!.inactiveActionKey)
    })
  return keys
})

function isInlineStatusAction(action: RowActionConfig) {
  return statusSwitchActionKeys.value.has(action.key) && !action.fields?.length
}

function defaultStatusSwitchConfig(column?: ColumnConfig) {
  return column?.statusSwitch || {
    activeValue: 'enabled',
    inactiveValue: 'disabled',
    activeText: '启用',
    inactiveText: '禁用',
    activeActionKey: 'enable',
    inactiveActionKey: 'disable',
  }
}

function findInlineStatusAction(key: string) {
  return [...(props.config.rowActions || []), ...(props.config.batchActions || [])].find(
    (action) => action.key === key && !action.fields?.length,
  )
}

const hasInlineStatusSwitch = computed(() => Boolean(findInlineStatusAction('enable') && findInlineStatusAction('disable')))
const rowActionsForMenu = computed(() => (props.config.rowActions || []).filter((action) => !isInlineStatusAction(action)))
const headerActions = computed(() => props.config.headerActions || [])
// 高频行操作可以配置为直接按钮，减少用户反复展开下拉菜单的成本。
const inlineActionKeys = computed(() => new Set(props.config.inlineActionKeys || []))
const inlineRowActions = computed(() => rowActionsForMenu.value.filter((action) => inlineActionKeys.value.has(action.key)))
const dropdownRowActions = computed(() => rowActionsForMenu.value.filter((action) => !inlineActionKeys.value.has(action.key)))
const canEditRow = computed(() => !props.config.readOnly && Boolean(props.config.updateFields?.length))
const canDeleteRow = computed(() => !props.config.readOnly && Boolean(props.config.deleteLabel))
const showDirectDelete = computed(() => canDeleteRow.value && (props.config.directDelete || !dropdownRowActions.value.length))
const showDropdownDelete = computed(() => canDeleteRow.value && !showDirectDelete.value)
const showOperationColumn = computed(
  () =>
    canEditRow.value
    || Boolean(inlineRowActions.value.length || dropdownRowActions.value.length || showDirectDelete.value || showDropdownDelete.value),
)
const operationColumnWidth = computed(() => {
  const actionCount =
    (canEditRow.value ? 1 : 0) +
    inlineRowActions.value.length +
    (showDirectDelete.value ? 1 : 0) +
    (dropdownRowActions.value.length || showDropdownDelete.value ? 1 : 0)
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
      path: (record) => rowDeletePath(record),
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
const emptyTip = computed(() =>
  hasActiveFilters.value
    ? '可以清空筛选条件后重新查看全部数据。'
    : '当前模块还没有数据，可以通过上方操作创建或导入。',
)

function rowId(row: AnyRecord) {
  return String(row[idKey.value])
}

function rowDeletePath(row: AnyRecord) {
  return props.config.deletePath ? props.config.deletePath(row) : `${props.config.endpoint}/${rowId(row)}`
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

function openInteractionSessionDetail(record: AnyRecord) {
  interactionSessionDetailId.value = rowId(record)
  interactionSessionDetailVisible.value = true
}

function openPublishedContentDetail(record: AnyRecord) {
  publishedContentDetailId.value = rowId(record)
  publishedContentDetailVisible.value = true
}

function openResultDialog(action: RowActionConfig, data: unknown, loading = false) {
  resultTitle.value = action.label
  resultValue.value = data
  resultColumns.value = action.resultColumns || []
  resultLoading.value = loading
  resultDialogVisible.value = true
}

function actionIcon(action: RowActionConfig) {
  return action.icon ? iconMap[action.icon] || MoreHorizontal : MoreHorizontal
}

function getAssetRawUrl(record: AnyRecord, key?: string) {
  const value = key ? getCellValue(record, key) : record.source_url || record.public_url || record.url || record.storage_uri
  const url = String(value || '').trim()
  return url && !url.startsWith('local://') ? url : ''
}

function getAssetUrl(record: AnyRecord, key?: string) {
  const rawUrl = getAssetRawUrl(record, key)
  return rawUrl ? resolveBackendUrl(rawUrl) : ''
}

function getAssetFilename(record: AnyRecord, key?: string) {
  const name = String((key ? getCellValue(record, key) : record.name) || '').trim()
  return name || `asset-${rowId(record)}`
}

function getAssetDownloadEndpoint(record: AnyRecord) {
  if (props.config.key !== 'mediaAssets') return ''
  const storageUri = String(record.storage_uri || '').trim()
  if (!storageUri.startsWith('local://')) return ''
  return `${props.config.endpoint}/${encodeURIComponent(rowId(record))}/download`
}

function assetInlinePreviewKind(record: AnyRecord) {
  const type = String(record.asset_type || '').toLowerCase()
  const mime = String(record.mime_type || '').toLowerCase()
  if (type === 'image' || mime.startsWith('image/')) return 'image'
  if (type === 'video' || mime.startsWith('video/')) return 'video'
  return 'other'
}

function assetTypeLabel(record: AnyRecord, column: ColumnConfig) {
  const value = String(record.asset_type || '')
  const option = column.options?.find((item) => String(item.value) === value)
  return option?.label || value || '文件'
}

function openAssetViewer(record: AnyRecord) {
  const kind = assetInlinePreviewKind(record)
  const url = getAssetUrl(record, 'source_url')
  if ((kind !== 'image' && kind !== 'video') || !url) return
  assetViewerKind.value = kind
  assetViewerUrl.value = url
  assetViewerTitle.value = String(record.name || '素材预览')
  assetViewerFilename.value = getAssetFilename(record, 'name')
  assetViewerRecord.value = record
  assetViewerVisible.value = true
}

async function downloadViewerAsset() {
  if (assetViewerRecord.value) {
    await downloadAssetRecord(assetViewerRecord.value, assetViewerFilename.value || assetViewerTitle.value || 'asset', 'source_url')
    return
  }
  await downloadUrl(assetViewerUrl.value, assetViewerFilename.value || assetViewerTitle.value || 'asset')
}

async function downloadUrl(url: string, filename: string, auth = false) {
  if (!url) return
  try {
    const headers: HeadersInit = {}
    const accessToken = localStorage.getItem('access_token')
    if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`
    const response = await fetch(url, { headers })
    if (!response.ok) throw new Error(response.statusText || '下载失败')
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
    ElMessage.success('已开始下载')
  } catch (error) {
    if (auth) {
      ElNotification.error({
        title: '下载失败',
        message: error instanceof Error ? error.message : '素材下载失败，请稍后重试',
      })
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
    ElNotification.info({
      title: '已打开素材地址',
      message: '浏览器无法直接下载该地址，已在新窗口打开',
    })
  }
}

async function downloadAssetRecord(record: AnyRecord, filename: string, urlKey?: string) {
  const endpoint = getAssetDownloadEndpoint(record)
  if (endpoint) {
    await downloadUrl(resolveBackendUrl(endpoint), filename, true)
    return
  }
  const url = getAssetUrl(record, urlKey)
  if (!url) {
    ElNotification.warning({
      title: '无法下载',
      message: '当前素材没有可访问的公开地址',
    })
    return
  }
  await downloadUrl(url, filename)
}

async function downloadAsset(action: RowActionConfig, record: AnyRecord) {
  await downloadAssetRecord(record, getAssetFilename(record, action.filenameKey), action.urlKey)
}

function isEnabledStatus(value: unknown, column?: ColumnConfig) {
  const config = defaultStatusSwitchConfig(column)
  const status = String(value || '')
  if (status === config.activeValue) return true
  if (status === config.inactiveValue) return false
  return status !== '' && status !== 'disabled'
}

function isSwitchableStatusColumn(column: ColumnConfig) {
  return column.type === 'statusSwitch' || (column.key === 'status' && hasInlineStatusSwitch.value)
}

function shouldShowStatusBadgeWithSwitch(value: unknown) {
  return !['', 'enabled', 'disabled', 'used', 'unused'].includes(String(value || ''))
}

async function toggleEnabledStatus(row: AnyRecord, column: ColumnConfig, nextValue: boolean) {
  const config = defaultStatusSwitchConfig(column)
  const key = nextValue ? config.activeActionKey : config.inactiveActionKey
  const configuredAction = findInlineStatusAction(key)
  const action: RowActionConfig = configuredAction
    ? { ...configuredAction, confirm: undefined, refresh: true }
    : {
        key,
        label: nextValue ? config.activeText : config.inactiveText,
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
    error.value = notifyError(err, '加载失败', '加载失败')
  } finally {
    loading.value = false
  }
}

function shouldRefreshForRealtime(event: RealtimeEventPayload) {
  if (props.config.key === 'tasks') return event.topic === 'task'
  if (props.config.key === 'runtimes') return event.topic === 'runtime' || event.topic === 'task'
  if (props.config.key === 'slots') return event.topic === 'runtime' || event.topic === 'task'
  if (props.config.key === 'publishedContents') return event.topic === 'content_monitor'
  if (props.config.key === 'interactionSessions') return event.topic === 'task'
  return false
}

function scheduleRealtimeRefresh() {
  if (realtimeRefreshTimer) window.clearTimeout(realtimeRefreshTimer)
  realtimeRefreshTimer = window.setTimeout(() => {
    loadRows()
  }, 500)
}

function handleRealtimeEvent(event: Event) {
  const payload = (event as CustomEvent<RealtimeEventPayload>).detail
  if (payload && shouldRefreshForRealtime(payload)) scheduleRealtimeRefresh()
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

function applySystemDefaults(state: AnyRecord, defaults: SystemDefaults) {
  const scalarDefaults: Record<string, string> = {
    business_platform: defaults.default_business_platform,
    runtime_platform: defaults.default_runtime_platform,
    provider: defaults.default_provider,
    ai_provider: defaults.default_ai_provider,
  }
  Object.entries(scalarDefaults).forEach(([key, value]) => {
    if (Object.prototype.hasOwnProperty.call(state, key)) state[key] = value
  })

  const listDefaults: Record<string, string[]> = {
    supported_business_platforms: [defaults.default_business_platform],
    supported_runtime_platforms: [defaults.default_runtime_platform],
    supported_providers: [defaults.default_provider],
  }
  Object.entries(listDefaults).forEach(([key, value]) => {
    if (Object.prototype.hasOwnProperty.call(state, key)) state[key] = value
  })
  return state
}

async function openCreate() {
  modal.type = 'create'
  modal.record = null
  modal.action = null
  slotGroupEditTab.value = 'base'
  let defaults = FALLBACK_SYSTEM_DEFAULTS
  try {
    defaults = await getSystemDefaults()
  } catch {
    // 配置接口异常时仍允许打开表单，回退值与后端默认值保持一致。
  }
  if (props.config.key === 'interactionSessions') {
    try {
      const aiOptions = await getEnabledAiProviderOptions(true)
      const aiField = (props.config.createFields || []).find((field) => field.key === 'ai_provider')
      if (aiField) aiField.options = aiOptions
      defaults = {
        ...defaults,
        default_ai_provider: resolveEnabledAiProvider(defaults.default_ai_provider, aiOptions),
      }
    } catch (err) {
      notifyError(err, '加载失败', '加载已启用的互动 AI 失败')
    }
  }
  formState.value = applySystemDefaults(
    buildFormState(props.config.createFields || []),
    defaults,
  )
}

defineExpose({
  loadRows,
  openCreate,
})

async function openEdit(record: AnyRecord) {
  loading.value = true
  error.value = ''
  try {
    // 部分资源的编辑表单需要额外子资源，例如脚本参数，需要先加载详情再打开弹窗。
    const editRecord = props.config.loadEditRecord ? await props.config.loadEditRecord(record) : record
    modal.type = 'edit'
    modal.record = editRecord
    modal.action = null
    slotGroupEditTab.value = 'base'
    formState.value = buildFormState(props.config.updateFields || [], editRecord)
  } catch (err) {
    const message = notifyError(err, '加载失败', '加载编辑数据失败')
    error.value = message
  } finally {
    loading.value = false
  }
}

function closeModal() {
  modal.type = null
  modal.record = null
  modal.action = null
  slotGroupEditTab.value = 'base'
  formState.value = {}
  submitting.value = false
}

async function confirmAction(
  message?: string,
  type: 'warning' | 'error' = 'warning',
  title = '确认操作',
) {
  if (!message) return true
  try {
    await ElMessageBox.confirm(message, title, {
      type,
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      closeOnClickModal: false,
      closeOnPressEscape: false,
      distinguishCancelAndClose: true,
      confirmButtonClass: type === 'error' ? 'el-button--danger' : undefined,
    })
    return true
  } catch {
    return false
  }
}

async function submitEntity() {
  submitting.value = true
  error.value = ''
  let successMessage = '保存成功'
  let successTitle = '操作成功'
  let useSuccessNotification = false
  try {
    if (modal.type === 'create') {
      const payload = buildPayload(props.config.createFields || [], formState.value, 'create')
      // 有些资源创建时需要把表单拆成主表与子资源两次请求，例如脚本和脚本参数。
      const body = props.config.createBody ? props.config.createBody(payload) : payload
      const data = await http.post<AnyRecord>(props.config.createEndpoint || props.config.endpoint, body)
      if (props.config.afterCreate) await props.config.afterCreate(data, payload)
      if (props.config.createSuccessMessage) {
        successMessage = props.config.createSuccessMessage(data, payload)
        successTitle = props.config.createSuccessTitle || successTitle
        useSuccessNotification = true
      }
    }
    if (modal.type === 'edit' && modal.record) {
      const payload = buildPayload(props.config.updateFields || [], formState.value, 'update')
      const body = props.config.updateBody ? props.config.updateBody(payload, modal.record) : payload
      const data = await http.put<AnyRecord>(`${props.config.endpoint}/${rowId(modal.record)}`, body)
      if (props.config.afterUpdate) await props.config.afterUpdate(data, payload, modal.record)
    }
    closeModal()
    if (useSuccessNotification) {
      ElNotification.success({
        title: successTitle,
        message: successMessage,
        duration: 7000,
      })
    } else {
      ElMessage.success(successMessage)
    }
    await loadRows()
  } catch (err) {
    error.value = notifyError(err, '提交失败', '提交失败')
  } finally {
    submitting.value = false
  }
}

async function deleteRow(record: AnyRecord) {
  const message = props.config.deleteConfirm || `确认删除 ${rowId(record)}？`
  if (!(await confirmAction(message, 'error', '确认删除'))) return
  await executeRequest(
    {
      key: 'delete',
      label: props.config.deleteLabel || '删除',
      method: 'DELETE',
      path: () => rowDeletePath(record),
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
  if (!action.method || !action.path) throw new Error('当前操作缺少接口配置')
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

function openBatchAction(action: RowActionConfig) {
  modal.type = 'batch'
  const selectedPlatforms = [...new Set(selectedRows.value.map((row) => String(row.business_platform || '')).filter(Boolean))]
  modal.record = {
    selectedRows: selectedRows.value,
    business_platform: selectedPlatforms.length === 1 ? selectedPlatforms[0] : undefined,
  }
  modal.action = action
  formState.value = buildFormState(action.fields || [])
}

function openHeaderAction(action: RowActionConfig) {
  modal.type = 'action'
  modal.record = {}
  modal.action = action
  formState.value = buildFormState(action.fields || [])
}

async function runHeaderAction(action: RowActionConfig) {
  if (action.fields?.length) {
    openHeaderAction(action)
    return
  }
  await executeRequest(action, {})
}

async function executeBatchAction(action: RowActionConfig, payload: AnyRecord = {}) {
  if (!selectedRows.value.length) return
  const actionName = action.label.replace(/^批量/, '')
  const isDanger = action.variant === 'danger' || action.method === 'DELETE'
  const message =
    action.key === '__delete'
    ? `确认删除已选 ${selectedRows.value.length} 条数据？此操作不可恢复。`
    : `确认对已选 ${selectedRows.value.length} 条数据执行${actionName}？`
  if (!(await confirmAction(message, isDanger ? 'error' : 'warning', isDanger ? '确认批量删除' : '确认批量操作'))) return

  submitting.value = true
  error.value = ''
  const failures: string[] = []
  const rowsToHandle = [...selectedRows.value]
  let batchData: unknown = null
  if (action.showResult) openResultDialog(action, null, true)
  try {
    if (action.batchPath || action.batchBody || action.batchParams) {
      const path = action.batchPath
        ? action.batchPath(rowsToHandle, payload)
        : action.path?.(rowsToHandle[0], payload) || ''
      const body = action.batchBody ? action.batchBody(payload, rowsToHandle) : payload
      const params = typeof action.batchParams === 'function'
        ? action.batchParams(payload, rowsToHandle)
        : action.batchParams
      if (action.method === 'GET') {
        batchData = await http.get(path, params)
        openResultDialog(action, batchData)
      } else if (action.method === 'PUT') {
        batchData = await http.put(path, body)
      } else if (action.method === 'DELETE') {
        batchData = await http.delete(path)
      } else {
        batchData = await http.post(path, body, params)
      }
    } else {
      for (const row of rowsToHandle) {
        try {
          await requestAction(action, row, payload)
        } catch (err) {
          const message = getErrorMessage(err, '操作失败')
          failures.push(`${rowId(row)}：${message}`)
        }
      }
    }
    if (failures.length) {
      throw new Error(`部分数据处理失败：${failures.slice(0, 3).join('；')}`)
    }
    if (action.showResult && batchData) {
      openResultDialog(action, batchData, false)
    } else {
      ElMessage.success(
        action.successMessage && batchData
          ? action.successMessage(batchData as AnyRecord, payload)
          : `已处理 ${rowsToHandle.length} 条`,
      )
    }
    clearSelection()
    if (action.refresh !== false) await loadRows()
  } catch (err) {
    error.value = notifyError(err, '批量操作失败', '批量操作失败')
    if (action.showResult) {
      resultValue.value = {
        status: 'failed',
        checked_at: new Date().toISOString(),
        error_message: getErrorMessage(err, '批量操作失败'),
      }
    }
  } finally {
    resultLoading.value = false
    submitting.value = false
  }
}

async function runBatchAction(action: RowActionConfig) {
  if (action.fields?.length) {
    openBatchAction(action)
    return
  }
  await executeBatchAction(action)
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
  if (props.config.key === 'interactionSessions' && action.key === 'detail') {
    openInteractionSessionDetail(record)
    return
  }
  if (props.config.key === 'publishedContents' && action.key === 'detail') {
    openPublishedContentDetail(record)
    return
  }
  if (action.clientAction === 'download') {
    await downloadAsset(action, record)
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

async function submitBatchAction() {
  if (!modal.action) return
  const payload = buildPayload(modal.action.fields || [], formState.value, 'action')
  await executeBatchAction(modal.action, payload)
  closeModal()
}

async function executeRequest(action: RowActionConfig, record: AnyRecord, payload: AnyRecord = {}) {
  const message = typeof action.confirm === 'function' ? action.confirm(record) : action.confirm
  const isDanger = action.variant === 'danger' || action.method === 'DELETE'
  if (!(await confirmAction(message, isDanger ? 'error' : 'warning'))) return

  submitting.value = true
  error.value = ''
  if (action.showResult) openResultDialog(action, null, true)
  try {
    const data = await requestAction(action, record, payload)
    if (action.method === 'GET' || action.showResult) openResultDialog(action, data, false)

    if (action.method !== 'GET' && !action.showResult) {
      if (action.successMessage) {
        ElNotification.success({
          title: action.successTitle || '操作完成',
          message: action.successMessage(data as AnyRecord, payload),
          duration: 7000,
        })
      } else {
        ElMessage.success('操作完成')
      }
    }
    if (action.refresh !== false) await loadRows()
  } catch (err) {
    error.value = notifyError(err, '操作失败', '操作失败')
    if (action.showResult) {
      resultValue.value = {
        status: 'failed',
        checked_at: new Date().toISOString(),
        error_message: getErrorMessage(err, '操作失败'),
      }
    }
  } finally {
    resultLoading.value = false
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
  resultLoading.value = false
  resultColumns.value = []
  taskDetailVisible.value = false
  taskDetailId.value = null
  publishedContentDetailVisible.value = false
  publishedContentDetailId.value = null
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
  window.addEventListener(REALTIME_EVENT_NAME, handleRealtimeEvent)
})

onBeforeUnmount(() => {
  window.removeEventListener(REALTIME_EVENT_NAME, handleRealtimeEvent)
  if (realtimeRefreshTimer) window.clearTimeout(realtimeRefreshTimer)
})
</script>

<template>
  <section class="resource-page space-y-4" :class="{ 'resource-page--embedded': props.embedded }">
    <div
      v-if="!props.hideHeaderActions"
      class="resource-page__header flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
    >
      <div>
        <h1 v-if="!props.embedded" class="text-xl font-semibold text-ink">{{ config.title }}</h1>
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
        <el-button
          v-for="action in headerActions"
          :key="action.key"
          :type="action.variant === 'danger' ? 'danger' : action.variant === 'success' ? 'success' : undefined"
          :icon="actionIcon(action)"
          :disabled="loading || submitting"
          @click="runHeaderAction(action)"
        >
          {{ action.label }}
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
                :context="filters"
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

    <div v-if="batchActions.length && hasSelectedRows" class="batch-toolbar">
      <div class="batch-toolbar__summary">
        <ListChecks class="h-4 w-4 text-slate-500" />
        <span>已选择</span>
        <strong>{{ selectedCount }}</strong>
        <span>条数据</span>
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
        :scrollbar-always-on="!props.embedded"
        :class="['resource-table', `resource-table--${config.key}`]"
        table-layout="auto"
        @selection-change="handleSelectionChange"
      >
        <el-table-column v-if="batchActions.length" type="selection" width="48" reserve-selection />

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
            <AccountTableCell
              v-if="column.type && ['accountIdentity', 'accountGroup', 'accountCredentials', 'accountPlatform', 'accountEnvironment'].includes(column.type)"
              :kind="column.type as 'accountIdentity' | 'accountGroup' | 'accountCredentials' | 'accountPlatform' | 'accountEnvironment'"
              :row="row"
              :column="column"
            />
            <div v-else-if="isSwitchableStatusColumn(column)" class="flex items-center gap-2">
              <el-switch
                :model-value="isEnabledStatus(row[column.key], column)"
                :active-text="defaultStatusSwitchConfig(column).activeText"
                :inactive-text="defaultStatusSwitchConfig(column).inactiveText"
                inline-prompt
                :loading="submitting"
                @change="(value) => toggleEnabledStatus(row, column, Boolean(value))"
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
            <template v-else-if="column.type === 'assetPreview'">
              <div class="asset-inline-preview">
                <button
                  v-if="assetInlinePreviewKind(row) === 'image' && getAssetUrl(row, 'source_url')"
                  type="button"
                  class="asset-inline-preview__button"
                  :aria-label="`查看图片：${String(row.name || '素材图片')}`"
                  @click="openAssetViewer(row)"
                >
                  <img
                    class="asset-inline-preview__media"
                    :src="getAssetUrl(row, 'source_url')"
                    :alt="String(row.name || '素材图片')"
                  >
                </button>
                <button
                  v-else-if="assetInlinePreviewKind(row) === 'video' && getAssetUrl(row, 'source_url')"
                  type="button"
                  class="asset-inline-preview__button"
                  :aria-label="`播放视频：${String(row.name || '素材视频')}`"
                  @click="openAssetViewer(row)"
                >
                  <video
                    class="asset-inline-preview__media"
                    :src="getAssetUrl(row, 'source_url')"
                    muted
                    playsinline
                    preload="metadata"
                  />
                  <span class="asset-inline-preview__play">
                    <Play class="h-4 w-4" />
                  </span>
                </button>
                <el-tag v-else effect="plain">{{ assetTypeLabel(row, column) }}</el-tag>
              </div>
            </template>
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
                v-if="dropdownRowActions.length || showDropdownDelete"
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
                      v-if="showDropdownDelete"
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
          <el-empty :description="emptyDescription" :image-size="78">
            <p class="table-empty__tip">{{ emptyTip }}</p>
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
      :width="modalWidth"
      destroy-on-close
      append-to-body
      @close="closeModal"
    >
      <BusinessDispatchForm
        v-if="dispatchFormMode"
        v-model="formState"
        :mode="dispatchFormMode"
        :fields="modalFields"
        :context="modal.record || undefined"
      />
      <div
        v-else-if="modal.type === 'edit' && config.accountGroupMembers && modal.record"
        class="account-group-edit-layout"
      >
        <div class="account-group-edit-layout__base">
          <div class="edit-panel-title">基础信息</div>
          <DynamicForm v-model="formState" :fields="modalFields" :context="modal.record || undefined" />
        </div>
        <AccountGroupMemberEditor
          class="account-group-edit-layout__members"
          :group="modal.record"
          @changed="loadRows"
        />
      </div>
      <el-tabs
        v-else-if="modal.type === 'edit' && (config.slotGroupMembers || config.proxyGroupMembers || config.contentGroupMembers) && modal.record"
        v-model="slotGroupEditTab"
        class="slot-group-edit-tabs"
      >
        <el-tab-pane label="基础信息" name="base">
          <div class="slot-group-edit-tabs__panel">
            <DynamicForm v-model="formState" :fields="modalFields" :context="modal.record || undefined" />
          </div>
        </el-tab-pane>
        <el-tab-pane :label="groupMembersTabLabel" name="members">
          <SlotGroupMemberEditor
            v-if="config.slotGroupMembers"
            :group="modal.record"
            @changed="loadRows"
          />
          <ProxyGroupMemberEditor
            v-else-if="config.proxyGroupMembers"
            :group="modal.record"
            @changed="loadRows"
          />
          <ContentGroupMemberEditor
            v-else
            :group="modal.record"
            @changed="loadRows"
          />
        </el-tab-pane>
      </el-tabs>
      <DynamicForm v-else v-model="formState" :fields="modalFields" :context="modal.record || undefined" />
      <template #footer>
        <el-button @click="closeModal">取消</el-button>
        <el-button
          v-if="showModalSaveButton"
          type="primary"
          :loading="submitting"
          @click="modal.type === 'batch' ? submitBatchAction() : modal.type === 'action' ? submitAction() : submitEntity()"
        >
          {{ modalSubmitLabel }}
        </el-button>
      </template>
    </el-dialog>

    <ActionResultDialog
      v-model="resultDialogVisible"
      :title="resultTitle"
      :value="resultValue"
      :columns="resultColumns"
      :loading="resultLoading"
    />

    <el-dialog
      v-model="assetViewerVisible"
      :title="assetViewerTitle || '素材预览'"
      width="min(92vw, 1080px)"
      destroy-on-close
      append-to-body
    >
      <div class="asset-viewer">
        <img
          v-if="assetViewerKind === 'image'"
          class="asset-viewer__image"
          :src="assetViewerUrl"
          :alt="assetViewerTitle"
        >
        <video
          v-else
          class="asset-viewer__video"
          :src="assetViewerUrl"
          controls
          playsinline
          preload="metadata"
        />
      </div>
      <template #footer>
        <el-button :icon="Download" @click="downloadViewerAsset">下载</el-button>
        <el-button type="primary" @click="assetViewerVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <TaskDetailDrawer v-if="config.key === 'tasks'" v-model="taskDetailVisible" :task-id="taskDetailId" />
    <InteractionSessionDetailDialog
      v-if="config.key === 'interactionSessions'"
      v-model="interactionSessionDetailVisible"
      :session-id="interactionSessionDetailId"
    />
    <PublishedContentDetailDialog
      v-if="config.key === 'publishedContents'"
      v-model="publishedContentDetailVisible"
      :content-id="publishedContentDetailId"
    />
  </section>
</template>

<style scoped>
.filter-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.resource-page--embedded {
  gap: 12px;
}

.resource-page--embedded .resource-page__header {
  justify-content: flex-end;
  margin-top: -2px;
}

.resource-page--embedded .resource-page__header > div:first-child {
  display: none;
}

.resource-page--embedded :deep(.filter-card .el-card__body) {
  padding: 12px 14px;
}

.resource-page--embedded .filter-card__header {
  margin-bottom: 10px;
}

.resource-page--embedded .filter-grid {
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 10px 12px;
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
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 48px;
  padding: 10px 14px 10px 16px;
  overflow: hidden;
  border: 1px solid #d9e6f2;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 8px 22px rgb(15 23 42 / 6%);
}

.batch-toolbar::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: #2f6f9f;
  content: "";
}

.batch-toolbar__summary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 132px;
  color: #475569;
  font-size: 13px;
  white-space: nowrap;
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
  justify-content: flex-end;
  gap: 8px;
}

.batch-toolbar :deep(.el-button) {
  margin-left: 0;
}

.batch-toolbar :deep(.el-button.is-plain) {
  border-color: #cddbea;
  background: #f8fbff;
}

.batch-toolbar :deep(.el-button--danger.is-plain) {
  border-color: #f2b8b8;
  background: #fff7f7;
}

.resource-table :deep(.el-table__cell) {
  padding: 9px 0;
}

.resource-table :deep(th.el-table__cell) {
  padding: 8px 0;
}

.resource-table :deep(.el-table__empty-block) {
  min-height: 260px;
}

.resource-table :deep(.el-button.is-circle) {
  width: 30px;
  height: 30px;
}

.resource-table--accounts :deep(th.el-table__cell) {
  color: #526477;
  background: #f3f7fa;
  font-size: 12px;
  font-weight: 700;
}

.resource-table--accounts :deep(td.el-table__cell) {
  padding: 11px 0;
}

.resource-table--accounts :deep(.el-table__row:hover > td.el-table__cell) {
  background: #f4f9fd;
}

.resource-table--accounts :deep(.el-button.is-circle) {
  border: 1px solid transparent;
  color: #52677a;
  background: #f4f7fa;
}

.resource-table--accounts :deep(.el-button.is-circle:hover) {
  border-color: #bfd5e6;
  color: #1f668f;
  background: #edf7fd;
}

.resource-table--accounts :deep(.el-button--danger.is-circle) {
  color: #c94c4c;
  background: #fff5f5;
}

.table-pagination {
  display: flex;
  justify-content: flex-end;
  padding: 14px 16px;
  border-top: 1px solid #e6edf3;
}

.table-empty__tip {
  max-width: 320px;
  margin: -4px auto 12px;
  color: #7b8794;
  font-size: 13px;
  line-height: 1.6;
}

.account-group-edit-layout {
  display: grid;
  grid-template-columns: minmax(280px, 0.86fr) minmax(560px, 1.4fr);
  gap: 18px;
  align-items: start;
}

.slot-group-edit-tabs__panel {
  min-width: 0;
  padding: 14px;
  border: 1px solid #e6edf3;
  border-radius: 8px;
  background: #fbfdff;
}

.slot-group-edit-tabs :deep(.el-tabs__header) {
  margin-bottom: 14px;
}

.account-group-edit-layout__base,
.account-group-edit-layout__members {
  min-width: 0;
}

.account-group-edit-layout__base {
  padding: 14px;
  border: 1px solid #e6edf3;
  border-radius: 8px;
  background: #fbfdff;
}

.edit-panel-title {
  margin-bottom: 12px;
  color: #1f2933;
  font-size: 15px;
  font-weight: 700;
}

.asset-inline-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 84px;
}

.asset-inline-preview__button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.asset-inline-preview__media {
  width: 144px;
  height: 80px;
  border: 1px solid #d9e2ec;
  border-radius: 8px;
  background: #0f172a;
  object-fit: cover;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
}

.asset-inline-preview__button:hover .asset-inline-preview__media {
  border-color: #2563eb;
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.18);
  transform: translateY(-1px);
}

.asset-inline-preview__play {
  position: absolute;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  color: #ffffff;
  background: rgba(15, 23, 42, 0.72);
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.25);
}

.asset-viewer {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 280px;
  max-height: 72vh;
  overflow: hidden;
  border-radius: 8px;
  background: #0f172a;
}

.asset-viewer__image,
.asset-viewer__video {
  display: block;
  max-width: 100%;
  max-height: 72vh;
}

.asset-viewer__image {
  object-fit: contain;
}

.asset-viewer__video {
  width: 100%;
  background: #000000;
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

  .account-group-edit-layout {
    grid-template-columns: 1fr;
  }

}
</style>
