import type { AnyRecord } from '@/types/api'
import type { FieldConfig } from '@/types/crud'

function cloneDefault(value: unknown) {
  if (Array.isArray(value) || (value && typeof value === 'object')) {
    return JSON.parse(JSON.stringify(value))
  }
  return value
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function defaultValueFor(field: FieldConfig, record?: AnyRecord) {
  if (field.defaultValue !== undefined) {
    const value = typeof field.defaultValue === 'function' ? field.defaultValue(record) : field.defaultValue
    return cloneDefault(value)
  }
  if (field.type === 'boolean') return false
  if (field.type === 'json') return '{}'
  if (field.type === 'scriptParams') return []
  if (field.type === 'templateParams') return {}
  if (field.type === 'slotTree') return []
  if (field.type === 'templateSelect') return ''
  if (field.type === 'remoteSelect' && field.remote?.multiple) return []
  if (field.type === 'select' && field.multiple) return []
  if (field.type === 'datetimeRange') return []
  if (field.type === 'timeRange') return []
  if (field.type === 'tags') return ''
  return ''
}

export function buildFormState(fields: FieldConfig[], record?: AnyRecord) {
  return fields.reduce<AnyRecord>((state, field) => {
    const sourceKey = field.sourceKey || field.key
    const sourceValue = record && record[sourceKey] !== undefined ? record[sourceKey] : defaultValueFor(field, record)
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
    if (field.type === 'scriptParams') {
      state[field.key] = Array.isArray(sourceValue) ? cloneDefault(sourceValue) : []
      return state
    }
    if (field.type === 'templateParams') {
      state[field.key] = isPlainObject(sourceValue) ? cloneDefault(sourceValue) : {}
      return state
    }
    if (field.type === 'slotTree') {
      state[field.key] = Array.isArray(sourceValue)
        ? cloneDefault(sourceValue)
        : sourceValue
          ? [sourceValue]
          : []
      return state
    }
    if (field.type === 'remoteSelect' && field.remote?.multiple) {
      state[field.key] = Array.isArray(sourceValue)
        ? cloneDefault(sourceValue)
        : sourceValue
          ? [sourceValue]
          : []
      return state
    }
    if (field.type === 'select' && field.multiple) {
      state[field.key] = Array.isArray(sourceValue)
        ? cloneDefault(sourceValue)
        : sourceValue
          ? [sourceValue]
          : []
      return state
    }
    if (field.type === 'datetime' && typeof sourceValue === 'string') {
      state[field.key] = sourceValue.slice(0, 19)
      return state
    }
    if (field.type === 'datetimeRange' || field.type === 'timeRange') {
      state[field.key] = Array.isArray(sourceValue) ? cloneDefault(sourceValue) : []
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

function normalizeObject(value: unknown) {
  return isPlainObject(value) ? value : {}
}

export function normalizeScriptParams(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item, index) => {
      const record = normalizeObject(item)
      const paramKey = String(record.param_key || '').trim()
      const name = String(record.name || '').trim()
      return {
        param_key: paramKey,
        name,
        param_type: String(record.param_type || 'string'),
        description: record.description ? String(record.description) : null,
        required: Boolean(record.required),
        default_value: record.default_value ?? null,
        options: Array.isArray(record.options) ? record.options : [],
        validation: normalizeObject(record.validation),
        resource_selector: normalizeObject(record.resource_selector),
        sort_order: Number(record.sort_order ?? (index + 1) * 10),
        metadata: normalizeObject(record.metadata),
      }
    })
    .filter((item) => item.param_key && item.name)
}

// 根据字段类型把表单值整理成后端需要的结构，避免每个页面重复写解析逻辑。
export function buildPayload(
  fields: FieldConfig[],
  state: AnyRecord,
  mode: 'create' | 'update' | 'action',
) {
  return fields.reduce<AnyRecord>((payload, field) => {
    const rawValue = state[field.key]
    if (field.readonly || field.hidden) return payload
    if (Array.isArray(rawValue) && !rawValue.length && !field.required) return payload
    if ((rawValue === '' || rawValue === undefined || rawValue === null) && !field.required) {
      if (field.allowEmpty) payload[field.key] = rawValue === undefined || rawValue === null ? '' : rawValue
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
    if (field.type === 'select' && field.multiple) {
      payload[field.key] = Array.isArray(rawValue)
        ? rawValue.filter(Boolean).map(String)
        : rawValue
          ? [String(rawValue)]
          : []
      return payload
    }
    if (field.type === 'scriptParams') {
      payload[field.key] = normalizeScriptParams(rawValue)
      return payload
    }
    if (field.type === 'templateParams') {
      payload[field.key] = normalizeObject(rawValue)
      return payload
    }
    if (field.type === 'slotTree') {
      payload[field.key] = Array.isArray(rawValue)
        ? rawValue.filter(Boolean).map(String)
        : rawValue
          ? [String(rawValue)]
          : []
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
    if (field.type === 'datetimeRange') {
      payload[field.key] = Array.isArray(rawValue)
        ? rawValue.filter(Boolean).map((value) => new Date(String(value)).toISOString())
        : []
      return payload
    }
    if (field.type === 'timeRange') {
      payload[field.key] = Array.isArray(rawValue) ? rawValue.filter(Boolean).map(String) : []
      return payload
    }
    payload[field.key] = rawValue
    return payload
  }, {})
}
