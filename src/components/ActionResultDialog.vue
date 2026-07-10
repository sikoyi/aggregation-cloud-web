<script setup lang="ts">
import { computed } from 'vue'

import JsonPreview from '@/components/JsonPreview.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import type { AnyRecord } from '@/types/api'
import type { ColumnConfig } from '@/types/crud'
import { formatCell, formatDate, getCellValue, statusLabel, truncateId } from '@/utils/format'

const props = defineProps<{
  modelValue: boolean
  title: string
  value: unknown
  columns?: ColumnConfig[]
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const KEY_LABELS: Record<string, string> = {
  id: 'ID',
  runtime_id: 'Runtime ID',
  runtime_instance_id: 'Runtime 实例',
  slot_id: '设备',
  display_name: '名称',
  provider_slot_id: 'Provider ID',
  provider_slot_no: 'Provider 编号',
  runtime_platform: '执行平台',
  provider: '供应商',
  business_platform: '平台',
  status: '状态',
  login_status: '登录状态',
  bound_account_id: '账号',
  proxy_id: '代理',
  current_task_run_id: '当前任务',
  checked_at: '检测时间',
  latency_ms: '延迟',
  exit_ip: '出口 IP',
  country: '国家/地区',
  region: '地区',
  city: '城市',
  isp: 'ISP',
  error_message: '错误信息',
  total_count: '检测总数',
  succeeded_count: '成功数量',
  failed_count: '失败数量',
  last_seen_at: '心跳',
  created_at: '创建时间',
  updated_at: '更新时间',
}

function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function visibleResultEntries(value: AnyRecord) {
  return Object.entries(value).filter(([key]) => !['proxy', 'detail'].includes(key))
}

const rawItems = computed(() => {
  if (Array.isArray(props.value)) return props.value
  if (isRecord(props.value) && Array.isArray(props.value.items)) return props.value.items
  return []
})

const rows = computed<AnyRecord[]>(() => rawItems.value.filter(isRecord))
const isTabularResult = computed(() => Array.isArray(props.value) || (isRecord(props.value) && Array.isArray(props.value.items)))

function inferColumnType(key: string): ColumnConfig['type'] {
  if (key === 'status' || key.endsWith('_status')) return 'status'
  if (key === 'id' || key.endsWith('_id')) return 'id'
  if (key.endsWith('_at')) return 'datetime'
  return 'text'
}

function inferColumns(row: AnyRecord): ColumnConfig[] {
  return Object.keys(row)
    .filter((key) => !['tenant_id', 'metadata', 'metadata_json'].includes(key))
    .slice(0, 8)
    .map((key) => ({
      key,
      label: KEY_LABELS[key] || key,
      type: inferColumnType(key),
      minWidth: key.endsWith('_at') ? 170 : 140,
    }))
}

const displayColumns = computed<ColumnConfig[]>(() => {
  if (props.columns?.length) return props.columns
  return rows.value.length ? inferColumns(rows.value[0]) : []
})

const detailEntries = computed(() => {
  if (!isRecord(props.value) || isTabularResult.value) return []
  return visibleResultEntries(props.value).filter(([, value]) => value === null || typeof value !== 'object')
})

const objectEntries = computed(() => {
  if (!isRecord(props.value) || isTabularResult.value) return []
  return visibleResultEntries(props.value).filter(([, value]) => value !== null && typeof value === 'object')
})

function close() {
  emit('update:modelValue', false)
}

function detailLabel(key: string) {
  return KEY_LABELS[key] || key
}

function detailValue(key: string, value: unknown) {
  if (value === undefined || value === null || value === '') return '-'
  if (key === 'status' || key.endsWith('_status')) return statusLabel(value)
  if (key.endsWith('_at')) return formatDate(value)
  if (key === 'latency_ms' || key.endsWith('_latency_ms')) return `${value} ms`
  return String(value)
}

function isLatencyKey(key: string) {
  return key === 'latency_ms' || key.endsWith('_latency_ms')
}

function isStatusKey(key: string) {
  return key === 'status' || key.endsWith('_status')
}

function isExitIpKey(key: string) {
  return key === 'exit_ip'
}

function latencyText(value: unknown) {
  if (value === undefined || value === null || value === '') return '-'
  return `${value} ms`
}

function latencyTagType(value: unknown) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return 'info'
  if (numberValue < 500) return 'success'
  if (numberValue < 1000) return 'warning'
  return 'danger'
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="title || '查看结果'"
    width="860px"
    destroy-on-close
    append-to-body
    @close="close"
  >
    <div v-loading="loading" class="result-dialog-body">
      <div v-if="loading" class="result-loading">正在检测，请稍候...</div>

      <el-table
        v-else-if="isTabularResult"
        :data="rows"
        border
        stripe
        table-layout="auto"
        empty-text="暂无数据"
        class="result-table"
      >
        <el-table-column
          v-for="column in displayColumns"
          :key="column.key"
          :prop="column.key"
          :label="column.label"
          :min-width="column.minWidth || 140"
          :width="column.width"
          :align="column.align || 'left'"
          :header-align="column.align || 'left'"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <StatusBadge v-if="column.type === 'status'" :value="getCellValue(row, column.key)" />
            <el-tag v-else-if="isLatencyKey(column.key)" :type="latencyTagType(getCellValue(row, column.key))" effect="light">
              {{ latencyText(getCellValue(row, column.key)) }}
            </el-tag>
            <el-tag v-else-if="isExitIpKey(column.key)" type="primary" effect="light">
              {{ formatCell(row, column) }}
            </el-tag>
            <span v-else-if="column.type === 'id'" :title="String(getCellValue(row, column.key) || '')" class="font-mono text-xs">
              {{ truncateId(getCellValue(row, column.key)) }}
            </span>
            <el-tag v-else-if="column.type === 'tag'" effect="plain" round>
              {{ formatCell(row, column) }}
            </el-tag>
            <span v-else>{{ formatCell(row, column) }}</span>
          </template>
        </el-table-column>
      </el-table>

      <div v-else-if="detailEntries.length || objectEntries.length" class="space-y-4">
        <el-descriptions :column="2" border>
          <el-descriptions-item v-for="[key, value] in detailEntries" :key="key" :label="detailLabel(key)">
            <StatusBadge v-if="isStatusKey(key)" :value="value" />
            <el-tag v-else-if="isLatencyKey(key)" :type="latencyTagType(value)" effect="light">
              {{ latencyText(value) }}
            </el-tag>
            <el-tag v-else-if="isExitIpKey(key)" type="primary" effect="light">
              {{ detailValue(key, value) }}
            </el-tag>
            <template v-else>{{ detailValue(key, value) }}</template>
          </el-descriptions-item>
        </el-descriptions>

        <el-collapse v-if="objectEntries.length">
          <el-collapse-item v-for="[key, value] in objectEntries" :key="key" :title="detailLabel(key)">
            <JsonPreview :value="value" />
          </el-collapse-item>
        </el-collapse>
      </div>

      <JsonPreview v-else :value="value" />
    </div>

    <template #footer>
      <el-button type="primary" @click="close">关闭</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.result-table {
  width: 100%;
}

.result-dialog-body {
  min-height: 180px;
}

.result-loading {
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
}
</style>
