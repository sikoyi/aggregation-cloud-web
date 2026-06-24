import type { Component } from 'vue'

import type { AnyRecord } from './api'

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'json'
  | 'tags'
  | 'boolean'
  | 'datetime'
  | 'timeRange'
  | 'scriptParams'
  | 'templateParams'
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
  | 'relation'

export interface SelectOption {
  label: string
  value: string | number | boolean
}

export interface RemoteSelectConfig {
  endpoint: string
  labelKey?: string
  labelKeys?: string[]
  valueKey: string
  detailPath?: (value: string, row?: AnyRecord) => string
  searchParam?: string
  secondaryKey?: string
  secondaryKeys?: string[]
  params?: AnyRecord
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
  defaultValue?: unknown | ((record?: AnyRecord) => unknown)
  span?: 1 | 2
  readonly?: boolean
  hidden?: boolean
  sourceKey?: string
  dependencyKey?: string
  allowEmpty?: boolean
}

export interface ColumnConfig {
  key: string
  label: string
  type?: ColumnType
  relation?: RemoteSelectConfig
  className?: string
  minWidth?: number | string
  width?: number | string
}

export interface RowActionConfig {
  key: string
  label: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: (record: AnyRecord, payload?: AnyRecord) => string
  fields?: FieldConfig[]
  body?: AnyRecord | ((payload: AnyRecord, record: AnyRecord) => unknown)
  params?: AnyRecord | ((payload: AnyRecord, record: AnyRecord) => AnyRecord)
  confirm?: string | ((record: AnyRecord) => string)
  refresh?: boolean
  variant?: 'default' | 'danger' | 'success'
  icon?: string
}

export interface ResourceConfig {
  key: string
  title: string
  endpoint: string
  idKey?: string
  createEndpoint?: string
  createLabel?: string
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
  inlineActionKeys?: string[]
  directDelete?: boolean
  batchActions?: RowActionConfig[]
  deleteLabel?: string
  deleteConfirm?: string
}

export type IconMap = Record<string, Component>
