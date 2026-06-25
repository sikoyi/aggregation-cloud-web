<script setup lang="ts">
import { computed } from 'vue'

import ScriptParamEditor from '@/components/ScriptParamEditor.vue'
import SlotTreeSelect from '@/components/SlotTreeSelect.vue'
import TemplateParamsEditor from '@/components/TemplateParamsEditor.vue'
import RemoteSelect from '@/components/RemoteSelect.vue'
import type { AnyRecord } from '@/types/api'
import type { FieldConfig } from '@/types/crud'

const props = defineProps<{
  fields: FieldConfig[]
  modelValue: AnyRecord
}>()

const emit = defineEmits<{
  'update:modelValue': [value: AnyRecord]
}>()

function updateValue(key: string, value: unknown) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

function dependencyValue(field: FieldConfig) {
  return String(props.modelValue[field.dependencyKey || 'script_key'] || '')
}

function timeRangeValue(value: unknown) {
  return Array.isArray(value) ? value.map(String) : []
}

function selectValue(field: FieldConfig) {
  const value = props.modelValue[field.key]
  if (field.multiple) {
    return Array.isArray(value) ? value.map(String) : value ? [String(value)] : []
  }
  return String(value ?? '')
}

function updateSelectValue(field: FieldConfig, value: string | string[]) {
  updateValue(
    field.key,
    field.multiple
      ? (Array.isArray(value) ? value : [value]).filter(Boolean).map(String)
      : String(value || ''),
  )
}

const visibleFields = computed(() => props.fields.filter((field) => !field.hidden))

function fieldColumnSpan(field: FieldConfig) {
  if (field.span === 2 || ['datetimeRange', 'scriptParams'].includes(field.type || '')) return 24
  return 12
}
</script>

<template>
  <el-form label-position="top" class="dynamic-form">
    <el-row :gutter="16">
      <el-col
        v-for="field in visibleFields"
        :key="field.key"
        :xs="24"
        :md="fieldColumnSpan(field)"
      >
        <el-form-item :required="field.required" :label="field.label">
          <ScriptParamEditor
            v-if="field.type === 'scriptParams'"
            :model-value="modelValue[field.key]"
            :options="field.options"
            @update:model-value="updateValue(field.key, $event)"
          />

          <TemplateParamsEditor
            v-else-if="field.type === 'templateParams'"
            :script-key="dependencyValue(field)"
            :model-value="modelValue[field.key]"
            @update:model-value="updateValue(field.key, $event)"
          />

          <SlotTreeSelect
            v-else-if="field.type === 'slotTree'"
            :model-value="modelValue[field.key]"
            :disabled="field.readonly"
            :filters="{
              business_platform: modelValue.business_platform,
              runtime_platform: modelValue.runtime_platform,
              provider: modelValue.provider,
            }"
            @update:model-value="updateValue(field.key, $event)"
          />

          <RemoteSelect
            v-else-if="field.type === 'remoteSelect' && field.remote"
            :model-value="modelValue[field.key]"
            :config="field.remote"
            :disabled="field.readonly"
            :placeholder="field.placeholder"
            @update:model-value="updateValue(field.key, $event)"
          />

          <el-input
            v-else-if="field.type === 'textarea' || field.type === 'json'"
            :model-value="String(modelValue[field.key] ?? '')"
            type="textarea"
            :rows="field.type === 'json' ? 8 : 4"
            :placeholder="field.placeholder"
            :readonly="field.readonly"
            :class="field.type === 'json' ? 'font-mono text-xs' : ''"
            resize="vertical"
            @update:model-value="updateValue(field.key, $event)"
          />

          <el-select
            v-else-if="field.type === 'select'"
            :model-value="selectValue(field)"
            :disabled="field.readonly"
            :multiple="Boolean(field.multiple)"
            clearable
            collapse-tags
            collapse-tags-tooltip
            filterable
            class="w-full"
            placeholder="请选择"
            @update:model-value="updateSelectValue(field, $event)"
          >
            <el-option
              v-for="option in field.options || []"
              :key="String(option.value)"
              :label="option.label"
              :value="String(option.value)"
            />
          </el-select>

          <el-switch
            v-else-if="field.type === 'boolean'"
            :model-value="Boolean(modelValue[field.key])"
            :disabled="field.readonly"
            active-text="是"
            inactive-text="否"
            @update:model-value="updateValue(field.key, $event)"
          />

          <el-input-number
            v-else-if="field.type === 'number'"
            :model-value="Number(modelValue[field.key] || 0)"
            :disabled="field.readonly"
            class="w-full"
            controls-position="right"
            @update:model-value="updateValue(field.key, $event)"
          />

          <el-date-picker
            v-else-if="field.type === 'datetime'"
            :model-value="String(modelValue[field.key] ?? '')"
            :disabled="field.readonly"
            class="w-full"
            type="datetime"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DDTHH:mm:ss"
            placeholder="选择日期时间"
            clearable
            @update:model-value="updateValue(field.key, $event)"
          />

          <el-date-picker
            v-else-if="field.type === 'datetimeRange'"
            :model-value="timeRangeValue(modelValue[field.key])"
            :disabled="field.readonly"
            class="w-full"
            type="datetimerange"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DDTHH:mm:ss"
            range-separator="至"
            start-placeholder="开始日期时间"
            end-placeholder="结束日期时间"
            clearable
            @update:model-value="updateValue(field.key, $event || [])"
          />

          <el-time-picker
            v-else-if="field.type === 'timeRange'"
            :model-value="timeRangeValue(modelValue[field.key])"
            :disabled="field.readonly"
            class="w-full"
            is-range
            format="HH:mm"
            value-format="HH:mm"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            clearable
            @update:model-value="updateValue(field.key, $event || [])"
          />

          <el-input
            v-else
            :model-value="String(modelValue[field.key] ?? '')"
            type="text"
            :placeholder="field.placeholder"
            :readonly="field.readonly"
            clearable
            @update:model-value="updateValue(field.key, $event)"
          />
        </el-form-item>
      </el-col>
    </el-row>
  </el-form>
</template>
