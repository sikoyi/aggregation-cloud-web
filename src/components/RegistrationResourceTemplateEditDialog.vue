<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { RefreshCw } from 'lucide-vue-next'

import {
  getRegistrationResourceTemplate,
  updateRegistrationResourceTemplate,
  type RegistrationResourceTemplate,
  type RegistrationResourceTemplateField,
} from '@/api/registrationResources'
import { businessPlatformLabel } from '@/config/options'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ templateId: string }>()
const emit = defineEmits<{ close: []; saved: [template: RegistrationResourceTemplate] }>()
const auth = useAuthStore()
const canManage = computed(() => auth.can('registration_resources.manage_templates'))
const template = ref<RegistrationResourceTemplate | null>(null)
const fields = ref<RegistrationResourceTemplateField[]>([])
const loading = ref(false)
const submitting = ref(false)
const error = ref('')
let requestId = 0

const changes = computed(() => fields.value
  .filter((field) => template.value?.fields.find((item) => item.field_key === field.field_key)?.required !== field.required)
  .map((field) => ({ field_key: field.field_key, required: field.required })))

function close() {
  if (submitting.value) return
  requestId += 1
  emit('close')
}

async function load() {
  if (!canManage.value) { close(); return }
  const id = ++requestId
  loading.value = true
  error.value = ''
  template.value = null
  fields.value = []
  try {
    const result = await getRegistrationResourceTemplate(props.templateId)
    if (id !== requestId || !canManage.value) return
    template.value = result
    fields.value = result.fields.map((field) => ({ ...field }))
  } catch (err) {
    if (id === requestId) error.value = err instanceof Error ? err.message : '模板加载失败'
  } finally {
    if (id === requestId) loading.value = false
  }
}

async function save() {
  if (!canManage.value || !template.value || submitting.value || loading.value || !changes.value.length) return
  const id = requestId
  submitting.value = true
  error.value = ''
  try {
    const result = await updateRegistrationResourceTemplate(template.value.id, {
      field_requirements: changes.value,
    })
    if (id !== requestId || !canManage.value) return
    emit('saved', result)
    ElMessage.success('模板必填规则已保存')
    emit('close')
  } catch (err) {
    if (id === requestId) error.value = err instanceof Error ? err.message : '模板保存失败'
  } finally {
    if (id === requestId) submitting.value = false
  }
}

watch(() => props.templateId, load, { immediate: true })
watch(canManage, (allowed) => { if (!allowed) { requestId += 1; emit('close') } })
onBeforeUnmount(() => { requestId += 1 })
</script>

<template>
  <el-dialog :model-value="true" title="编辑注册资源模板" width="min(860px, calc(100vw - 24px))"
    align-center append-to-body destroy-on-close :close-on-click-modal="false"
    :close-on-press-escape="!submitting" :show-close="!submitting" @close="close">
    <div v-loading="loading" class="template-editor">
      <div v-if="error" class="template-editor-error" role="alert">
        <span>{{ error }}</span>
        <el-tooltip v-if="!template" content="重新加载" placement="top">
          <el-button :icon="RefreshCw" circle aria-label="重新加载" :disabled="loading" @click="load" />
        </el-tooltip>
      </div>
      <template v-if="template">
        <div class="template-editor-heading">
          <strong>{{ template.name }}</strong>
          <span>{{ businessPlatformLabel(template.business_platform) }} · {{ template.template_key }} / v{{ template.version }}</span>
        </div>
        <el-table :data="fields" row-key="field_key" border max-height="min(440px, calc(100dvh - 280px))">
          <el-table-column prop="display_name" label="列名称" min-width="150" show-overflow-tooltip />
          <el-table-column prop="field_key" label="字段 Key" min-width="180" show-overflow-tooltip />
          <el-table-column label="类型" width="90" align="center">
            <template #default="{ row }">{{ row.data_type === 'date' ? '日期' : '文本' }}</template>
          </el-table-column>
          <el-table-column label="敏感" width="80" align="center">
            <template #default="{ row }">{{ row.sensitive ? '是' : '否' }}</template>
          </el-table-column>
          <el-table-column label="是否必填" width="110" align="center" fixed="right">
            <template #default="{ row }">
              <el-checkbox v-model="row.required" :disabled="submitting || !canManage" :aria-label="`${row.display_name}是否必填`" />
            </template>
          </el-table-column>
        </el-table>
      </template>
    </div>
    <template #footer>
      <el-button :disabled="submitting" @click="close">取消</el-button>
      <el-button type="primary" :loading="submitting" :disabled="loading || !canManage || !changes.length" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.template-editor { min-height: 140px; min-width: 0; }
.template-editor-heading { display: grid; gap: 4px; margin-bottom: 16px; overflow-wrap: anywhere; }
.template-editor-heading strong { font-size: 14px; color: #25374b; }
.template-editor-heading span { font-size: 12px; color: #64748b; }
.template-editor-error { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; color: #dc2626; }
.template-editor-error span { min-width: 0; overflow-wrap: anywhere; }
</style>
