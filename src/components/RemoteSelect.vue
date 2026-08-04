<script setup lang="ts">
import { ElNotification } from 'element-plus'
import { computed, onMounted, ref, watch } from 'vue'

import { ApiError, http } from '@/api/http'
import type { AnyRecord, PageResult } from '@/types/api'
import type { RemoteSelectConfig } from '@/types/crud'
import { statusLabel, statusTagType } from '@/utils/format'
import {
  applyRemoteGroupFilter,
  REMOTE_GROUP_ALL,
  REMOTE_GROUP_UNGROUPED,
} from '@/utils/groupedRemoteSelect'
import { notifyError } from '@/utils/notify'

const props = defineProps<{
  modelValue: unknown
  config: RemoteSelectConfig
  disabled?: boolean
  placeholder?: string
  context?: AnyRecord
  compact?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | string[]]
}>()

const loading = ref(false)
const creating = ref(false)
const groupLoading = ref(false)
const options = ref<AnyRecord[]>([])
const groupOptions = ref<AnyRecord[]>([])
const selectedGroup = ref(REMOTE_GROUP_ALL)
const suppressNextModelReload = ref(false)
let loadRequestId = 0
let groupRequestId = 0

const groupEnabled = computed(() => Boolean(props.config.group && !props.compact))

function resolvedEndpoint() {
  return typeof props.config.endpoint === 'function'
    ? props.config.endpoint(props.context)
    : props.config.endpoint
}

function resolvedCreateEndpoint() {
  if (!props.config.create) return ''
  return typeof props.config.create.endpoint === 'function'
    ? props.config.create.endpoint(props.context)
    : props.config.create.endpoint
}

function resolvedBaseParams() {
  const params = typeof props.config.params === 'function'
    ? props.config.params(props.context)
    : props.config.params || {}
  return applyRemoteGroupFilter(
    params,
    selectedGroup.value,
    groupEnabled.value ? props.config.group : undefined,
  )
}

function resolvedGroupEndpoint() {
  if (!groupEnabled.value || !props.config.group) return ''
  return typeof props.config.group.endpoint === 'function'
    ? props.config.group.endpoint(props.context)
    : props.config.group.endpoint
}

function resolvedGroupParams() {
  if (!groupEnabled.value || !props.config.group) return {}
  return typeof props.config.group.params === 'function'
    ? props.config.group.params(props.context)
    : props.config.group.params || {}
}

// 表单对象每次输入都会产生新引用，只比较真正影响候选数据的请求参数。
const requestSignature = computed(() => JSON.stringify({
  endpoint: resolvedEndpoint(),
  params: resolvedBaseParams(),
}))
const groupRequestSignature = computed(() => JSON.stringify({
  endpoint: resolvedGroupEndpoint(),
  params: resolvedGroupParams(),
}))

const selectValue = computed(() => {
  if (props.config.multiple) {
    return Array.isArray(props.modelValue) ? props.modelValue.map(String) : []
  }
  return String(props.modelValue || '')
})

const emptyText = computed(() => {
  if (typeof props.config.emptyText === 'function') {
    return props.config.emptyText(props.context)
  }
  return props.config.emptyText || '暂无可选数据'
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

function optionStatus(option: AnyRecord) {
  return props.config.statusKey ? option[props.config.statusKey] : undefined
}

function optionDisabled(option: AnyRecord) {
  return Boolean(props.config.optionDisabled?.(option, props.context))
}

function groupValue(group: AnyRecord) {
  return String(group[props.config.group?.valueKey || 'id'] ?? '')
}

function groupLabel(group: AnyRecord) {
  const labelKey = props.config.group?.labelKey || 'name'
  return String(group[labelKey] || groupValue(group))
}

async function loadGroupOptions() {
  if (!groupEnabled.value || !props.config.group) {
    groupOptions.value = []
    selectedGroup.value = REMOTE_GROUP_ALL
    return
  }

  const requestId = ++groupRequestId
  groupLoading.value = true
  try {
    const endpoint = resolvedGroupEndpoint()
    const baseParams = resolvedGroupParams()
    const items: AnyRecord[] = []
    let page = 1
    let total = 0
    do {
      const data = await http.get<PageResult<AnyRecord>>(endpoint, {
        ...baseParams,
        page,
        page_size: 100,
      })
      if (requestId !== groupRequestId) return
      items.push(...data.items)
      total = data.total
      page += 1
      if (!data.items.length) break
    } while (items.length < total)

    groupOptions.value = items
    const selectedStillExists = selectedGroup.value === REMOTE_GROUP_ALL
      || selectedGroup.value === REMOTE_GROUP_UNGROUPED
      || items.some((group) => groupValue(group) === selectedGroup.value)
    if (!selectedStillExists) selectedGroup.value = REMOTE_GROUP_ALL
  } finally {
    if (requestId === groupRequestId) groupLoading.value = false
  }
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
  const requestId = ++loadRequestId
  loading.value = true
  try {
    const endpoint = resolvedEndpoint()
    const baseParams = resolvedBaseParams()
    const params: AnyRecord = {
      ...baseParams,
      page: 1,
      page_size: props.config.pageSize || 50,
    }
    if (keyword && props.config.searchParam) params[props.config.searchParam] = keyword
    const data = await http.get<PageResult<AnyRecord>>(endpoint, params)
    if (requestId !== loadRequestId) return
    const matchedItems = props.config.matchesContext
      ? data.items.filter((item) => props.config.matchesContext?.(item, props.context))
      : data.items
    if (behavior.clearMissing && props.config.clearWhenMissing) {
      const items = await mergeDetailsForCurrentSelection(matchedItems)
      if (requestId !== loadRequestId) return
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
    const mergedItems = await mergeSelectedDetails(matchedItems)
    if (requestId === loadRequestId) options.value = mergedItems
  } finally {
    if (requestId === loadRequestId) loading.value = false
  }
}

function handleVisibleChange(visible: boolean) {
  if (visible && !options.value.length) loadOptions()
}

onMounted(() => {
  loadGroupOptions()
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
  requestSignature,
  () => {
    options.value = []
    loadOptions('', { clearMissing: Boolean(props.config.clearWhenMissing) })
  },
)

watch(
  groupRequestSignature,
  () => {
    groupOptions.value = []
    selectedGroup.value = REMOTE_GROUP_ALL
    loadGroupOptions()
  },
)

async function findExactOption(label: string) {
  const normalizedLabel = label.toLocaleLowerCase()
  const localOption = options.value.find(
    (option) => optionLabel(option).trim().toLocaleLowerCase() === normalizedLabel,
  )
  if (localOption) return localOption
  if (!props.config.searchParam) return null

  const data = await http.get<PageResult<AnyRecord>>(resolvedEndpoint(), {
    ...resolvedBaseParams(),
    page: 1,
    page_size: props.config.pageSize || 50,
    [props.config.searchParam]: label,
  })
  return data.items.find(
    (option) => optionLabel(option).trim().toLocaleLowerCase() === normalizedLabel,
  ) || null
}

async function createOrReuseOption(label: string) {
  const existing = await findExactOption(label)
  if (existing) return { option: existing, created: false }

  try {
    return {
      option: await http.post<AnyRecord>(
        resolvedCreateEndpoint(),
        props.config.create?.body(label, props.context),
      ),
      created: true,
    }
  } catch (err) {
    // 并发创建同名数据时，后端可能先返回冲突；重新查询并复用已创建的数据。
    if (err instanceof ApiError && err.status === 409) {
      const conflicted = await findExactOption(label)
      if (conflicted) return { option: conflicted, created: false }
    }
    throw err
  }
}

async function updateSelected(value: string | string[]) {
  const normalized = props.config.multiple
    ? (Array.isArray(value) ? value : [value]).filter(Boolean).map(String)
    : [String(Array.isArray(value) ? value[0] || '' : value || '')].filter(Boolean)

  if (!props.config.create) {
    emit(
      'update:modelValue',
      props.config.multiple ? normalized : normalized[0] || '',
    )
    return
  }

  const unknownLabels = normalized.filter(
    (item) => !options.value.some((option) => optionValue(option) === item),
  )
  if (!unknownLabels.length) {
    emit(
      'update:modelValue',
      props.config.multiple ? normalized : normalized[0] || '',
    )
    return
  }

  creating.value = true
  try {
    const resolvedOptions = new Map<string, { option: AnyRecord; created: boolean }>()
    for (const rawLabel of unknownLabels) {
      const label = rawLabel.trim()
      if (!label) continue
      resolvedOptions.set(rawLabel, await createOrReuseOption(label))
    }
    if (!resolvedOptions.size) return

    const resolvedValues = normalized
      .map((item) => {
        const resolved = resolvedOptions.get(item)
        if (resolved) return optionValue(resolved.option)
        return unknownLabels.includes(item) ? '' : item
      })
      .filter(Boolean)
    const additions = [...resolvedOptions.values()].map((item) => item.option).filter(
      (item) => !options.value.some((option) => optionValue(option) === optionValue(item)),
    )
    const created = [...resolvedOptions.values()].filter((item) => item.created).map((item) => item.option)
    if (additions.length) options.value = [...additions, ...options.value]

    emit(
      'update:modelValue',
      props.config.multiple ? resolvedValues : resolvedValues[0] || '',
    )
    ElNotification.success({
      title: props.config.create.successTitle || '创建成功',
      message: created.length
        ? `已创建并选中：${created.map(optionLabel).join('、')}`
        : '已选中同名数据',
    })
  } catch (err) {
    notifyError(err, '创建失败', '暂时无法创建，请稍后重试')
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div class="remote-select-control">
    <el-select
      v-if="groupEnabled"
      v-model="selectedGroup"
      class="remote-select-control__group"
      :disabled="disabled"
      :loading="groupLoading"
      filterable
      placeholder="选择分组"
    >
      <el-option :label="config.group?.allLabel || '全部分组'" :value="REMOTE_GROUP_ALL" />
      <el-option
        v-for="group in groupOptions"
        :key="groupValue(group)"
        :label="groupLabel(group)"
        :value="groupValue(group)"
      />
      <el-option
        :label="config.group?.ungroupedLabel || '未分组'"
        :value="REMOTE_GROUP_UNGROUPED"
      />
    </el-select>

    <el-select
      :model-value="selectValue"
      :disabled="disabled || creating"
      class="remote-select-control__resource"
      clearable
      collapse-tags
      collapse-tags-tooltip
      filterable
      :multiple="Boolean(config.multiple)"
      :allow-create="Boolean(config.create)"
      :default-first-option="Boolean(config.create)"
      remote
      reserve-keyword
      :loading="loading || creating"
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
        :disabled="optionDisabled(option)"
      >
        <div class="remote-select-option">
          <span class="remote-select-option__label">{{ optionLabel(option) }}</span>
          <span class="remote-select-option__meta">
            <span v-if="optionSecondary(option)" class="font-mono text-xs text-slate-400">
              {{ optionSecondary(option) }}
            </span>
            <el-tag
              v-if="optionStatus(option)"
              size="small"
              :type="statusTagType(optionStatus(option))"
              effect="light"
              round
            >
              {{ statusLabel(optionStatus(option)) }}
            </el-tag>
          </span>
        </div>
      </el-option>
      <template #empty>
        <div class="remote-select-empty">
          {{ emptyText }}
        </div>
      </template>
    </el-select>
  </div>
</template>

<style scoped>
.remote-select-control {
  display: flex;
  width: 100%;
  min-width: 0;
  gap: 8px;
}

.remote-select-control__group {
  width: 148px;
  flex: 0 0 148px;
}

.remote-select-control__resource {
  min-width: 0;
  flex: 1;
}

.remote-select-option {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.remote-select-option__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remote-select-option__meta {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 8px;
}

.remote-select-empty {
  padding: 16px 18px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
  text-align: center;
}

@media (max-width: 640px) {
  .remote-select-control {
    flex-direction: column;
  }

  .remote-select-control__group {
    width: 100%;
    flex-basis: auto;
  }
}
</style>
