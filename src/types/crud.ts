import type { Component } from 'vue'

import type { AnyRecord } from './api'

export type FieldType =
  | 'text'
  | 'textarea'
  | 'textImport'
  | 'file'
  | 'number'
  | 'numberRange'
  | 'select'
  | 'segmented'
  | 'json'
  | 'tags'
  | 'boolean'
  | 'datetime'
  | 'datetimeRange'
  | 'timeRange'
  | 'scriptParams'
  | 'templateParams'
  | 'accountTree'
  | 'slotTree'
  | 'templateSelect'
  | 'contentPreviewPicker'
  | 'mediaPreviewPicker'
  | 'publishedCommentList'
  | 'remoteSelect'

export type ColumnType =
  | 'text'
  | 'accountIdentity'
  | 'accountTags'
  | 'accountDeviceGroup'
  | 'accountCredentials'
  | 'accountPlatform'
  | 'accountEnvironment'
  | 'accountBackup'
  | 'proxyIdentity'
  | 'proxyGroup'
  | 'proxyEndpoint'
  | 'proxyProfile'
  | 'deviceIdentity'
  | 'deviceGroup'
  | 'devicePlatform'
  | 'deviceState'
  | 'deviceAccount'
  | 'deviceProxy'
  | 'deviceActivity'
  | 'taskIdentity'
  | 'taskTemplate'
  | 'taskOperator'
  | 'taskPlatform'
  | 'taskResult'
  | 'taskTimeline'
  | 'scriptIdentity'
  | 'scriptScope'
  | 'scriptTimeout'
  | 'scriptTimeline'
  | 'templateIdentity'
  | 'templateConfig'
  | 'templateTimeline'
  | 'status'
  | 'statusSwitch'
  | 'datetime'
  | 'json'
  | 'list'
  | 'tag'
  | 'id'
  | 'boolean'
  | 'mediaAssetIdentity'
  | 'mediaAssetPreview'
  | 'mediaAssetGroups'
  | 'mediaAssetPlatform'
  | 'mediaAssetType'
  | 'mediaAssetSpec'
  | 'mediaAssetTimeline'
  | 'contentTextPreview'
  | 'contentMediaPreview'
  | 'contentIdentity'
  | 'contentPools'
  | 'contentPlatform'
  | 'contentType'
  | 'contentTimeline'
  | 'publishedContentIdentity'
  | 'publishedContentPublisher'
  | 'publishedContentLink'
  | 'publishedContentMetrics'
  | 'publishedContentTimeline'
  | 'publishedTaskIdentity'
  | 'publishedTaskResult'
  | 'publishedTaskOutput'
  | 'interactionTargetContent'
  | 'interactionProgress'
  | 'relation'

export interface SelectOption {
  label: string
  value: string | number | boolean
}

export interface RemoteSelectConfig {
  endpoint: string | ((context?: AnyRecord) => string)
  labelKey?: string
  labelKeys?: string[]
  valueKey: string
  detailPath?: (value: string, row?: AnyRecord) => string
  batchDetailLoader?: (values: string[], context?: AnyRecord) => Promise<AnyRecord[]>
  rowLabelKeys?: string[]
  rowSecondaryKeys?: string[]
  searchParam?: string
  secondaryKey?: string
  secondaryKeys?: string[]
  secondaryFormatter?: (option: AnyRecord) => string
  statusKey?: string
  params?: AnyRecord | ((context?: AnyRecord) => AnyRecord)
  pageSize?: number
  loadWhen?: (context?: AnyRecord) => boolean
  multiple?: boolean
  selectionLimit?: number | ((context?: AnyRecord) => number | undefined)
  pickerTitle?: string | ((context?: AnyRecord) => string)
  selectionItemLabel?: string | ((context?: AnyRecord) => string)
  preferenceKey?: string
  clearWhenMissing?: boolean
  matchesContext?: (option: AnyRecord, context?: AnyRecord) => boolean
  optionDisabled?: (option: AnyRecord, context?: AnyRecord) => boolean
  emptyText?: string | ((context?: AnyRecord) => string)
  fixedOptions?: AnyRecord[]
  group?: RemoteSelectGroupConfig
  create?: RemoteSelectCreateConfig
}

export interface RemoteSelectCreateConfig {
  endpoint: string | ((context?: AnyRecord) => string)
  body: (label: string, context?: AnyRecord) => AnyRecord
  successTitle?: string
}

export interface RemoteSelectGroupConfig {
  endpoint: string | ((context?: AnyRecord) => string)
  labelKey?: string
  valueKey?: string
  params?: AnyRecord | ((context?: AnyRecord) => AnyRecord)
  groupParam?: string
  ungroupedParam?: string
  allLabel?: string
  ungroupedLabel?: string
}

export interface FieldConfig {
  key: string
  label: string
  type?: FieldType
  required?: boolean
  placeholder?: string
  options?: SelectOption[]
  remote?: RemoteSelectConfig
  multiple?: boolean
  accountAssociationOnly?: boolean
  accountTreeGroupByDevice?: boolean
  accountTreeMonitoringOnly?: boolean
  accountTreePreferenceScope?: string
  accountTreePublishPool?: boolean

  slotTreeAccountPresenceFilter?: boolean
  slotTreeAccountPresence?: 'all' | 'bound' | 'unbound'
  slotTreeProviderFilter?: boolean
  slotTreeFillHeight?: boolean
  slotTreePublishStats?: boolean
  defaultValue?: unknown | ((record?: AnyRecord) => unknown)
  endKey?: string
  endDefaultValue?: number
  startPlaceholder?: string
  endPlaceholder?: string
  min?: number
  max?: number
  maxItems?: number
  step?: number
  span?: 1 | 2
  readonly?: boolean
  hidden?: boolean
  sourceKey?: string
  dependencyKey?: string
  scriptScopeKey?: string
  disabledWhen?: { key: string; value: string | string[] }
  requiredWhen?: { key: string; value: string | string[] }
  visibleWhen?: { key: string; value: string | string[] }
  visibleWhenAll?: Array<{ key: string; value: string | string[] }>
  clearWhenHidden?: boolean
  allowEmpty?: boolean
}

export interface ColumnConfig {
  key: string
  label: string
  type?: ColumnType
  options?: SelectOption[]
  relation?: RemoteSelectConfig
  statusSwitch?: {
    activeValue: string
    inactiveValue: string
    activeText: string
    inactiveText: string
    activeActionKey: string
    inactiveActionKey: string
  }
  className?: string
  minWidth?: number | string
  width?: number | string
  align?: 'left' | 'center' | 'right'
}

export interface RowActionConfig {
  key: string
  permission?: string
  label: string
  submitLabel?: string
  visible?: (record: AnyRecord) => boolean
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path?: (record: AnyRecord, payload?: AnyRecord) => string
  batchPath?: (records: AnyRecord[], payload?: AnyRecord) => string
  fields?: FieldConfig[]
  resultColumns?: ColumnConfig[]
  body?: AnyRecord | ((payload: AnyRecord, record: AnyRecord) => unknown)
  batchBody?: (payload: AnyRecord, records: AnyRecord[]) => unknown
  params?: AnyRecord | ((payload: AnyRecord, record: AnyRecord) => AnyRecord)
  batchParams?: AnyRecord | ((payload: AnyRecord, records: AnyRecord[]) => AnyRecord)
  confirm?: string | ((record: AnyRecord) => string)
  previewPath?: (record: AnyRecord) => string
  confirmFromPreview?: (data: AnyRecord, record: AnyRecord) => string
  refresh?: boolean
  variant?: 'default' | 'danger' | 'success'
  icon?: string
  successTitle?: string
  successMessage?: (data: AnyRecord, payload: AnyRecord) => string
  successNotificationType?: (data: AnyRecord, payload: AnyRecord) => 'success' | 'warning' | 'error' | 'info'
  showResult?: boolean
  clientAction?: 'download'
  urlKey?: string
  filenameKey?: string
}

export interface ResourceConfig {
  key: string
  title: string
  permissionModule?: string
  endpoint: string
  listEndpoint?: string
  expandRow?: 'publishedContentTask'
  idKey?: string
  createEndpoint?: string
  createLabel?: string
  deletePath?: (record: AnyRecord) => string
  createSuccessMessage?: (createdRecord: AnyRecord, payload: AnyRecord) => string
  createSuccessTitle?: string
  createNotificationType?: (createdRecord: AnyRecord, payload: AnyRecord) => 'success' | 'warning' | 'error'
  updateSuccessMessage?: (updatedRecord: AnyRecord, payload: AnyRecord) => string
  updateSuccessTitle?: string
  updateNotificationType?: (updatedRecord: AnyRecord, payload: AnyRecord) => 'success' | 'warning' | 'error' | 'info'
  deleteSuccessMessage?: (deletedRecord: AnyRecord, record: AnyRecord) => string
  deleteSuccessTitle?: string
  deleteNotificationType?: (deletedRecord: AnyRecord, record: AnyRecord) => 'success' | 'warning' | 'error' | 'info'
  deleteAllowed?: (record: AnyRecord) => boolean
  deleteBlockedMessage?: (record: AnyRecord) => string
  keepCreateOpenWhen?: (createdRecord: AnyRecord, payload: AnyRecord) => boolean
  createBody?: (payload: AnyRecord) => unknown
  listParams?: (params: AnyRecord) => AnyRecord
  afterCreate?: (createdRecord: AnyRecord, payload: AnyRecord) => Promise<unknown>
  loadEditRecord?: (record: AnyRecord) => Promise<AnyRecord>
  updateBody?: (payload: AnyRecord, record: AnyRecord) => unknown
  afterUpdate?: (updatedRecord: AnyRecord, payload: AnyRecord, record: AnyRecord) => Promise<unknown>
  readOnly?: boolean
  columns: ColumnConfig[]
  filters?: FieldConfig[]
  createFields?: FieldConfig[]
  updateFields?: FieldConfig[]
  rowActions?: RowActionConfig[]
  headerActions?: RowActionConfig[]
  inlineActionKeys?: string[]
  operationWidth?: number
  directDelete?: boolean
  batchActions?: RowActionConfig[]
  deleteLabel?: string
  deleteConfirm?: string
  accountTagMembers?: boolean
  slotGroupMembers?: boolean
  proxyGroupMembers?: boolean
  contentGroupMembers?: boolean
  mediaAssetGroupMembers?: boolean
  mediaAssetBatchUpload?: boolean
  editPreview?: 'content'
  runtimeSyncFailureAlerts?: boolean
}

export type IconMap = Record<string, Component>
