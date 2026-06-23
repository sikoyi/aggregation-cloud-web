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
  | 'scriptParams'
  | 'templateParams'

export type ColumnType = 'text' | 'status' | 'datetime' | 'json' | 'list' | 'id' | 'boolean'

export interface SelectOption {
  label: string
  value: string | number | boolean
}

export interface FieldConfig {
  key: string
  label: string
  type?: FieldType
  required?: boolean
  placeholder?: string
  options?: SelectOption[]
  defaultValue?: unknown
  span?: 1 | 2
  readonly?: boolean
  dependencyKey?: string
}

export interface ColumnConfig {
  key: string
  label: string
  type?: ColumnType
  className?: string
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
  readOnly?: boolean
  columns: ColumnConfig[]
  filters?: FieldConfig[]
  createFields?: FieldConfig[]
  updateFields?: FieldConfig[]
  rowActions?: RowActionConfig[]
  archiveLabel?: string
  archiveConfirm?: string
}

export type IconMap = Record<string, Component>
