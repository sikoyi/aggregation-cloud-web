import { reactive, toValue, watch, type MaybeRefOrGetter } from 'vue'

import { useAuthStore } from '@/stores/auth'
import {
  buildUserPreferenceKey,
  readRecordPreference,
  writeRecordPreference,
} from '@/utils/localPreferences'

type FilterState = Record<string, unknown>

function cloneDefaults<T extends FilterState>(defaults: T | (() => T)) {
  const value = typeof defaults === 'function' ? defaults() : defaults
  return JSON.parse(JSON.stringify(value)) as T
}

function hasCompatibleType(defaultValue: unknown, storedValue: unknown) {
  if (Array.isArray(defaultValue)) return Array.isArray(storedValue)
  if (defaultValue === null) return storedValue === null
  return typeof defaultValue === typeof storedValue
}

function restoreAllowedFields<T extends FilterState>(defaults: T, stored: FilterState | null) {
  const restored = { ...defaults } as FilterState
  if (!stored) return restored as T
  Object.keys(defaults).forEach((key) => {
    if (
      Object.prototype.hasOwnProperty.call(stored, key)
      && hasCompatibleType(defaults[key], stored[key])
    ) {
      restored[key] = stored[key]
    }
  })
  return restored as T
}

export function usePersistentFilters<T extends FilterState>(
  scope: MaybeRefOrGetter<string>,
  defaults: T | (() => T),
) {
  const auth = useAuthStore()
  const preferenceKey = buildUserPreferenceKey(
    auth.user?.id,
    `filters:${String(toValue(scope) || '').trim()}`,
  )
  const defaultState = cloneDefaults(defaults)
  const restoredState = restoreAllowedFields(
    defaultState,
    preferenceKey ? readRecordPreference(localStorage, preferenceKey) : null,
  )
  // 同一筛选域共用本地持久化结果，但每个组件持有独立状态，避免同屏选择器互相联动。
  const filters = reactive(restoredState) as T

  watch(
    filters,
    (value) => {
      if (!preferenceKey) return
      const snapshot = Object.fromEntries(
        Object.keys(defaultState).map((key) => [key, value[key]]),
      )
      writeRecordPreference(localStorage, preferenceKey, snapshot)
    },
    { deep: true, flush: 'sync' },
  )

  function resetFilters() {
    const nextState = cloneDefaults(defaults)
    Object.keys(filters).forEach((key) => delete filters[key])
    Object.assign(filters, nextState)
  }

  return {
    filters,
    resetFilters,
  }
}