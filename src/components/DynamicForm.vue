<script setup lang="ts">
import { ElMessage, type UploadFile } from 'element-plus'
import { computed, ref, watch } from 'vue'

import { http } from '@/api/http'
import AccountTreeSelect from '@/components/AccountTreeSelect.vue'
import ScriptParamEditor from '@/components/ScriptParamEditor.vue'
import SlotTreeSelect from '@/components/SlotTreeSelect.vue'
import TemplateParamsEditor from '@/components/TemplateParamsEditor.vue'
import RemoteSelect from '@/components/RemoteSelect.vue'
import type { AnyRecord } from '@/types/api'
import type { FieldConfig } from '@/types/crud'

const props = defineProps<{
  fields: FieldConfig[]
  modelValue: AnyRecord
  context?: AnyRecord
}>()

const emit = defineEmits<{
  'update:modelValue': [value: AnyRecord]
}>()

const templateLoading = ref(false)
const scriptScopeLoading = ref(false)
const scriptScope = ref<AnyRecord | null>(null)
const hasScriptScopeFields = computed(() => props.fields.some((field) => Boolean(field.scriptScopeKey)))
const scriptScopeDependency = computed(() => String(props.modelValue.script_key || ''))

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
    })
  } finally {
    templateLoading.value = false
  }
}

function isDisabledByRule(field: FieldConfig) {
  if (!field.disabledWhen) return false
  const current = String(props.modelValue[field.disabledWhen.key] ?? '')
  const values = Array.isArray(field.disabledWhen.value)
    ? field.disabledWhen.value.map(String)
    : [String(field.disabledWhen.value)]
  return values.includes(current)
}

function isFieldDisabled(field: FieldConfig) {
  return Boolean(
    field.readonly
      || isDisabledByRule(field)
      || (field.scriptScopeKey && (!scriptScopeDependency.value || scriptScopeLoading.value)),
  )
}

function fieldOptions(field: FieldConfig) {
  if (!field.scriptScopeKey) return field.options || []

  const rawValues = scriptScope.value?.[field.scriptScopeKey]
  const values = Array.isArray(rawValues)
    ? rawValues.map((value) => String(value)).filter(Boolean)
    : []
  const configured = new Map((field.options || []).map((option) => [String(option.value), option]))
  return values.map((value) => configured.get(value) || { label: value, value })
}

function applyScriptScopeDefaults(scope: AnyRecord | null) {
  if (!scope) return

  const updates: AnyRecord = {}
  for (const field of props.fields) {
    if (!field.scriptScopeKey) continue

    const rawScopeValues = scope[field.scriptScopeKey]
    const values = Array.isArray(rawScopeValues)
      ? rawScopeValues.map((value) => String(value)).filter(Boolean)
      : []
    if (!values.length) continue

    if (field.multiple) {
      const rawCurrent = props.modelValue[field.key]
      const current = Array.isArray(rawCurrent)
        ? rawCurrent.map((value) => String(value))
        : []
      const retained = current.filter((value) => values.includes(value))
      const next = retained.length ? retained : [values[0]]
      if (next.join('|') !== current.join('|')) updates[field.key] = next
    } else {
      const current = String(props.modelValue[field.key] || '')
      if (!values.includes(current)) updates[field.key] = values[0]
    }
  }

  if (Object.keys(updates).length) {
    emit('update:modelValue', { ...props.modelValue, ...updates })
  }
}

async function loadScriptScope(scriptKey: string) {
  if (!hasScriptScopeFields.value) return
  if (!scriptKey) {
    scriptScope.value = null
    return
  }

  scriptScopeLoading.value = true
  try {
    const detail = await http.get<AnyRecord>(`/api/scripts/by-key/${encodeURIComponent(scriptKey)}`)
    scriptScope.value = detail
    applyScriptScopeDefaults(detail)
  } catch {
    scriptScope.value = null
    ElMessage.error('加载脚本支持范围失败')
  } finally {
    scriptScopeLoading.value = false
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

function selectedFileName(value: unknown) {
  return value instanceof File ? value.name : ''
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

function updateFile(field: FieldConfig, uploadFile: UploadFile) {
  updateValue(field.key, uploadFile.raw || null)
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
const fieldContext = computed(() => ({
  ...(props.context || {}),
  ...props.modelValue,
}))

function fieldColumnSpan(field: FieldConfig) {
  if (field.span === 2 || ['datetimeRange', 'scriptParams', 'templateParams', 'slotTree', 'textImport', 'file'].includes(field.type || '')) return 24
  return 12
}

watch(scriptScopeDependency, (scriptKey) => {
  void loadScriptScope(scriptKey)
}, { immediate: true })

watch(() => props.modelValue.execution_mode, (mode) => {
  if (mode === 'immediate' && Array.isArray(props.modelValue.execution_window) && props.modelValue.execution_window.length) {
    updateValue('execution_window', [])
  }
}, { immediate: true })
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
            :disabled="isFieldDisabled(field)"
            :filters="{
              business_platform: modelValue.business_platform,
              runtime_platform: modelValue.runtime_platform,
              provider: modelValue.provider,
            }"
            @update:model-value="updateValue(field.key, $event)"
          />

          <AccountTreeSelect
            v-else-if="field.type === 'accountTree'"
            :model-value="modelValue[field.key]"
            :disabled="isFieldDisabled(field)"
            :multiple="field.multiple !== false"
            :filters="{
              business_platform: modelValue.business_platform,
              runtime_platform: modelValue.runtime_platform,
              provider: modelValue.provider,
              exclude_account_id: field.key === 'comment_account_ids' ? modelValue.main_account_id : undefined,
            }"
            @update:model-value="updateValue(field.key, $event)"
          />

          <RemoteSelect
            v-else-if="field.type === 'templateSelect' && field.remote"
            :model-value="modelValue[field.key]"
            :config="field.remote"
            :context="fieldContext"
            :disabled="isFieldDisabled(field) || templateLoading"
            :placeholder="field.placeholder"
            @update:model-value="updateTemplateValue(field, $event)"
          />

          <RemoteSelect
            v-else-if="field.type === 'remoteSelect' && field.remote"
            :model-value="modelValue[field.key]"
            :config="field.remote"
            :context="fieldContext"
            :disabled="isFieldDisabled(field)"
            :placeholder="field.placeholder"
            @update:model-value="updateValue(field.key, $event)"
          />

          <el-input
            v-else-if="field.type === 'textarea' || field.type === 'json'"
            :model-value="String(modelValue[field.key] ?? '')"
            type="textarea"
            :rows="field.type === 'json' ? 8 : 4"
            :placeholder="field.placeholder"
            :readonly="isFieldDisabled(field)"
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
                :disabled="isFieldDisabled(field)"
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
              :readonly="isFieldDisabled(field)"
              resize="vertical"
              @update:model-value="updateValue(field.key, $event)"
            />
          </div>

          <div v-else-if="field.type === 'file'" class="file-field">
            <el-upload
              :auto-upload="false"
              :show-file-list="false"
              :disabled="isFieldDisabled(field)"
              :on-change="(file) => updateFile(field, file)"
            >
              <el-button>选择文件</el-button>
            </el-upload>
            <el-tag v-if="selectedFileName(modelValue[field.key])" type="info" effect="plain">
              {{ selectedFileName(modelValue[field.key]) }}
            </el-tag>
            <span v-else class="text-xs text-slate-400">{{ field.placeholder || '请选择要上传的文件' }}</span>
          </div>

          <el-select
            v-else-if="field.type === 'select'"
            :model-value="selectValue(field)"
            :disabled="isFieldDisabled(field)"
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
              v-for="option in fieldOptions(field)"
              :key="String(option.value)"
              :label="option.label"
              :value="String(option.value)"
            />
          </el-select>

          <el-switch
            v-else-if="field.type === 'boolean'"
            :model-value="Boolean(modelValue[field.key])"
            :disabled="isFieldDisabled(field)"
            active-text="是"
            inactive-text="否"
            @update:model-value="updateValue(field.key, $event)"
          />

          <el-input-number
            v-else-if="field.type === 'number'"
            :model-value="Number(modelValue[field.key] || 0)"
            :disabled="isFieldDisabled(field)"
            class="w-full"
            controls-position="right"
            @update:model-value="updateValue(field.key, $event)"
          />

          <el-date-picker
            v-else-if="field.type === 'datetime'"
            :model-value="String(modelValue[field.key] ?? '')"
            :disabled="isFieldDisabled(field)"
            class="w-full"
            type="datetime"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DDTHH:mm:ss"
            :placeholder="field.placeholder || '选择日期时间'"
            clearable
            @update:model-value="updateValue(field.key, $event)"
          />

          <el-date-picker
            v-else-if="field.type === 'datetimeRange'"
            :model-value="timeRangeValue(modelValue[field.key])"
            :disabled="isFieldDisabled(field)"
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
            :disabled="isFieldDisabled(field)"
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
            :readonly="isFieldDisabled(field)"
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

.file-field {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
</style>
