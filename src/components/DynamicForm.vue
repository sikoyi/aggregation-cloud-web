<script setup lang="ts">
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
</script>

<template>
  <el-form label-position="top" class="dynamic-form">
    <el-row :gutter="16">
      <el-col
        v-for="field in fields"
        :key="field.key"
        :xs="24"
        :md="field.span === 2 ? 24 : 12"
      >
        <el-form-item :required="field.required" :label="field.label">
          <el-input
            v-if="field.type === 'textarea' || field.type === 'json'"
            :model-value="String(modelValue[field.key] ?? '')"
            :type="field.type === 'json' ? 'textarea' : 'textarea'"
            :rows="field.type === 'json' ? 8 : 4"
            :placeholder="field.placeholder"
            :readonly="field.readonly"
            :class="field.type === 'json' ? 'font-mono text-xs' : ''"
            resize="vertical"
            @update:model-value="updateValue(field.key, $event)"
          />

          <el-select
            v-else-if="field.type === 'select'"
            :model-value="String(modelValue[field.key] ?? '')"
            :disabled="field.readonly"
            clearable
            filterable
            class="w-full"
            placeholder="请选择"
            @update:model-value="updateValue(field.key, $event)"
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

          <el-input
            v-else
            :model-value="String(modelValue[field.key] ?? '')"
            :type="field.type === 'datetime' ? 'datetime-local' : 'text'"
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
