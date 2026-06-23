import type { AnyRecord } from '@/types/api'
import type { FieldConfig } from '@/types/crud'

function cloneDefault(value: unknown) {
  if (Array.isArray(value) || (value && typeof value === 'object')) {
    return JSON.parse(JSON.stringify(value))
  }
  return value
}

function defaultValueFor(field: FieldConfig) {
  if (field.defaultValue !== undefined) return cloneDefault(field.defaultValue)
  if (field.type === 'boolean') return false
  if (field.type === 'json') return '{}'
  if (field.type === 'tags') return ''
  return ''
}

export function buildFormState(fields: FieldConfig[], record?: AnyRecord) {
  return fields.reduce<AnyRecord>((state, field) => {
    const sourceValue = record && record[field.key] !== undefined ? record[field.key] : defaultValueFor(field)
    if (field.type === 'json') {
      state[field.key] =
        typeof sourceValue === 'string'
          ? sourceValue
          : JSON.stringify(sourceValue ?? {}, null, 2)
      return state
    }
    if (field.type === 'tags') {
      state[field.key] = Array.isArray(sourceValue) ? sourceValue.join(', ') : sourceValue || ''
      return state
    }
    if (field.type === 'datetime' && typeof sourceValue === 'string') {
      state[field.key] = sourceValue.slice(0, 16)
      return state
    }
    state[field.key] = sourceValue ?? ''
    return state
  }, {})
}

function parseTags(value: unknown) {
  if (Array.isArray(value)) return value
  return String(value || '')
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseJsonField(field: FieldConfig, value: unknown, mode: 'create' | 'update') {
  if (value === '' || value === undefined || value === null) {
    return mode === 'create' ? {} : undefined
  }
  try {
    return typeof value === 'string' ? JSON.parse(value) : value
  } catch {
    throw new Error(`${field.label} 不是合法 JSON`)
  }
}

// 根据字段类型把表单字符串还原成后端需要的结构，避免每个页面重复写解析逻辑。
export function buildPayload(
  fields: FieldConfig[],
  state: AnyRecord,
  mode: 'create' | 'update' | 'action',
) {
  return fields.reduce<AnyRecord>((payload, field) => {
    const rawValue = state[field.key]
    if (field.readonly) return payload
    if ((rawValue === '' || rawValue === undefined || rawValue === null) && !field.required) {
      if (mode === 'create' && field.type === 'json') payload[field.key] = {}
      return payload
    }

    if (field.type === 'number') {
      payload[field.key] = Number(rawValue)
      return payload
    }
    if (field.type === 'boolean') {
      payload[field.key] = Boolean(rawValue)
      return payload
    }
    if (field.type === 'tags') {
      payload[field.key] = parseTags(rawValue)
      return payload
    }
    if (field.type === 'json') {
      const value = parseJsonField(field, rawValue, mode === 'update' ? 'update' : 'create')
      if (value !== undefined) payload[field.key] = value
      return payload
    }
    if (field.type === 'datetime') {
      payload[field.key] = rawValue ? new Date(String(rawValue)).toISOString() : undefined
      return payload
    }
    payload[field.key] = rawValue
    return payload
  }, {})
}
