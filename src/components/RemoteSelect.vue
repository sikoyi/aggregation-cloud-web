<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

import { http } from '@/api/http'
import type { AnyRecord, PageResult } from '@/types/api'
import type { RemoteSelectConfig } from '@/types/crud'

const props = defineProps<{
  modelValue: unknown
  config: RemoteSelectConfig
  disabled?: boolean
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const loading = ref(false)
const options = ref<AnyRecord[]>([])

function optionLabel(option: AnyRecord) {
  return String(option[props.config.labelKey] ?? option[props.config.valueKey] ?? '')
}

function optionValue(option: AnyRecord) {
  return String(option[props.config.valueKey] ?? '')
}

function optionSecondary(option: AnyRecord) {
  if (!props.config.secondaryKey) return ''
  return String(option[props.config.secondaryKey] ?? '')
}

function mergeSelected(items: AnyRecord[]) {
  const selectedValue = String(props.modelValue || '')
  if (!selectedValue || items.some((item) => optionValue(item) === selectedValue)) return items
  const existing = options.value.find((item) => optionValue(item) === selectedValue)
  return existing ? [existing, ...items] : items
}

async function loadOptions(keyword = '') {
  loading.value = true
  try {
    const params: AnyRecord = {
      ...(props.config.params || {}),
      page: 1,
      page_size: props.config.pageSize || 50,
    }
    if (keyword && props.config.searchParam) params[props.config.searchParam] = keyword
    const data = await http.get<PageResult<AnyRecord>>(props.config.endpoint, params)
    options.value = mergeSelected(data.items)
  } finally {
    loading.value = false
  }
}

function handleVisibleChange(visible: boolean) {
  if (visible && !options.value.length) loadOptions()
}

onMounted(() => {
  loadOptions(String(props.modelValue || ''))
})

watch(
  () => props.modelValue,
  (value) => {
    if (value && !options.value.some((item) => optionValue(item) === String(value))) {
      loadOptions(String(value))
    }
  },
)
</script>

<template>
  <el-select
    :model-value="String(modelValue || '')"
    :disabled="disabled"
    class="w-full"
    clearable
    filterable
    remote
    reserve-keyword
    :loading="loading"
    :placeholder="placeholder || '请选择'"
    :remote-method="loadOptions"
    @visible-change="handleVisibleChange"
    @update:model-value="emit('update:modelValue', String($event || ''))"
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
