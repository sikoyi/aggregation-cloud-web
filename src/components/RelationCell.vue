<script lang="ts">
import type { AnyRecord as CachedRecord } from '@/types/api'

// 表格里同一个关联资源可能重复出现，做模块级缓存可以减少详情接口请求。
const relationCache = new Map<string, CachedRecord | null>()
const relationRequests = new Map<string, Promise<CachedRecord | null>>()
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { http } from '@/api/http'
import type { AnyRecord } from '@/types/api'
import type { RemoteSelectConfig } from '@/types/crud'
import { truncateId } from '@/utils/format'

const props = defineProps<{
  value: unknown
  config: RemoteSelectConfig
  row?: AnyRecord
}>()

const loading = ref(false)
const record = ref<AnyRecord | null>(null)
const failed = ref(false)

const valueText = computed(() => String(props.value || ''))
const prefetchedLabel = computed(() => fieldValue(props.row || null, props.config.rowLabelKeys || []))
const prefetchedSecondary = computed(() => fieldValue(props.row || null, props.config.rowSecondaryKeys || []))

function relationPath() {
  if (!valueText.value) return ''
  if (props.config.detailPath) return props.config.detailPath(valueText.value, props.row)
  return `${props.config.endpoint}/${encodeURIComponent(valueText.value)}`
}

function fieldValue(item: AnyRecord | null, keys: string[]) {
  if (!item) return ''
  const key = keys.find((field) => item[field] !== undefined && item[field] !== null && item[field] !== '')
  return key ? String(item[key]) : ''
}

function relationLabel(item: AnyRecord | null) {
  const labelKeys = props.config.labelKeys || (props.config.labelKey ? [props.config.labelKey] : [])
  return fieldValue(item, [...labelKeys, props.config.valueKey])
}

function relationSecondary(item: AnyRecord | null) {
  if (item && props.config.secondaryFormatter) return props.config.secondaryFormatter(item)
  const keys = props.config.secondaryKeys || (props.config.secondaryKey ? [props.config.secondaryKey] : [])
  return fieldValue(item, keys)
}

const label = computed(() => prefetchedLabel.value || relationLabel(record.value) || truncateId(valueText.value))
const secondary = computed(() => prefetchedSecondary.value || relationSecondary(record.value))
const tooltip = computed(() => {
  const parts = [label.value, secondary.value, valueText.value].filter(Boolean)
  return Array.from(new Set(parts)).join(' / ')
})

async function loadRelation() {
  const path = relationPath()
  record.value = null
  failed.value = false
  if (!path) return
  if (prefetchedLabel.value) return

  if (relationCache.has(path)) {
    record.value = relationCache.get(path) || null
    failed.value = !record.value
    return
  }

  loading.value = true
  try {
    let request = relationRequests.get(path)
    if (!request) {
      request = http.get<AnyRecord>(path).catch(() => null)
      relationRequests.set(path, request)
    }
    const data = await request
    relationCache.set(path, data)
    record.value = data
    failed.value = !data
  } finally {
    relationRequests.delete(path)
    loading.value = false
  }
}

watch(
  () => [props.value, props.config.endpoint],
  () => loadRelation(),
  { immediate: true },
)
</script>

<template>
  <span v-if="!valueText">-</span>
  <el-tooltip v-else :content="tooltip" placement="top">
    <span class="inline-flex max-w-full flex-col leading-tight">
      <span class="truncate font-medium text-slate-700">
        {{ loading ? '加载中' : label }}
      </span>
      <span v-if="secondary && !failed" class="truncate font-mono text-[11px] text-slate-400">
        {{ secondary }}
      </span>
    </span>
  </el-tooltip>
</template>
