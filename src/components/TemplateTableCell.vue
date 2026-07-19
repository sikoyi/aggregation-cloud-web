<script setup lang="ts">
import { AppWindow, CalendarClock, ClipboardList, Monitor, Play, Repeat2 } from 'lucide-vue-next'
import { computed } from 'vue'

import {
  businessPlatformOptions,
  executionModeOptions,
  providerOptions,
  runtimePlatformOptions,
} from '@/config/options'
import type { AnyRecord } from '@/types/api'
import type { ColumnConfig, SelectOption } from '@/types/crud'

type TemplateCellKind = 'templateIdentity' | 'templateConfig' | 'templateTimeline'

const props = defineProps<{
  kind: TemplateCellKind
  row: AnyRecord
  column: ColumnConfig
}>()

function text(value: unknown) {
  return value === undefined || value === null || value === '' ? '-' : String(value)
}

function optionLabel(options: SelectOption[], value: unknown) {
  return options.find((item) => String(item.value) === String(value))?.label || text(value)
}

function compactDate(value: unknown) {
  if (!value) return { date: '-', time: '' }
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return { date: String(value), time: '' }
  const part = (number: number) => String(number).padStart(2, '0')
  return {
    date: `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}`,
    time: `${part(date.getHours())}:${part(date.getMinutes())}`,
  }
}

const updatedAt = computed(() => compactDate(props.row.updated_at))
</script>

<template>
  <div v-if="kind === 'templateIdentity'" class="template-cell template-identity">
    <span class="template-identity__icon"><ClipboardList /></span>
    <span class="template-identity__content">
      <el-tooltip :content="text(row.name)" placement="top" :show-after="500">
        <strong>{{ text(row.name) }}</strong>
      </el-tooltip>
      <small>模板 #{{ text(row.id) }}</small>
    </span>
  </div>

  <div v-else-if="kind === 'templateConfig'" class="template-cell template-config">
    <div class="template-config__environment">
      <span><AppWindow />{{ optionLabel(businessPlatformOptions, row.business_platform) }}</span>
      <span><Monitor />{{ optionLabel(runtimePlatformOptions, row.runtime_platform) }}</span>
      <span>{{ optionLabel(providerOptions, row.provider) }}</span>
    </div>
    <div class="template-config__execution">
      <span><Play />{{ optionLabel(executionModeOptions, row.execution_mode) }}</span>
      <span><Repeat2 />每台 {{ Number(row.execution_count || 1) }} 次</span>
    </div>
  </div>

  <div v-else class="template-cell template-timeline">
    <CalendarClock />
    <span>
      <strong>{{ updatedAt.date }}</strong>
      <small>{{ updatedAt.time || '更新时间' }}</small>
    </span>
  </div>
</template>

<style scoped>
.template-cell { min-width: 0; }
.template-identity { display: flex; align-items: center; gap: 9px; }
.template-identity__icon { display: inline-flex; width: 34px; height: 34px; flex: 0 0 34px; align-items: center; justify-content: center; border: 1px solid #d5e3ee; border-radius: 7px; color: #426f91; background: #f1f7fb; }
.template-identity__icon svg { width: 17px; height: 17px; }
.template-identity__content { display: flex; min-width: 0; flex-direction: column; gap: 4px; }
.template-identity__content strong { overflow: hidden; color: #243b53; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.template-identity__content small { color: #8798a8; font-size: 10px; }
.template-config { display: flex; flex-direction: column; gap: 7px; }
.template-config__environment,
.template-config__execution { display: flex; min-width: 0; align-items: center; gap: 5px; overflow: hidden; }
.template-config__environment span,
.template-config__execution span { display: inline-flex; min-width: 0; align-items: center; gap: 4px; overflow: hidden; padding: 2px 6px; border: 1px solid #dbe6ee; border-radius: 4px; color: #587087; background: #f8fafc; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.template-config__environment span:first-child { border-color: #cfe1f2; color: #24658f; background: #f2f8fc; }
.template-config__execution span:first-child { border-color: #d7e8dc; color: #3e7c55; background: #f3faf5; }
.template-config svg { width: 11px; height: 11px; flex: 0 0 11px; }
.template-timeline { display: flex; align-items: center; justify-content: center; gap: 7px; }
.template-timeline > svg { width: 14px; height: 14px; flex: 0 0 14px; color: #527a98; }
.template-timeline > span { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.template-timeline strong { color: #40566c; font-size: 11px; font-weight: 700; white-space: nowrap; }
.template-timeline small { color: #8a9aab; font-size: 10px; }
</style>
