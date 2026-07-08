import type { Component } from 'vue'

import type { AnyRecord } from './api'

export type FieldType =
  | 'text'
  | 'textarea'
  | 'textImport'
  | 'file'
  | 'number'
  | 'select'
  | 'json'
  | 'tags'
  | 'boolean'
  | 'datetime'
  | 'datetimeRange'
  | 'timeRange'
  | 'scriptParams'
  | 'templateParams'
  | 'slotTree'
  | 'templateSelect'
  | 'remoteSelect'

export type ColumnType =
  | 'text'
  | 'status'
  | 'statusSwitch'
  | 'datetime'
  | 'json'
  | 'list'
  | 'tag'
  | 'id'
  | 'boolean'
  | 'assetPreview'
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
  searchParam?: string
  secondaryKey?: string
  secondaryKeys?: string[]
  params?: AnyRecord | ((context?: AnyRecord) => AnyRecord)
  pageSize?: number
  multiple?: boolean
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
  defaultValue?: unknown | ((record?: AnyRecord) => unknown)
  span?: 1 | 2
  readonly?: boolean
  hidden?: boolean
  sourceKey?: string
  dependencyKey?: string
  scriptScopeKey?: string
  disabledWhen?: { key: string; value: string | string[] }
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
  label: string
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
  refresh?: boolean
  variant?: 'default' | 'danger' | 'success'
  icon?: string
  successTitle?: string
  successMessage?: (data: AnyRecord, payload: AnyRecord) => string
  clientAction?: 'download'
  urlKey?: string
  filenameKey?: string
}

export interface ResourceConfig {
  key: string
  title: string
  endpoint: string
  idKey?: string
  createEndpoint?: string
  createLabel?: string
  deletePath?: (record: AnyRecord) => string
  createSuccessMessage?: (createdRecord: AnyRecord, payload: AnyRecord) => string
  createSuccessTitle?: string
  createBody?: (payload: AnyRecord) => unknown
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
  directDelete?: boolean
  batchActions?: RowActionConfig[]
  deleteLabel?: string
  deleteConfirm?: string
  accountPublishedContents?: boolean
  accountGroupMembers?: boolean
  slotGroupMembers?: boolean
  proxyGroupMembers?: boolean
}

export type IconMap = Record<string, Component>
