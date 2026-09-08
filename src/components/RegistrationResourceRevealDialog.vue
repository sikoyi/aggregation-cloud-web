<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import { revealRegistrationResource, type RegistrationResourcePlaintext, type RegistrationResourceTemplateField } from '@/api/registrationResources'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ batchId: string; resourceId: string; fields: RegistrationResourceTemplateField[] }>()
const emit = defineEmits<{ close: [] }>()
const auth = useAuthStore()
const canReveal = computed(() => auth.can('registration_resources.reveal'))
const data = ref<RegistrationResourcePlaintext | null>(null)
const loading = ref(false)
const error = ref('')
let requestId = 0

const rows = computed(() => Object.entries(data.value?.payload || {}).map(([key, value]) => ({
  key,
  label: props.fields.find((field) => field.field_key === key)?.display_name || key,
  value: value == null || value === '' ? '-' : typeof value === 'object' ? JSON.stringify(value) : String(value),
})))

function close() {
  requestId += 1
  data.value = null
  error.value = ''
  emit('close')
}

async function load() {
  if (!canReveal.value) { close(); return }
  const id = ++requestId
  data.value = null
  error.value = ''
  loading.value = true
  try {
    const result = await revealRegistrationResource(props.batchId, props.resourceId)
    if (id === requestId && canReveal.value) data.value = result
  } catch (err) {
    if (id === requestId) error.value = err instanceof Error ? err.message : '资料原文加载失败'
  } finally {
    if (id === requestId) loading.value = false
  }
}

watch(() => [props.batchId, props.resourceId], load, { immediate: true })
watch(canReveal, (allowed) => { if (!allowed) close() })
onBeforeUnmount(() => { requestId += 1; data.value = null })
</script>

<template>
  <el-dialog :model-value="true" :title="data ? `注册资料原文 · 第 ${data.row_number} 行` : '注册资料原文'"
    width="min(680px, calc(100vw - 24px))" append-to-body destroy-on-close @close="close">
    <div v-loading="loading" class="resource-plaintext">
      <div v-if="error" class="reveal-error" role="alert">
        <span>{{ error }}</span>
        <el-tooltip content="重新加载" placement="top"><el-button :icon="RefreshCw" aria-label="重新加载" circle @click="load" /></el-tooltip>
      </div>
      <el-descriptions v-else-if="data" :column="1" border>
        <el-descriptions-item v-for="row in rows" :key="row.key" :label="row.label" label-class-name="resource-field-label">
          <span class="resource-field-value">{{ row.value }}</span>
        </el-descriptions-item>
      </el-descriptions>
    </div>
    <template #footer><el-button @click="close">关闭</el-button></template>
  </el-dialog>
</template>

<style scoped>
.resource-plaintext { min-height: 140px; max-height: 65vh; overflow: auto; }
.resource-plaintext :deep(.el-descriptions__table) { table-layout: fixed; }
.resource-plaintext :deep(.resource-field-label) { width: 100px; overflow-wrap: anywhere; }
.resource-field-value { white-space: pre-wrap; overflow-wrap: anywhere; }
.reveal-error { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.reveal-error span { min-width: 0; overflow-wrap: anywhere; }
</style>
