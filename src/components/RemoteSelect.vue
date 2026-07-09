<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { http } from '@/api/http'
import type { AnyRecord, PageResult } from '@/types/api'
import type { RemoteSelectConfig } from '@/types/crud'

const props = defineProps<{
  modelValue: unknown
  config: RemoteSelectConfig
  disabled?: boolean
  placeholder?: string
  context?: AnyRecord
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | string[]]
}>()

const loading = ref(false)
const options = ref<AnyRecord[]>([])
const suppressNextModelReload = ref(false)

const selectValue = computed(() => {
  if (props.config.multiple) {
    return Array.isArray(props.modelValue) ? props.modelValue.map(String) : []
  }
  return String(props.modelValue || '')
})

function fieldValue(option: AnyRecord, keys: string[]) {
  const key = keys.find((item) => option[item] !== undefined && option[item] !== null && option[item] !== '')
  return key ? String(option[key]) : ''
}

function optionLabel(option: AnyRecord) {
  const labelKeys = props.config.labelKeys || (props.config.labelKey ? [props.config.labelKey] : [])
  return fieldValue(option, [...labelKeys, props.config.valueKey])
}

function optionValue(option: AnyRecord) {
  return String(option[props.config.valueKey] ?? '')
}

function optionSecondary(option: AnyRecord) {
  const keys = props.config.secondaryKeys || (props.config.secondaryKey ? [props.config.secondaryKey] : [])
  return fieldValue(option, keys)
}

function selectedValues() {
  return Array.isArray(selectValue.value)
    ? selectValue.value
    : selectValue.value
      ? [selectValue.value]
      : []
}

function mergeSelected(items: AnyRecord[]) {
  const selected = selectedValues()
  if (!selected.length) return items
  const missing = selected.filter((value) => !items.some((item) => optionValue(item) === value))
  const existing = options.value.filter((item) => missing.includes(optionValue(item)))
  return existing.length ? [...existing, ...items] : items
}

async function mergeSelectedDetails(items: AnyRecord[]) {
  const selected = selectedValues()
  if (!selected.length || !props.config.detailPath) return mergeSelected(items)

  const missing = selected.filter(
    (value) =>
      !items.some((item) => optionValue(item) === value) &&
      !options.value.some((item) => optionValue(item) === value),
  )
  if (!missing.length) return mergeSelected(items)

  const details = await Promise.all(
    missing.map((value) => http.get<AnyRecord>(props.config.detailPath?.(value) || '').catch(() => null)),
  )
  return mergeSelected([...details.filter(Boolean) as AnyRecord[], ...items])
}

async function mergeDetailsForCurrentSelection(items: AnyRecord[]) {
  const selected = selectedValues()
  if (!selected.length || !props.config.detailPath) return items

  const missing = selected.filter((value) => !items.some((item) => optionValue(item) === value))
  if (!missing.length) return items

  const details = await Promise.all(
    missing.map((value) => http.get<AnyRecord>(props.config.detailPath?.(value) || '').catch(() => null)),
  )
  return [...details.filter(Boolean) as AnyRecord[], ...items]
}

async function loadOptions(keyword = '', behavior: { clearMissing?: boolean } = {}) {
  loading.value = true
  try {
    const endpoint = typeof props.config.endpoint === 'function'
      ? props.config.endpoint(props.context)
      : props.config.endpoint
    const baseParams = typeof props.config.params === 'function'
      ? props.config.params(props.context)
      : props.config.params || {}
    const params: AnyRecord = {
      ...baseParams,
      page: 1,
      page_size: props.config.pageSize || 50,
    }
    if (keyword && props.config.searchParam) params[props.config.searchParam] = keyword
    const data = await http.get<PageResult<AnyRecord>>(endpoint, params)
    if (behavior.clearMissing && props.config.clearWhenMissing) {
      const items = await mergeDetailsForCurrentSelection(data.items)
      const availableItems = props.config.matchesContext
        ? items.filter((item) => props.config.matchesContext?.(item, props.context))
        : items
      const availableValues = new Set(availableItems.map(optionValue))
      const currentValues = selectedValues()
      const retainedValues = currentValues.filter((value) => availableValues.has(value))
      options.value = availableItems
      if (retainedValues.length !== currentValues.length) {
        suppressNextModelReload.value = true
        emit(
          'update:modelValue',
          props.config.multiple ? retainedValues : '',
        )
      }
      return
    }
    options.value = await mergeSelectedDetails(data.items)
  } finally {
    loading.value = false
  }
}

function handleVisibleChange(visible: boolean) {
  if (visible && !options.value.length) loadOptions()
}

onMounted(() => {
  loadOptions('', { clearMissing: Boolean(props.config.clearWhenMissing) })
})

watch(
  () => props.modelValue,
  () => {
    if (suppressNextModelReload.value) {
      suppressNextModelReload.value = false
      return
    }
    const missing = selectedValues().some((value) => !options.value.some((item) => optionValue(item) === value))
    if (missing) {
      loadOptions()
    }
  },
)

watch(
  () => props.context,
  () => {
    options.value = []
    loadOptions('', { clearMissing: Boolean(props.config.clearWhenMissing) })
  },
  { deep: true },
)

function updateSelected(value: string | string[]) {
  emit(
    'update:modelValue',
    props.config.multiple
      ? (Array.isArray(value) ? value : [value]).filter(Boolean).map(String)
      : String(value || ''),
  )
}
</script>

<template>
  <el-select
    :model-value="selectValue"
    :disabled="disabled"
    class="w-full"
    clearable
    collapse-tags
    collapse-tags-tooltip
    filterable
    :multiple="Boolean(config.multiple)"
    remote
    reserve-keyword
    :loading="loading"
    :placeholder="placeholder || '请选择'"
    :remote-method="loadOptions"
    @visible-change="handleVisibleChange"
    @update:model-value="updateSelected"
  >
    <el-option
      v-for="option in options"
      :key="optionValue(option)"
      :label="optionLabel(option)"
      :value="optionValue(option)"
    >
      <div class="flex items-center justify-between gap-4">
        <span class="truncate">{{ optionLabel(option) }}</span>
        <span v-if="optionSecondary(option)" class="font-mono text-xs text-slate-400">
          {{ optionSecondary(option) }}
        </span>
      </div>
    </el-option>
  </el-select>
</template>
