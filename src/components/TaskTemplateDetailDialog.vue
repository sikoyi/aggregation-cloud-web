<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RefreshCw } from 'lucide-vue-next'

import { http } from '@/api/http'
import StatusBadge from '@/components/StatusBadge.vue'
import { businessPlatformOptions, executionModeOptions, providerOptions, runtimePlatformOptions } from '@/config/options'
import type { AnyRecord } from '@/types/api'
import type { SelectOption } from '@/types/crud'
import { formatDate } from '@/utils/format'
import { getErrorMessage } from '@/utils/notify'

const props = defineProps<{ templateId: string }>()
const emit = defineEmits<{ close: [] }>()
const template = ref<AnyRecord | null>(null)
const script = ref<AnyRecord | null>(null)
const definitions = ref<AnyRecord[]>([])
const loading = ref(false)
const error = ref('')
const parameterWarning = ref('')
let requestId = 0
const compact = ref(false)
const media = window.matchMedia('(max-width: 600px)')
function updateCompact() { compact.value = media.matches }
onMounted(() => { updateCompact(); media.addEventListener('change', updateCompact) })

function label(options: SelectOption[], value: unknown) {
  return options.find((option) => option.value === value)?.label || String(value || '-')
}

const parameterRows = computed(() => Object.entries(template.value?.default_params || {}).map(([key, value]) => {
  const definition = definitions.value.find((item) => item.param_key === key)
  return {
    key,
    name: definition?.name || key,
    value: value === null ? '-' : typeof value === 'object' ? JSON.stringify(value) : String(value),
  }
}))

async function loadDetail() {
  const id = ++requestId
  template.value = null
  script.value = null
  definitions.value = []
  error.value = ''
  parameterWarning.value = ''
  loading.value = true
  try {
    const detail = await http.get<AnyRecord>(`/api/task-templates/${encodeURIComponent(props.templateId)}`)
    if (id !== requestId) return
    template.value = detail
    try {
      const scriptDetail = await http.get<AnyRecord>(`/api/task-script-options/by-key/${encodeURIComponent(String(detail.script_key))}`)
      if (id !== requestId) return
      script.value = scriptDetail
      const data = await http.get<AnyRecord[]>(`/api/task-script-options/${scriptDetail.id}/params`)
      if (id === requestId) definitions.value = data
    } catch {
      if (id === requestId) parameterWarning.value = '脚本定义暂不可用，默认参数按原字段展示'
    }
  } catch (err) {
    if (id === requestId) error.value = getErrorMessage(err, '加载模板详情失败')
  } finally {
    if (id === requestId) loading.value = false
  }
}

watch(() => props.templateId, loadDetail, { immediate: true })
onBeforeUnmount(() => { requestId += 1; media.removeEventListener('change', updateCompact) })
</script>

<template>
  <el-dialog :model-value="true" title="任务模板详情" width="min(880px, calc(100vw - 24px))"
    append-to-body destroy-on-close @close="emit('close')">
    <div v-loading="loading" class="template-detail">
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <template v-else-if="template">
        <el-descriptions :column="compact ? 1 : 2" border>
          <el-descriptions-item label="模板名称">{{ template.name }}</el-descriptions-item>
          <el-descriptions-item label="模板 ID">{{ template.id }}</el-descriptions-item>
          <el-descriptions-item label="创建人">
            {{ template.creator_display_name || template.creator_username || (template.created_by ? `ID ${template.created_by}` : '未记录') }}
            <span v-if="template.creator_username" class="template-detail__secondary">@{{ template.creator_username }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="状态"><StatusBadge :value="template.status" /></el-descriptions-item>
          <el-descriptions-item label="关联脚本">{{ script?.name || template.script_name || '脚本已删除或不可用' }}</el-descriptions-item>
          <el-descriptions-item label="业务平台">{{ label(businessPlatformOptions, template.business_platform) }}</el-descriptions-item>
          <el-descriptions-item label="执行平台">{{ label(runtimePlatformOptions, template.runtime_platform) }}</el-descriptions-item>
          <el-descriptions-item label="供应商">{{ label(providerOptions, template.provider) }}</el-descriptions-item>
          <el-descriptions-item label="执行模式">{{ label(executionModeOptions, template.execution_mode) }}</el-descriptions-item>
          <el-descriptions-item label="每台设备执行次数">{{ template.execution_count }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDate(template.created_at) }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{ formatDate(template.updated_at) }}</el-descriptions-item>
          <el-descriptions-item label="描述" :span="compact ? 1 : 2">{{ template.description || '-' }}</el-descriptions-item>
        </el-descriptions>
        <h3>默认参数</h3>
        <el-alert v-if="parameterWarning" :title="parameterWarning" type="warning" :closable="false" />
        <el-table v-if="parameterRows.length" :data="parameterRows" border stripe>
          <el-table-column prop="name" label="参数" width="160" />
          <el-table-column prop="value" label="值" class-name="template-detail__value" />
        </el-table>
        <el-empty v-else description="暂无默认参数" :image-size="56" />
      </template>
    </div>
    <template #footer>
      <el-button v-if="error || parameterWarning" :icon="RefreshCw" :loading="loading" @click="loadDetail">重试</el-button>
      <el-button @click="emit('close')">关闭</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.template-detail { min-height: 120px; max-height: 65vh; overflow: auto; }
.template-detail h3 { margin: 18px 0 10px; font-size: 14px; }
.template-detail__secondary { display: block; color: #8293a5; font-size: 12px; }
.template-detail :deep(.el-descriptions__table) { table-layout: fixed; }
.template-detail :deep(.el-descriptions__content),
.template-detail :deep(.template-detail__value .cell) { overflow-wrap: anywhere; white-space: pre-wrap; }
</style>
