<script setup lang="ts">
import { computed } from 'vue'

import ScriptParamEditor from '@/components/ScriptParamEditor.vue'
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

const visibleFields = computed(() => props.fields.filter((field) => !field.hidden))
</script>

<template>
  <el-form label-position="top" class="dynamic-form">
    <el-row :gutter="16">
      <el-col
        v-for="field in visibleFields"
        :key="field.key"
        :xs="24"
        :md="field.span === 2 || ['scriptParams', 'templateParams'].includes(field.type || '') ? 24 : 12"
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
