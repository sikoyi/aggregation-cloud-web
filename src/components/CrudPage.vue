<script setup lang="ts">
import { ElDialog } from 'element-plus'
import InlineFormPanel from '@/components/InlineFormPanel.vue'
import {
  Copy,
  Download,
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
import AccountIdentityTableCell from '@/components/AccountIdentityTableCell.vue'
import DeviceTableCell from '@/components/DeviceTableCell.vue'
import ContentTableCell from '@/components/ContentTableCell.vue'
import DynamicForm from '@/components/DynamicForm.vue'
import MediaAssetTableCell from '@/components/MediaAssetTableCell.vue'
import ProxyTableCell from '@/components/ProxyTableCell.vue'
import PublishedContentTableCell from '@/components/PublishedContentTableCell.vue'
import RemoteSelect from '@/components/RemoteSelect.vue'
import RelationCell from '@/components/RelationCell.vue'
import ScriptTableCell from '@/components/ScriptTableCell.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import TaskTableCell from '@/components/TaskTableCell.vue'
import TemplateTableCell from '@/components/TemplateTableCell.vue'
import { useCrossPageTableSelection } from '@/composables/useCrossPageTableSelection'
import { usePersistentFilters } from '@/composables/usePersistentFilters'
import { REALTIME_EVENT_NAME, type RealtimeEventPayload } from '@/composables/useRealtimeEvents'
import {
  dataScopeForFieldKey,
  filterOptionsByScope,
  isDataScopedFieldKey,
} from '@/config/options'
import { useAuthStore } from '@/stores/auth'
import type { AnyRecord, PageResult } from '@/types/api'
import type { ColumnConfig, FieldConfig, IconMap, ResourceConfig, RowActionConfig } from '@/types/crud'
import { buildFormState, buildPayload } from '@/utils/form'
import { saveDownload } from '@/utils/download'
import { identitySelectionLabel } from '@/utils/accountIdentitySelection'
import { formatCell, getCellValue, truncateId } from '@/utils/format'
import { getErrorMessage, notifyError } from '@/utils/notify'
import {
  patchRuntimeSummaryRows,
  patchTaskSummaryRows,
  realtimeRuntimeSummary,
  realtimeTaskTouchesRows,
  rowsContainRealtimeValue,
} from '@/utils/realtimeRows'
import { collectRuntimeSyncFailures, type RuntimeSyncFailure } from '@/utils/runtimeSyncFailures'

const AccountTagMemberEditor = defineAsyncComponent(() => import('@/components/AccountTagMemberEditor.vue'))
const AccountIdentityPlatformDetails = defineAsyncComponent(() => import('@/components/AccountIdentityPlatformDetails.vue'))
const AccountIdentityCredentialsDialog = defineAsyncComponent(() => import('@/components/AccountIdentityCredentialsDialog.vue'))
const AccountExportPreflightDialog = defineAsyncComponent(() => import('@/components/AccountExportPreflightDialog.vue'))
const ActionResultDialog = defineAsyncComponent(() => import('@/components/ActionResultDialog.vue'))
const BusinessDispatchForm = defineAsyncComponent(() => import('@/components/BusinessDispatchForm.vue'))
const ContentPreview = defineAsyncComponent(() => import('@/components/ContentPreview.vue'))
const ContentGroupMemberEditor = defineAsyncComponent(() => import('@/components/ContentGroupMemberEditor.vue'))
const InteractionSessionDetailDialog = defineAsyncComponent(() => import('@/components/InteractionSessionDetailDialog.vue'))
const InteractionSessionProgressCell = defineAsyncComponent(() => import('@/components/InteractionSessionProgressCell.vue'))
const InteractionSessionTableCell = defineAsyncComponent(() => import('@/components/InteractionSessionTableCell.vue'))
const MediaAssetBatchUploader = defineAsyncComponent(() => import('@/components/MediaAssetBatchUploader.vue'))
const MediaAssetGroupMemberEditor = defineAsyncComponent(() => import('@/components/MediaAssetGroupMemberEditor.vue'))
const ProxyGroupMemberEditor = defineAsyncComponent(() => import('@/components/ProxyGroupMemberEditor.vue'))
const PublishedContentDetailDialog = defineAsyncComponent(() => import('@/components/PublishedContentDetailDialog.vue'))
const PublishedContentTaskItems = defineAsyncComponent(() => import('@/components/PublishedContentTaskItems.vue'))
const SlotGroupMemberEditor = defineAsyncComponent(() => import('@/components/SlotGroupMemberEditor.vue'))
const TaskDetailDrawer = defineAsyncComponent(() => import('@/components/TaskDetailDrawer.vue'))
const TaskTemplateDetailDialog = defineAsyncComponent(() => import('@/components/TaskTemplateDetailDialog.vue'))

const props = defineProps<{
  config: ResourceConfig
  embedded?: boolean
  hideHeaderActions?: boolean
  inlineForms?: boolean
}>()
const auth = useAuthStore()
const emit = defineEmits<{ exportRecords: [recordId?: string] }>()


const iconMap: IconMap = {
  copy: Copy,
  download: Download,
  edit: Edit3,
  eye: Eye,
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
const slotGroupMemberRef = ref<InstanceType<typeof SlotGroupMemberEditor> | null>(null)
const inlineBusy = computed(() => submitting.value || Boolean(slotGroupMemberRef.value?.isBusy()))
const error = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const rows = ref<AnyRecord[]>([])
let appliedIdentityPlatform: string | undefined
const {
  tableRef,
  selectedRows,
  handleSelectionChange,
  restorePageSelection,
  clearSelection: clearTableSelection,
} = useCrossPageTableSelection(rows, (row) => String(row.id))
const { filters } = usePersistentFilters(
  'list:' + props.config.key,
  () => Object.fromEntries((props.config.filters || []).map((field) => {
    const defaultValue = typeof field.defaultValue === 'function'
      ? field.defaultValue()
      : field.defaultValue
    return [field.key, defaultValue ?? '']
  })),
)
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
const identityCredentialsId = ref<string | null>(null)
const exportSelection = ref<{ source: 'accounts' | 'identities'; records: AnyRecord[] } | null>(null)
const assetViewerVisible = ref(false)
const assetViewerTitle = ref('')
const assetViewerUrl = ref('')
const assetViewerKind = ref<'image' | 'video'>('image')
const assetViewerFilename = ref('')
const assetViewerRecord = ref<AnyRecord | null>(null)
const pageRootRef = ref<HTMLElement | null>(null)
const slotGroupEditTab = ref('base')
let realtimeRefreshTimer: number | undefined
let realtimeConsistencyTimer: number | undefined
let realtimeConsistencyDueAt = 0
let realtimeRefreshPending = false
let realtimeRefreshRunning = false
let lastRealtimeRefreshAt = 0
let listRequestId = 0
let visibleLoadingRequestId = 0
let pageVisibilityObserver: IntersectionObserver | undefined
let runtimeSyncFailureDialogOpen = false
const seenRuntimeSyncFailures = new Set<string>()

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
const templateDetailId = ref<string | null>(null)

const hasActiveUserOperation = computed(() => Boolean(
  modal.type
  || templateDetailId.value
  || selectedRows.value.length
  || taskDetailVisible.value
  || interactionSessionDetailVisible.value
  || publishedContentDetailVisible.value
  || identityCredentialsId.value
  || exportSelection.value
  || assetViewerVisible.value,
))

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
const isMediaAssetBatchCreateModal = computed(() => Boolean(props.config.mediaAssetBatchUpload && modal.type === 'create'))
const modalWidth = computed(() => {
  if (modal.type === 'batch' && modal.action?.key === 'export-accounts') return 'min(520px, calc(100vw - 32px))'
  if (isMediaAssetBatchCreateModal.value) return '900px'
  if (isInteractionSessionCreateModal.value) return '1240px'
  if (isPublishedContentDispatchModal.value && formState.value.dispatch_mode === 'account_pool') return '1420px'
  if (isTaskDispatchModal.value) return 'min(1120px, calc(100vw - 24px))'
  if (isPublishedContentDispatchModal.value) return '1120px'
  if (modal.type === 'edit' && props.config.editPreview === 'content') return '1100px'
  if (
    modal.type === 'edit'
    && (
      props.config.accountTagMembers
      || props.config.slotGroupMembers
      || props.config.proxyGroupMembers
      || props.config.contentGroupMembers
      || props.config.mediaAssetGroupMembers
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
  if (isMediaAssetBatchCreateModal.value) return false
  if (modal.type !== 'edit') return true
  if ((props.config.slotGroupMembers || props.config.proxyGroupMembers || props.config.contentGroupMembers || props.config.mediaAssetGroupMembers) && slotGroupEditTab.value === 'members') return false
  return true
})
const groupMembersTabLabel = computed(() => {
  if (props.config.proxyGroupMembers) return '组内代理'
  if (props.config.contentGroupMembers) return '组内内容'
  if (props.config.mediaAssetGroupMembers) return '组内素材'
  return '组内设备'
})
const modalSubmitLabel = computed(() => (
  (modal.type === 'action' || modal.type === 'batch') && modal.action?.submitLabel
    ? modal.action.submitLabel
    : isTaskDispatchModal.value
      ? '确认执行'
      : isPublishedContentDispatchModal.value || isInteractionSessionCreateModal.value
        ? '确认下发'
        : '保存'
))
const visibleColumns = computed(() => props.config.columns.filter((column) => !column.hidden))
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
const permissionModuleByResource: Record<string, string> = {
  accounts: 'accounts',
  accountTags: 'accounts',
  slots: 'devices',
  slotGroups: 'devices',
  proxies: 'proxies',
  proxyGroups: 'proxies',
  contents: 'content',
  contentGroups: 'content',
  mediaAssets: 'media',
  mediaAssetGroups: 'media',
  interactionSessions: 'operations',
  publishedContents: 'operations',
  contentComments: 'monitoring',
  scripts: 'scripts',
  taskTemplates: 'templates',
  tasks: 'tasks',
  operationLogs: 'audit',
  runtimes: 'runtimes',
}

const permissionModule = computed(
  () => props.config.permissionModule || permissionModuleByResource[props.config.key] || '',
)

function canResource(action: string) {
  if (!permissionModule.value) return true
  return auth.can(`${permissionModule.value}.${action}`)
}

function scopedFieldOptions(field: FieldConfig) {
  const options = field.options || []
  if (!isDataScopedFieldKey(field.key)) return options
  return filterOptionsByScope(options, dataScopeForFieldKey(field.key, auth.user))
}

function normalizeScopedFilters() {
  for (const field of (props.config.filters || []).filter((item) => isDataScopedFieldKey(item.key))) {
    const value = String(filters[field.key] || '')
    if (!value) continue
    const allowedValues = scopedFieldOptions(field).map((option) => String(option.value))
    if (!allowedValues.includes(value)) filters[field.key] = ''
  }
}

function actionPermission(action: RowActionConfig) {
  if (action.permission) return action.permission
  if (!permissionModule.value) return ''

  const key = action.key.toLowerCase()
  const explicitAction: Record<string, string> = {
    'request-runtime-slot-sync': 'devices.sync',
    check: 'proxies.check',
    'batch-check': 'proxies.check',
    cancel: `${permissionModule.value}.cancel`,
    retry: `${permissionModule.value}.retry`,
    clone: 'templates.create',
    delete: `${permissionModule.value}.delete`,
    __delete: `${permissionModule.value}.delete`,
    detail: `${permissionModule.value}.view`,
    download: `${permissionModule.value}.view`,
    slots: `${permissionModule.value}.view`,
    import: `${permissionModule.value}.create`,
  }
  if (explicitAction[key]) return explicitAction[key]
  if (key.startsWith('batch-')) return `${permissionModule.value}.batch`
  return `${permissionModule.value}.edit`
}

function canRunAction(action: RowActionConfig) {
  const permission = actionPermission(action)
  return !permission || auth.can(permission)
}

const canCreateRow = computed(() => !props.config.readOnly && (
  props.config.createPermission ? auth.can(props.config.createPermission) : canResource('create')
))


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
    (action) => action.key === key && !action.fields?.length && canRunAction(action),
  )
}

const hasInlineStatusSwitch = computed(() => Boolean(findInlineStatusAction('enable') && findInlineStatusAction('disable')))
const rowActionsForMenu = computed(() => (props.config.rowActions || [])
  .filter((action) => !isInlineStatusAction(action) && canRunAction(action)))
const headerActions = computed(() => (props.config.headerActions || [])
  .filter((action) => canRunAction(action)))
// 高频行操作可以配置为直接按钮，减少用户反复展开下拉菜单的成本。
const inlineActionKeys = computed(() => new Set(props.config.inlineActionKeys || []))
const inlineRowActions = computed(() => rowActionsForMenu.value.filter((action) => inlineActionKeys.value.has(action.key)))
const dropdownRowActions = computed(() => rowActionsForMenu.value.filter((action) => !inlineActionKeys.value.has(action.key)))

function visibleInlineRowActions(record: AnyRecord) {
  return inlineRowActions.value.filter((action) => !action.visible || action.visible(record))
}

function visibleDropdownRowActions(record: AnyRecord) {
  return dropdownRowActions.value.filter((action) => !action.visible || action.visible(record))
}

const canEditRow = computed(() => !props.config.readOnly && Boolean(props.config.updateFields?.length) && canResource('edit'))
const canDeleteRow = computed(() => !props.config.readOnly && Boolean(props.config.deleteLabel) && canResource('delete'))
const showDirectDelete = computed(() => canDeleteRow.value && (props.config.directDelete || !dropdownRowActions.value.length))
const showDropdownDelete = computed(() => canDeleteRow.value && !showDirectDelete.value)

function deleteAllowed(record: AnyRecord) {
  return canDeleteRow.value && (!props.config.deleteAllowed || props.config.deleteAllowed(record))
}

function editAllowed(record: AnyRecord) {
  return canEditRow.value && (!props.config.editAllowed || props.config.editAllowed(record))
}

function rowActionAllowed(action: RowActionConfig, record: AnyRecord) {
  return canRunAction(action) && (!action.visible || action.visible(record))
}

function deleteBlockedMessage(record: AnyRecord) {
  return props.config.deleteBlockedMessage?.(record) || '当前记录暂时不能删除'
}

const showOperationColumn = computed(
  () =>
    canEditRow.value
    || Boolean(inlineRowActions.value.length || dropdownRowActions.value.length || showDirectDelete.value || showDropdownDelete.value),
)
const operationColumnWidth = computed(() => {
  if (props.config.operationWidth) return props.config.operationWidth
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

  ;(props.config.batchActions || [])
    .filter((action) => canRunAction(action)).forEach((action) => {
    actions.push(action)
    seen.add(action.key)
  })

  ;(props.config.rowActions || [])
    .filter((action) => isInlineStatusAction(action) && canRunAction(action))
    .forEach((action) => {
      if (seen.has(action.key)) return
      actions.push({
        ...action,
        label: action.label.startsWith('批量') ? action.label : `批量${action.label}`,
        confirm: undefined,
      })
      seen.add(action.key)
    })

  if (canDeleteRow.value && !seen.has('__delete')) {
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
const selectedIdentityScope = computed(() => {
  if (props.config.key !== 'accountIdentities') return ''
  try { return identitySelectionLabel(selectedRows.value) }
  catch { return `${selectedCount.value} 个登录身份，匹配范围需刷新后确认` }
})
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

function runtimeSyncFailureStorageKey(failure: RuntimeSyncFailure) {
  const userId = String(auth.user?.id || 'anonymous')
  return `aggregation-cloud:runtime-sync-failure:${userId}:${failure.key}`
}

function hasSeenRuntimeSyncFailure(failure: RuntimeSyncFailure) {
  const storageKey = runtimeSyncFailureStorageKey(failure)
  if (seenRuntimeSyncFailures.has(storageKey)) return true
  try {
    if (window.sessionStorage.getItem(storageKey)) {
      seenRuntimeSyncFailures.add(storageKey)
      return true
    }
  } catch {
    // 浏览器禁用会话存储时，仍使用当前页面内存去重。
  }
  return false
}

function markRuntimeSyncFailureSeen(failure: RuntimeSyncFailure) {
  const storageKey = runtimeSyncFailureStorageKey(failure)
  seenRuntimeSyncFailures.add(storageKey)
  try {
    window.sessionStorage.setItem(storageKey, '1')
  } catch {
    // 会话存储不可用不会影响弹窗和重试操作。
  }
}

function clearRuntimeSyncFailureSeen(failure: RuntimeSyncFailure) {
  const storageKey = runtimeSyncFailureStorageKey(failure)
  seenRuntimeSyncFailures.delete(storageKey)
  try {
    window.sessionStorage.removeItem(storageKey)
  } catch {
    // 会话存储不可用时仅清理内存标记。
  }
}

function runtimeSyncRetryMessage(data: AnyRecord) {
  if (data.retried_count === undefined) return '同步命令已重新排队'
  const retried = Number(data.retried_count || 0)
  const failed = Number(data.failed_count || 0)
  return failed
    ? `已重新提交 ${retried} 台设备，仍有 ${failed} 台未能提交`
    : `已重新提交 ${retried} 台设备`
}

async function presentRuntimeSyncFailure(records: AnyRecord[]) {
  if (!props.config.runtimeSyncFailureAlerts || runtimeSyncFailureDialogOpen) return
  const failure = collectRuntimeSyncFailures(props.config.key, records)
    .find((item) => !hasSeenRuntimeSyncFailure(item))
  if (!failure) return

  markRuntimeSyncFailureSeen(failure)
  runtimeSyncFailureDialogOpen = true
  try {
    if (!auth.can('devices.sync')) {
      try {
        await ElMessageBox.alert(failure.message, failure.title, {
          type: 'error',
          confirmButtonText: '关闭',
        })
      } catch {
        // 用户关闭提示即视为已读。
      }
      return
    }
    try {
      await ElMessageBox.confirm(failure.message, failure.title, {
        type: 'error',
        confirmButtonText: '重新同步',
        cancelButtonText: '关闭',
        closeOnClickModal: false,
        distinguishCancelAndClose: true,
      })
    } catch {
      return
    }

    try {
      const data = await http.post<AnyRecord>(failure.retryPath)
      ElNotification({
        type: Number(data.failed_count || 0) ? 'warning' : 'info',
        title: '重新同步已提交',
        message: runtimeSyncRetryMessage(data),
        duration: 7000,
      })
      // 重试接口已同步写入 queued；刷新时保留已读标记，避免旧失败瞬间再次弹出。
      await loadRows({ silent: true })
      clearRuntimeSyncFailureSeen(failure)
    } catch (err) {
      clearRuntimeSyncFailureSeen(failure)
      error.value = notifyError(err, '重新同步失败', '重新同步失败')
    }
  } finally {
    runtimeSyncFailureDialogOpen = false
  }
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

function openPublishedContentDetailById(contentId: string) {
  publishedContentDetailId.value = contentId
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
    saveDownload(blob, filename)
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

function isSwitchableStatusColumn(column: ColumnConfig, row: AnyRecord) {
  const config = defaultStatusSwitchConfig(column)
  const actions = [findInlineStatusAction(config.activeActionKey), findInlineStatusAction(config.inactiveActionKey)]
  return (column.type === 'statusSwitch' || (column.key === 'status' && hasInlineStatusSwitch.value))
    && actions.every((action) => !action || rowActionAllowed(action, row))
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
  ;(props.config.filters || []).forEach((filter) => {
    const value = filters[filter.key]
    if (filter.type === 'datetimeRange') {
      // 日期范围在前端保存为一个数组，请求时拆成后端可直接建立索引条件的起止参数。
      const range = Array.isArray(value) ? value.filter(Boolean) : []
      if (range[0]) params[filter.key] = new Date(String(range[0])).toISOString()
      if (range[1] && filter.endKey) params[filter.endKey] = new Date(String(range[1])).toISOString()
      return
    }
    const key = filter.key
    if (value !== '' && value !== undefined && value !== null) params[key] = value
  })
  return props.config.listParams?.(params) || params
}

async function loadRows(options?: { silent?: boolean } | number) {
  normalizeScopedFilters()
  const params = buildListParams()
  if (props.config.key === 'accountIdentities') {
    const platform = String(params.business_platform || '')
    if (appliedIdentityPlatform !== undefined && appliedIdentityPlatform !== platform) {
      clearSelection()
      rows.value = []
      total.value = 0
    }
    appliedIdentityPlatform = platform
  }
  const silent = typeof options === 'object' && Boolean(options?.silent)
  const requestId = ++listRequestId
  if (!silent) {
    visibleLoadingRequestId = requestId
    loading.value = true
    error.value = ''
  }
  try {
    const data = await http.get<PageResult<AnyRecord>>(props.config.listEndpoint || props.config.endpoint, params)
    if (requestId !== listRequestId) return
    rows.value = data.items
    total.value = data.total
    await restorePageSelection()
    void presentRuntimeSyncFailure(data.items)
  } catch (err) {
    if (!silent) error.value = notifyError(err, '加载失败', '加载失败')
  } finally {
    if (!silent && visibleLoadingRequestId === requestId) loading.value = false
    if (realtimeRefreshPending && !isRealtimeRefreshBlocked()) scheduleRealtimeRefresh()
  }
}

function shouldRefreshForRealtime(event: RealtimeEventPayload) {
  if (props.config.key === 'accounts' || props.config.key === 'accountIdentities') return event.topic === 'account'
  if (props.config.key === 'tasks') return event.topic === 'task'
  if (props.config.key === 'runtimes') return event.topic === 'runtime' || event.topic === 'task'
  if (props.config.key === 'slots') return event.topic === 'runtime' || event.topic === 'task'
  if (props.config.key === 'slotGroups') return event.topic === 'runtime'
  if (props.config.key === 'publishedContents') return event.topic === 'content_monitor'
  if (props.config.key === 'interactionSessions') return event.topic === 'task'
  return false
}

function realtimeData(event: RealtimeEventPayload) {
  return event.data && typeof event.data === 'object' ? event.data as AnyRecord : {}
}

function rowContainsValue(rowKeys: string[], value: unknown) {
  return rowsContainRealtimeValue(rows.value, rowKeys, value)
}

function taskTouchesVisibleRows(
  event: RealtimeEventPayload,
  rowKeys: string[],
  taskKeys: string[],
) {
  return realtimeTaskTouchesRows(rows.value, event, rowKeys, taskKeys)
}

function realtimeRefreshInterval() {
  if (props.config.key === 'slots' || props.config.key === 'runtimes') return 8000
  if (props.config.key === 'tasks' || props.config.key === 'interactionSessions') return 3000
  return 5000
}

function isRealtimeRefreshBlocked() {
  return Boolean(
    document.visibilityState !== 'visible'
    || !pageRootRef.value
    || pageRootRef.value.offsetParent === null
    || hasActiveUserOperation.value
    || loading.value
    || submitting.value,
  )
}

async function runRealtimeRefresh() {
  realtimeRefreshTimer = undefined
  if (isRealtimeRefreshBlocked() || realtimeRefreshRunning) {
    realtimeRefreshPending = true
    return
  }
  realtimeRefreshPending = false
  realtimeRefreshRunning = true
  lastRealtimeRefreshAt = Date.now()
  try {
    // SSE 刷新不展示整表 Loading，避免打断筛选、滚动和表单操作。
    await loadRows({ silent: true })
  } finally {
    realtimeRefreshRunning = false
    if (realtimeRefreshPending && !isRealtimeRefreshBlocked()) scheduleRealtimeRefresh()
  }
}

function scheduleRealtimeRefresh() {
  realtimeRefreshPending = true
  if (isRealtimeRefreshBlocked() || realtimeRefreshRunning || realtimeRefreshTimer) return
  const elapsed = Date.now() - lastRealtimeRefreshAt
  const delay = Math.max(600, realtimeRefreshInterval() - elapsed)
  realtimeRefreshTimer = window.setTimeout(runRealtimeRefresh, delay)
}

function scheduleRealtimeConsistencyRefresh(delay = 15_000) {
  const dueAt = Date.now() + delay
  if (realtimeConsistencyTimer && realtimeConsistencyDueAt <= dueAt) return
  if (realtimeConsistencyTimer) window.clearTimeout(realtimeConsistencyTimer)
  realtimeConsistencyDueAt = dueAt
  realtimeConsistencyTimer = window.setTimeout(() => {
    realtimeConsistencyTimer = undefined
    realtimeConsistencyDueAt = 0
    scheduleRealtimeRefresh()
  }, delay)
}

function flushPendingRealtimeRefresh() {
  if (realtimeRefreshPending && !isRealtimeRefreshBlocked()) scheduleRealtimeRefresh()
}

function handleRealtimeEvent(event: Event) {
  const payload = (event as CustomEvent<RealtimeEventPayload>).detail
  if (!payload || !shouldRefreshForRealtime(payload)) return

  if (props.config.key === 'tasks' && payload.topic === 'task') {
    const patched = patchTaskSummaryRows(rows.value, payload)
    if (patched.result === 'patched') {
      rows.value = patched.rows
      return
    }
    if (patched.result === 'stale') return
    if (patched.result === 'child') {
      if (taskTouchesVisibleRows(payload, ['id'], ['parent_task_run_id'])) {
        scheduleRealtimeConsistencyRefresh(10_000)
      }
      return
    }
    scheduleRealtimeConsistencyRefresh()
    return
  }

  if (props.config.key === 'runtimes') {
    if (payload.topic === 'runtime') {
      const patched = patchRuntimeSummaryRows(rows.value, payload)
      if (patched.result === 'patched') rows.value = patched.rows
      else if (patched.result === 'missing') scheduleRealtimeConsistencyRefresh()
      return
    }
    if (taskTouchesVisibleRows(payload, ['id'], ['runtime_instance_id'])) {
      scheduleRealtimeRefresh()
    }
    return
  }

  if (props.config.key === 'slots') {
    if (payload.topic === 'task') {
      if (taskTouchesVisibleRows(payload, ['id'], ['slot_id'])) scheduleRealtimeRefresh()
      return
    }
    const runtime = realtimeRuntimeSummary(payload)
    if (runtime && rowContainsValue(['runtime_instance_id'], runtime.id)) {
      scheduleRealtimeRefresh()
    } else if (payload.type.includes('slots') || payload.type.includes('global_inventory')) {
      scheduleRealtimeConsistencyRefresh(30_000)
    }
    return
  }

  if (props.config.key === 'accountIdentities') {
    const visible = rows.value.some(row => Array.isArray(row.platform_summaries)
      && row.platform_summaries.some((account: AnyRecord) => String(account.account_id) === String(payload.resource_id)))
    if (visible) scheduleRealtimeRefresh()
    else scheduleRealtimeConsistencyRefresh(30_000)
    return
  }

  if (props.config.key === 'accounts') {
    if (rowContainsValue(['id'], payload.resource_id)) scheduleRealtimeRefresh()
    return
  }

  if (props.config.key === 'interactionSessions') {
    if (taskTouchesVisibleRows(payload, ['task_run_id'], ['id', 'parent_task_run_id'])) {
      scheduleRealtimeRefresh()
    }
    return
  }

  if (props.config.key === 'publishedContents') {
    const data = realtimeData(payload)
    if (
      rowContainsValue(['id'], payload.resource_id)
      || rowContainsValue(['author_account_id'], data.account_id)
    ) {
      scheduleRealtimeRefresh()
    } else {
      scheduleRealtimeConsistencyRefresh(30_000)
    }
    return
  }

  scheduleRealtimeRefresh()
}

function handleDocumentVisibilityChange() {
  if (document.visibilityState === 'visible') flushPendingRealtimeRefresh()
}

function handleSizeChange(size: number) {
  pageSize.value = size
  page.value = 1
  loadRows()
}

function applyFilters() {
  clearTableSelection()
  page.value = 1
  loadRows()
}

function resetFilters() {
  Object.keys(filters).forEach((key) => {
    filters[key] = ''
  })
  applyFilters()
}

function applySystemDefaults(state: AnyRecord, defaults: SystemDefaults) {
  const scalarDefaults: Record<string, string | null> = {
    business_platform: defaults.default_business_platform,
    runtime_platform: defaults.default_runtime_platform,
    provider: defaults.default_provider,
    ai_provider: defaults.default_ai_provider,
  }
  Object.entries(scalarDefaults).forEach(([key, value]) => {
    if (Object.prototype.hasOwnProperty.call(state, key)) state[key] = value
  })

  const listDefaults: Record<string, string[]> = {
    supported_business_platforms: defaults.default_business_platform ? [defaults.default_business_platform] : [],
    supported_runtime_platforms: defaults.default_runtime_platform ? [defaults.default_runtime_platform] : [],
    supported_providers: defaults.default_provider ? [defaults.default_provider] : [],
  }
  Object.entries(listDefaults).forEach(([key, value]) => {
    if (Object.prototype.hasOwnProperty.call(state, key)) state[key] = value
  })
  return state
}

async function openCreate() {
  if (!canCreateRow.value) return
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

const accountTagOptionsVersion = ref(0)
const deviceGroupOptionsVersion = ref(0)
function refreshDeviceGroups() {
  deviceGroupOptionsVersion.value += 1
  void loadRows({ silent: true })
}
function refreshAccountTags() {
  accountTagOptionsVersion.value += 1
  void loadRows({ silent: true })
}
function filterByAccountTag(id: string) {
  if (!props.config.filters?.some(field => field.key === 'tag_id')) return
  filters.tag_id = id
  accountTagOptionsVersion.value += 1
  applyFilters()
}
defineExpose({
  refreshDeviceGroups,
  isBusy: () => inlineBusy.value,
  hasUnsavedChanges: () => Boolean(modal.type),
  refreshAccountTags,
  filterByAccountTag,
  loadRows,
  openCreate,
  runHeaderAction,
})

async function openEdit(record: AnyRecord) {
  if (!editAllowed(record)) return
  loading.value = true
  error.value = ''
  try {
    // 部分资源的编辑表单需要额外子资源，例如脚本参数，需要先加载详情再打开弹窗。
    const editRecord = props.config.loadEditRecord ? await props.config.loadEditRecord(record) : record
    if (!editAllowed(editRecord)) return
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
  window.setTimeout(flushPendingRealtimeRefresh, 0)
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
  if (modal.type === 'edit' && (!modal.record || !editAllowed(modal.record))) {
    ElMessage.error('当前账号没有编辑此记录的权限')
    return
  }
  if (modal.type === 'create' && !canCreateRow.value) {
    ElMessage.error('当前账号没有执行此操作的权限')
    return
  }
  submitting.value = true
  error.value = ''
  let successMessage = '保存成功'
  let successTitle = '操作成功'
  let useSuccessNotification = false
  let notificationType: 'success' | 'warning' | 'error' | 'info' = 'success'
  let keepCreateOpen = false
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
      notificationType = props.config.createNotificationType?.(data, payload) || 'success'
      keepCreateOpen = props.config.keepCreateOpenWhen?.(data, payload) || false
    }
    if (modal.type === 'edit' && modal.record) {
      const payload = buildPayload(props.config.updateFields || [], formState.value, 'update')
      const body = props.config.updateBody ? props.config.updateBody(payload, modal.record) : payload
      const data = await http.put<AnyRecord>(`${props.config.endpoint}/${rowId(modal.record)}`, body)
      if (props.config.afterUpdate) await props.config.afterUpdate(data, payload, modal.record)
      if (props.config.updateSuccessMessage) {
        successMessage = props.config.updateSuccessMessage(data, payload)
        successTitle = props.config.updateSuccessTitle || successTitle
        notificationType = props.config.updateNotificationType?.(data, payload) || 'success'
        useSuccessNotification = true
      }
    }
    if (!keepCreateOpen) closeModal()
    if (useSuccessNotification) {
      ElNotification({
        type: notificationType,
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

async function handleMediaAssetBatchCompleted(summary: { total: number; succeeded: number; failed: number }) {
  ElNotification({
    type: summary.failed ? 'warning' : 'success',
    title: summary.failed ? '批量上传已完成，部分文件失败' : '批量上传完成',
    message: `本次处理 ${summary.total} 个文件，成功 ${summary.succeeded} 个，失败 ${summary.failed} 个。`,
    duration: 7000,
  })
  await loadRows()
}

async function deleteRow(record: AnyRecord) {
  if (!deleteAllowed(record)) {
    ElMessage.warning(deleteBlockedMessage(record))
    return
  }
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
      successTitle: props.config.deleteSuccessTitle,
      successMessage: props.config.deleteSuccessMessage
        ? (data) => props.config.deleteSuccessMessage!(data, record)
        : undefined,
      successNotificationType: props.config.deleteNotificationType
        ? (data) => props.config.deleteNotificationType!(data, record)
        : undefined,
    },
    record,
  )
}

function clearSelection() {
  clearTableSelection()
  window.setTimeout(flushPendingRealtimeRefresh, 0)
}

async function requestAction(action: RowActionConfig, record: AnyRecord, payload: AnyRecord = {}) {
  if (!rowActionAllowed(action, record)) throw new Error('当前账号没有操作此记录的权限')
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
  const selectedValues = (key: string) => [
    ...new Set(selectedRows.value.map((row) => String(row[key] || '')).filter(Boolean)),
  ]
  const businessPlatforms = selectedValues('business_platform')
  const runtimePlatforms = selectedValues('runtime_platform')
  const providers = selectedValues('provider')
  modal.record = {
    selectedRows: selectedRows.value,
    business_platform: businessPlatforms.length === 1 ? businessPlatforms[0] : undefined,
    runtime_platform: runtimePlatforms.length === 1 ? runtimePlatforms[0] : undefined,
    provider: providers.length === 1 ? providers[0] : undefined,
  }
  const fields = action.batchFields?.(selectedRows.value) || action.fields || []
  modal.action = { ...action, fields }
  formState.value = buildFormState(fields)
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
  if (!selectedRows.value.length || submitting.value) return false
  if (!canRunAction(action) || (action.visible && selectedRows.value.some((record) => !action.visible!(record)))) {
    ElMessage.warning('所选记录包含无权操作的数据，请调整选择后重试')
    return false
  }
  if (action.selectionLimit && selectedRows.value.length > action.selectionLimit) {
    ElMessage.warning(`每次最多选择 ${action.selectionLimit} 条，请减少选择后重试`)
    return false
  }
  if (action.clientAction === 'download' && action.batchPath) {
    submitting.value = true
    try {
      const selected = [...selectedRows.value]
      const body = action.batchBody?.(payload, selected)
      const message = typeof action.confirm === 'function'
        ? action.confirm({ selectedRows: selected, selected_count: selected.length }) : action.confirm
      if (!(await confirmAction(message, 'warning', '确认导出'))) return false
      const file = await http.postFile(
        action.batchPath(selected, payload),
        body,
      )
      saveDownload(file.blob, file.filename)
      ElMessage.success('账号已导出')
      if (action.refresh !== false) await loadRows()
      return true
    } catch (err) {
      notifyError(err, '导出失败', '账号导出失败')
      return false
    } finally {
      submitting.value = false
    }
    return
  }
  if (action.key === '__delete') {
    const blockedRecord = selectedRows.value.find((record) => !deleteAllowed(record))
    if (blockedRecord) {
      ElMessage.warning(deleteBlockedMessage(blockedRecord))
      return
    }
  }
  const rowsToHandle = [...selectedRows.value]
  const actionName = action.label.replace(/^批量/, '')
  const isDanger = action.variant === 'danger' || action.method === 'DELETE'
  const actionContext = {
    ...payload,
    selectedRows: rowsToHandle,
    selected_count: rowsToHandle.length,
  }
  let configuredMessage: string | undefined
  try {
    configuredMessage = typeof action.confirm === 'function'
      ? action.confirm(actionContext)
      : action.confirm
  } catch (err) {
    notifyError(err, '批量操作失败', '请刷新后重新选择账号')
    return false
  }
  const message =
    configuredMessage
    || (action.key === '__delete'
      ? `确认删除已选 ${selectedRows.value.length} 条数据？此操作不可恢复。`
      : `确认对已选 ${selectedRows.value.length} 条数据执行${actionName}？`)
  if (!(await confirmAction(message, isDanger ? 'error' : 'warning', isDanger ? '确认批量删除' : '确认批量操作'))) return

  submitting.value = true
  error.value = ''
  const failures: string[] = []
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
      const message = action.successMessage && batchData
        ? action.successMessage(batchData as AnyRecord, payload)
        : `已处理 ${rowsToHandle.length} 条`
      if (action.successMessage && batchData) {
        ElNotification({
          type: action.successNotificationType?.(batchData as AnyRecord, payload) || 'success',
          title: action.successTitle || '批量操作完成',
          message,
          duration: 7000,
        })
      } else {
        ElMessage.success(message)
      }
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
  if (action.key === 'export-accounts' && ['accounts', 'accountIdentities'].includes(props.config.key)) {
    if (!auth.can('accounts.export') || !selectedRows.value.length) return
    if (selectedRows.value.length > 1000) {
      ElMessage.warning('每次最多选择 1000 项，请减少选择后重试')
      return
    }
    exportSelection.value = {
      source: props.config.key === 'accountIdentities' ? 'identities' : 'accounts',
      records: [...selectedRows.value],
    }
    return
  }
  if (action.fields?.length || action.batchFields) {
    openBatchAction(action)
    return
  }
  await executeBatchAction(action)
}

async function requestCloseForm() {
  if (!props.inlineForms) { closeModal(); return }
  if (inlineBusy.value) return
  try { await ElMessageBox.confirm('确认返回分组列表？未保存的表单或尚未添加的设备选择将丢失。', '返回分组列表', { confirmButtonText: '返回', cancelButtonText: '继续编辑' }) }
  catch { return }
  closeModal()
}

function openExportRecords(recordId?: string) {
  exportSelection.value = null
  emit('exportRecords', recordId)
}

function onAccountsExported() {
  clearSelection()
  void loadRows()
}

function openAction(action: RowActionConfig, record: AnyRecord) {
  modal.type = 'action'
  modal.record = record
  modal.action = action
  // 行级操作常需要复用当前行的默认值，例如基于模板创建任务时带出模板参数。
  formState.value = buildFormState(action.fields || [], record)
}

async function runAction(action: RowActionConfig, record: AnyRecord) {
  if (!rowActionAllowed(action, record)) return
  if (props.config.key === 'taskTemplates' && action.key === 'detail') {
    templateDetailId.value = rowId(record)
    return
  }
  if (props.config.key === 'accountIdentities' && action.key === 'edit-credentials') {
    if (submitting.value || identityCredentialsId.value || !auth.can('accounts.edit') || record.can_edit_credentials !== true) return
    identityCredentialsId.value = rowId(record)
    return
  }
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
  try {
    const payload = buildPayload(modal.action.fields || [], formState.value, 'action')
    const succeeded = await executeBatchAction(modal.action, payload)
    if (succeeded !== false) closeModal()
  } catch (err) {
    notifyError(err, '提交失败', '提交失败')
  }
}

async function executeRequest(action: RowActionConfig, record: AnyRecord, payload: AnyRecord = {}) {
  let message = typeof action.confirm === 'function' ? action.confirm(record) : action.confirm
  const isDanger = action.variant === 'danger' || action.method === 'DELETE'
  if (action.previewPath && action.confirmFromPreview) {
    try {
      const preview = await http.get<AnyRecord>(action.previewPath(record))
      message = action.confirmFromPreview(preview, record)
    } catch (err) {
      error.value = notifyError(err, '预览失败', '无法加载操作影响范围')
      return
    }
  }
  if (!(await confirmAction(message, isDanger ? 'error' : 'warning'))) return

  submitting.value = true
  error.value = ''
  if (action.showResult) openResultDialog(action, null, true)
  try {
    const data = await requestAction(action, record, payload)
    if (action.method === 'GET' || action.showResult) openResultDialog(action, data, false)

    if (action.method !== 'GET' && !action.showResult) {
      if (action.successMessage) {
        ElNotification({
          type: action.successNotificationType?.(data as AnyRecord, payload) || 'success',
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
  const action = visibleDropdownRowActions(row).find((item) => item.key === command)
  if (action) runAction(action, row)
}

function initFilters() {
  templateDetailId.value = null
  identityCredentialsId.value = null
  clearTableSelection()
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
    if (realtimeRefreshTimer) window.clearTimeout(realtimeRefreshTimer)
    if (realtimeConsistencyTimer) window.clearTimeout(realtimeConsistencyTimer)
    realtimeRefreshTimer = undefined
    realtimeConsistencyTimer = undefined
    realtimeConsistencyDueAt = 0
    realtimeRefreshPending = false
    lastRealtimeRefreshAt = 0
    initFilters()
    loadRows()
  },
)

watch(hasActiveUserOperation, (active) => {
  if (!active) window.setTimeout(flushPendingRealtimeRefresh, 0)
})

onMounted(() => {
  initFilters()
  loadRows()
  window.addEventListener(REALTIME_EVENT_NAME, handleRealtimeEvent)
  document.addEventListener('visibilitychange', handleDocumentVisibilityChange)
  if (pageRootRef.value && typeof IntersectionObserver !== 'undefined') {
    // 二级栏目重新显示时只追一次最新数据，隐藏期间不发送列表请求。
    pageVisibilityObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) flushPendingRealtimeRefresh()
    })
    pageVisibilityObserver.observe(pageRootRef.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener(REALTIME_EVENT_NAME, handleRealtimeEvent)
  document.removeEventListener('visibilitychange', handleDocumentVisibilityChange)
  pageVisibilityObserver?.disconnect()
  if (realtimeRefreshTimer) window.clearTimeout(realtimeRefreshTimer)
  if (realtimeConsistencyTimer) window.clearTimeout(realtimeConsistencyTimer)
})
</script>

<template>
  <AccountExportPreflightDialog v-if="exportSelection" :source="exportSelection.source" :records="exportSelection.records"
    @close="exportSelection = null" @changed="onAccountsExported" @records="openExportRecords" />
  <section ref="pageRootRef" class="resource-page space-y-4" :class="{ 'resource-page--embedded': props.embedded }">
    <div v-show="!inlineForms || !modal.type" class="space-y-4">
    <div
      v-if="!props.hideHeaderActions"
      class="resource-page__header flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
    >
      <div>
        <h1 v-if="!props.embedded" class="text-xl font-semibold text-ink">{{ config.title }}</h1>
      </div>
      <el-space wrap>
        <el-tooltip content="刷新" placement="bottom">
          <el-button :icon="RefreshCw" circle :loading="loading" @click="loadRows()" />
        </el-tooltip>
        <el-button
          v-if="canCreateRow"
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
      <el-form inline label-position="right" label-suffix=":" class="compact-filter-form">
        <div class="filter-grid">
          <el-form-item
            v-for="filter in config.filters"
            :key="filter.key"
            :label="filter.label"
            :class="{ 'filter-grid__item--wide': filter.type === 'datetimeRange' }"
          >
              <RemoteSelect
                v-if="filter.type === 'remoteSelect' && filter.remote"
                :key="filter.key === 'tag_id' ? accountTagOptionsVersion : filter.key === 'group_id' ? deviceGroupOptionsVersion : filter.key"
                :model-value="filters[filter.key]"
                :config="filter.remote"
                :context="filters"
                :placeholder="filter.placeholder || '全部'"
                compact
                @update:model-value="filters[filter.key] = $event; applyFilters()"
              />
              <el-select
                v-else-if="filter.type === 'select'"
                :model-value="String(filters[filter.key] ?? '')"
                clearable
                filterable
                class="w-full"
                placeholder="全部"
                @update:model-value="filters[filter.key] = $event; clearTableSelection()"
                @change="applyFilters"
              >
                <el-option
                  v-for="option in scopedFieldOptions(filter)"
                  :key="String(option.value)"
                  :label="option.label"
                  :value="String(option.value)"
                />
              </el-select>
              <el-date-picker
                v-else-if="filter.type === 'datetimeRange'"
                :model-value="Array.isArray(filters[filter.key]) ? filters[filter.key] : []"
                class="w-full"
                type="datetimerange"
                format="YYYY-MM-DD HH:mm:ss"
                value-format="YYYY-MM-DDTHH:mm:ss"
                range-separator="至"
                start-placeholder="开始时间"
                end-placeholder="结束时间"
                clearable
                @update:model-value="filters[filter.key] = $event || []; clearTableSelection()"
                @change="applyFilters"
              />
              <el-input
                v-else
                :model-value="String(filters[filter.key] ?? '')"
                clearable
                :placeholder="filter.placeholder"
                @update:model-value="filters[filter.key] = $event; clearTableSelection()"
                @keydown.enter="applyFilters"
              />
          </el-form-item>
        </div>
        <div class="filter-actions">
          <el-button :icon="RotateCcw" :disabled="!hasActiveFilters || loading" @click="resetFilters">清空</el-button>
          <el-button type="primary" :icon="Search" :loading="loading" @click="applyFilters">查询</el-button>
        </div>
      </el-form>
    </el-card>

    <div v-if="batchActions.length && hasSelectedRows" class="batch-toolbar">
      <div class="batch-toolbar__summary">
        <ListChecks class="h-4 w-4 text-slate-500" />
        <span>已选择</span>
        <strong v-if="selectedIdentityScope">{{ selectedIdentityScope }}</strong>
        <template v-else><strong>{{ selectedCount }}</strong><span>条数据</span></template>
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
        :table-layout="config.key === 'accountIdentities' ? 'fixed' : 'auto'"
        @selection-change="handleSelectionChange"
      >
        <el-table-column v-if="batchActions.length" type="selection" width="48" reserve-selection />

        <el-table-column v-if="config.expandRow === 'publishedContentTask'" type="expand" width="48">
          <template #default="{ row }">
            <PublishedContentTaskItems
              :task-id="String(row.id)"
              :can-delete="canResource('delete')"
              @open-detail="openPublishedContentDetailById"
              @changed="loadRows({ silent: true })"
            />
          </template>
        </el-table-column>

        <el-table-column v-if="config.expandRow === 'accountIdentity'" type="expand" width="48">
          <template #default="{ row }">
            <AccountIdentityPlatformDetails
              :identity-id="String(row.id)"
                :business-platform="row.filtered_business_platform || undefined"
                :matched-account-ids="row.matched_account_ids || []"
                :can-split="row.account_count > 1 && row.can_edit_credentials === true"
              @changed="loadRows({ silent: true })"
            />
          </template>
        </el-table-column>

        <el-table-column
          v-for="column in visibleColumns"
          :key="column.key"
          :prop="column.key"
          :label="column.label"
          :min-width="column.minWidth || 150"
          :width="column.width"
          :align="column.align || 'left'"
          :header-align="column.align || 'left'"
          :show-overflow-tooltip="!['accountCredentials', 'loginIdentity'].includes(column.type || '')"
        >
          <template #default="{ row }">
            <AccountTableCell
              v-if="column.type && ['accountIdentity', 'accountTags', 'accountDeviceGroup', 'accountCredentials', 'accountPlatform', 'accountEnvironment', 'accountBackup'].includes(column.type)"
              :kind="column.type as 'accountIdentity' | 'accountTags' | 'accountDeviceGroup' | 'accountCredentials' | 'accountPlatform' | 'accountEnvironment' | 'accountBackup'"
              :row="row"
              :column="column"
              :shared-credentials="config.key === 'accountIdentities'"
            />
            <DeviceTableCell
              v-else-if="column.type && ['deviceIdentity', 'deviceGroup', 'devicePlatform', 'deviceState', 'deviceAccount', 'deviceProxy', 'deviceActivity'].includes(column.type)"
              :kind="column.type as 'deviceIdentity' | 'deviceGroup' | 'devicePlatform' | 'deviceState' | 'deviceAccount' | 'deviceProxy' | 'deviceActivity'"
              :row="row"
              :column="column"
            />
            <ContentTableCell
              v-else-if="column.type && ['contentIdentity', 'contentPools', 'contentPlatform', 'contentType', 'contentTimeline'].includes(column.type)"
              :kind="column.type as 'contentIdentity' | 'contentPools' | 'contentPlatform' | 'contentType' | 'contentTimeline'"
              :row="row"
              :column="column"
            />
            <PublishedContentTableCell
              v-else-if="column.type && ['publishedContentIdentity', 'publishedContentPublisher', 'publishedContentLink', 'publishedContentMetrics', 'publishedContentTimeline', 'publishedTaskIdentity', 'publishedTaskResult', 'publishedTaskOutput'].includes(column.type)"
              :kind="column.type as 'publishedContentIdentity' | 'publishedContentPublisher' | 'publishedContentLink' | 'publishedContentMetrics' | 'publishedContentTimeline' | 'publishedTaskIdentity' | 'publishedTaskResult' | 'publishedTaskOutput'"
              :row="row"
            />
            <InteractionSessionTableCell
              v-else-if="column.type === 'interactionTargetContent'"
              :row="row"
            />
            <InteractionSessionProgressCell
              v-else-if="column.type === 'interactionProgress'"
              :row="row"
            />
            <MediaAssetTableCell
              v-else-if="column.type && ['mediaAssetIdentity', 'mediaAssetPreview', 'mediaAssetGroups', 'mediaAssetPlatform', 'mediaAssetType', 'mediaAssetSpec', 'mediaAssetTimeline'].includes(column.type)"
              :kind="column.type as 'mediaAssetIdentity' | 'mediaAssetPreview' | 'mediaAssetGroups' | 'mediaAssetPlatform' | 'mediaAssetType' | 'mediaAssetSpec' | 'mediaAssetTimeline'"
              :row="row"
              :column="column"
              :preview-url="getAssetUrl(row, 'source_url')"
              @preview="openAssetViewer(row)"
            />
            <ProxyTableCell
              v-else-if="column.type && ['proxyIdentity', 'proxyGroup', 'proxyEndpoint', 'proxyProfile'].includes(column.type)"
              :kind="column.type as 'proxyIdentity' | 'proxyGroup' | 'proxyEndpoint' | 'proxyProfile'"
              :row="row"
              :column="column"
            />
            <TaskTableCell
              v-else-if="column.type && ['taskIdentity', 'taskScript', 'taskOperator', 'taskPlatform', 'taskResult', 'taskTimeline'].includes(column.type)"
              :kind="column.type as 'taskIdentity' | 'taskScript' | 'taskOperator' | 'taskPlatform' | 'taskResult' | 'taskTimeline'"
              :row="row"
              :column="column"
            />
            <AccountIdentityTableCell
              v-else-if="column.type && ['loginIdentity', 'identityTags', 'identityPlatforms', 'identitySessions', 'identityCandidate'].includes(column.type)"
              :kind="column.type as 'loginIdentity' | 'identityTags' | 'identityPlatforms' | 'identitySessions' | 'identityCandidate'"
              :row="row"
            />
            <ScriptTableCell
              v-else-if="column.type && ['scriptIdentity', 'scriptScope', 'scriptTimeout', 'scriptTimeline'].includes(column.type)"
              :kind="column.type as 'scriptIdentity' | 'scriptScope' | 'scriptTimeout' | 'scriptTimeline'"
              :row="row"
              :column="column"
            />
            <TemplateTableCell
              v-else-if="column.type && ['templateIdentity', 'templateConfig', 'templateTimeline'].includes(column.type)"
              :kind="column.type as 'templateIdentity' | 'templateConfig' | 'templateTimeline'"
              :row="row"
              :column="column"
            />
            <div v-else-if="isSwitchableStatusColumn(column, row)" class="flex items-center gap-2">
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
            <ContentPreview v-else-if="column.type === 'contentTextPreview'" :record="row" mode="compact" section="text" />
            <ContentPreview v-else-if="column.type === 'contentMediaPreview'" :record="row" mode="compact" section="media" />
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
              <el-tooltip v-if="editAllowed(row)" content="编辑" placement="top">
                <el-button text circle :icon="Edit3" aria-label="编辑" :disabled="submitting" @click="openEdit(row)" />
              </el-tooltip>
              <el-tooltip
                v-for="action in visibleInlineRowActions(row)"
                :key="action.key"
                :content="action.label"
                placement="top"
              >
                <el-button
                  text
                  circle
                  :type="action.variant === 'danger' ? 'danger' : action.variant === 'success' ? 'success' : undefined"
                  :icon="actionIcon(action)"
                  :aria-label="action.label"
                  :disabled="submitting"
                  @click="runAction(action, row)"
                />
              </el-tooltip>
              <el-tooltip
                v-if="showDirectDelete && deleteAllowed(row)"
                :content="config.deleteLabel"
                placement="top"
              >
                <el-button text circle type="danger" :icon="Trash2" :aria-label="config.deleteLabel" :disabled="submitting" @click="deleteRow(row)" />
              </el-tooltip>
              <el-dropdown
                v-if="visibleDropdownRowActions(row).length || (showDropdownDelete && deleteAllowed(row))"
                trigger="click"
                :disabled="submitting"
                @command="(command) => handleDropdown(String(command), row)"
              >
                <el-button text circle :icon="MoreHorizontal" />
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item
                      v-for="action in visibleDropdownRowActions(row)"
                      :key="action.key"
                      :command="action.key"
                      :class="action.variant === 'danger' ? 'text-red-600' : ''"
                    >
                      <component :is="actionIcon(action)" class="mr-2 h-4 w-4" />
                      {{ action.label }}
                    </el-dropdown-item>
                    <el-dropdown-item
                      v-if="showDropdownDelete && deleteAllowed(row)"
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

    </div>
    <component
      :is="inlineForms ? InlineFormPanel : ElDialog"
      v-if="!inlineForms || modal.type"
      :model-value="Boolean(modal.type)"
      :title="modalTitle"
      :width="modalWidth"
      destroy-on-close
      append-to-body
      :close-on-click-modal="!submitting"
      :close-on-press-escape="!submitting"
      :show-close="!inlineBusy"
      @close="requestCloseForm"
    >
      <BusinessDispatchForm
        v-if="dispatchFormMode"
        v-model="formState"
        :mode="dispatchFormMode"
        :fields="modalFields"
        :context="modal.record || undefined"
      />
      <MediaAssetBatchUploader
        v-else-if="isMediaAssetBatchCreateModal"
        @uploading-change="submitting = $event"
        @completed="handleMediaAssetBatchCompleted"
      />
      <div
        v-else-if="modal.type === 'edit' && config.accountTagMembers && modal.record"
        class="account-group-edit-layout"
      >
        <div class="account-group-edit-layout__base">
          <div class="edit-panel-title">基础信息</div>
          <DynamicForm v-model="formState" :fields="modalFields" :context="modal.record || undefined" />
        </div>
        <AccountTagMemberEditor
          class="account-group-edit-layout__members"
          :tag="modal.record"
          @changed="loadRows"
        />
      </div>
      <el-tabs
        v-else-if="modal.type === 'edit' && (config.slotGroupMembers || config.proxyGroupMembers || config.contentGroupMembers || config.mediaAssetGroupMembers) && modal.record"
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
            ref="slotGroupMemberRef"
            :embedded="inlineForms"
            :group="modal.record"
            @changed="loadRows"
          />
          <ProxyGroupMemberEditor
            v-else-if="config.proxyGroupMembers"
            :group="modal.record"
            @changed="loadRows"
          />
          <ContentGroupMemberEditor
            v-else-if="config.contentGroupMembers"
            :group="modal.record"
            @changed="loadRows"
          />
          <MediaAssetGroupMemberEditor
            v-else
            :group="modal.record"
            @changed="loadRows"
          />
        </el-tab-pane>
      </el-tabs>
      <div v-else-if="modal.type === 'edit' && config.editPreview === 'content'" class="content-edit-layout">
        <DynamicForm v-model="formState" :fields="modalFields" :context="modal.record || undefined" />
        <ContentPreview :record="formState" mode="full" />
      </div>
      <DynamicForm v-else v-model="formState" :fields="modalFields" :context="modal.record || undefined" />
      <template #footer>
        <el-button :disabled="inlineBusy" @click="requestCloseForm">{{ isMediaAssetBatchCreateModal ? '关闭' : '取消' }}</el-button>
        <el-button
          v-if="showModalSaveButton"
          type="primary"
          :loading="submitting"
          :disabled="inlineBusy && !submitting"
          @click="modal.type === 'batch' ? submitBatchAction() : modal.type === 'action' ? submitAction() : submitEntity()"
        >
          {{ modalSubmitLabel }}
        </el-button>
      </template>
    </component>

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

    <AccountIdentityCredentialsDialog
      v-if="config.key === 'accountIdentities' && identityCredentialsId"
      :identity-id="identityCredentialsId"
      @close="identityCredentialsId = null"
      @changed="loadRows()"
    />
    <TaskDetailDrawer v-if="config.key === 'tasks'" v-model="taskDetailVisible" :task-id="taskDetailId" />
    <TaskTemplateDetailDialog
      v-if="config.key === 'taskTemplates' && templateDetailId"
      :template-id="templateDetailId"
      @close="templateDetailId = null"
    />
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
  justify-content: flex-end;
  text-align: right;
  color: #52606d;
  font-size: 12px;
  font-weight: 600;
}

.filter-grid :deep(.el-select),
.filter-grid :deep(.el-input),
.filter-grid :deep(.el-date-editor) {
  width: 100%;
}

.filter-grid :deep(.filter-grid__item--wide) {
  grid-column: span 2;
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

.resource-table--proxies :deep(th.el-table__cell),
.resource-table--tasks :deep(th.el-table__cell),
.resource-table--scripts :deep(th.el-table__cell),
.resource-table--taskTemplates :deep(th.el-table__cell) {
  color: #526477;
  background: #f3f7fa;
  font-size: 12px;
  font-weight: 700;
}

.resource-table--proxies :deep(td.el-table__cell),
.resource-table--tasks :deep(td.el-table__cell),
.resource-table--scripts :deep(td.el-table__cell),
.resource-table--taskTemplates :deep(td.el-table__cell) {
  padding: 11px 0;
}

.resource-table--tasks :deep(.cell) {
  padding-right: 10px;
  padding-left: 10px;
}

.resource-table--proxies :deep(.el-table__row:hover > td.el-table__cell),
.resource-table--tasks :deep(.el-table__row:hover > td.el-table__cell),
.resource-table--scripts :deep(.el-table__row:hover > td.el-table__cell),
.resource-table--taskTemplates :deep(.el-table__row:hover > td.el-table__cell) {
  background: #f4f9fd;
}

.resource-table--proxies :deep(.el-button.is-circle),
.resource-table--tasks :deep(.el-button.is-circle),
.resource-table--scripts :deep(.el-button.is-circle),
.resource-table--taskTemplates :deep(.el-button.is-circle) {
  border: 1px solid transparent;
  color: #52677a;
  background: #f4f7fa;
}

.resource-table--proxies :deep(.el-button.is-circle:hover),
.resource-table--tasks :deep(.el-button.is-circle:hover),
.resource-table--scripts :deep(.el-button.is-circle:hover),
.resource-table--taskTemplates :deep(.el-button.is-circle:hover) {
  border-color: #bfd5e6;
  color: #1f668f;
  background: #edf7fd;
}

.resource-table--proxies :deep(.el-button--danger.is-circle),
.resource-table--tasks :deep(.el-button--danger.is-circle),
.resource-table--scripts :deep(.el-button--danger.is-circle),
.resource-table--taskTemplates :deep(.el-button--danger.is-circle) {
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

.content-edit-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(300px, 0.8fr);
  gap: 20px;
  align-items: start;
}

.content-edit-layout > :last-child {
  position: sticky;
  top: 0;
  max-height: 62vh;
  padding: 16px;
  overflow: auto;
  border: 1px solid #dce6ef;
  border-radius: 8px;
  background: #f8fbfd;
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
  .content-edit-layout {
    grid-template-columns: 1fr;
  }

  .content-edit-layout > :last-child {
    position: static;
    max-height: none;
  }

  .filter-grid {
    grid-template-columns: 1fr;
  }

  .filter-grid :deep(.filter-grid__item--wide) {
    grid-column: span 1;
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
