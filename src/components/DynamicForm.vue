<script setup lang="ts">
import { ElMessage, type UploadFile } from 'element-plus'
import { computed, ref } from 'vue'

import { http } from '@/api/http'
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

const templateLoading = ref(false)

function updateValue(key: string, value: unknown) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

async function updateTemplateValue(field: FieldConfig, value: string | string[]) {
  const templateId = Array.isArray(value) ? String(value[0] || '') : String(value || '')
  if (!templateId || !field.remote?.detailPath) {
    emit('update:modelValue', { ...props.modelValue, [field.key]: templateId })
    return
  }

  templateLoading.value = true
  try {
    const template = await http.get<AnyRecord>(field.remote.detailPath(templateId))
    emit('update:modelValue', {
      ...props.modelValue,
      [field.key]: templateId,
      script_key: template.script_key || '',
      business_platform: template.business_platform || '',
      runtime_platform: template.runtime_platform || '',
      provider: template.provider || '',
      execution_mode: template.execution_mode || '',
      execution_count: Number(template.execution_count || 1),
      params: template.default_params || {},
      slot_ids: [],
    })
  } finally {
    templateLoading.value = false
  }
}

function dependencyValue(field: FieldConfig) {
  return String(props.modelValue[field.dependencyKey || 'script_key'] || '')
}

function timeRangeValue(value: unknown) {
  return Array.isArray(value) ? value.map(String) : []
}

function textLineCount(value: unknown) {
  return String(value || '')
    .split(/\r?\n/)
    .filter((line) => line.trim()).length
}

async function readTextFile(field: FieldConfig, uploadFile: UploadFile) {
  const file = uploadFile.raw
  if (!file) return
  if (!file.name.toLowerCase().endsWith('.txt')) {
    ElMessage.warning('只支持 .txt 文件')
    return
  }

  try {
    updateValue(field.key, await file.text())
    ElMessage.success('文件已读取')
  } catch {
    ElMessage.error('读取文件失败')
  }
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
            v-else-if="field.type === 'templateSelect' && field.remote"
            :model-value="modelValue[field.key]"
            :config="field.remote"
            :disabled="field.readonly || templateLoading"
            :placeholder="field.placeholder"
            @update:model-value="updateTemplateValue(field, $event)"
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

          <div v-else-if="field.type === 'textImport'" class="text-import-field">
            <div class="text-import-field__toolbar">
              <el-upload
                :auto-upload="false"
                :show-file-list="false"
                accept=".txt,text/plain"
                :on-change="(file) => readTextFile(field, file)"
              >
                <el-button>选择 .txt 文件</el-button>
              </el-upload>
              <el-tag v-if="textLineCount(modelValue[field.key])" size="small" type="info" effect="plain">
                {{ textLineCount(modelValue[field.key]) }} 行
              </el-tag>
            </div>
            <el-input
              :model-value="String(modelValue[field.key] ?? '')"
              type="textarea"
              :rows="10"
              :placeholder="field.placeholder"
              :readonly="field.readonly"
              resize="vertical"
              @update:model-value="updateValue(field.key, $event)"
            />
          </div>

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

<style scoped>
.text-import-field {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.text-import-field__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
</style>
