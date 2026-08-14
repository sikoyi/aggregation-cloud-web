<script setup lang="ts">
import { AppWindow, Building2, Clock3, Code2, Layers3, Monitor, UserRoundCog } from 'lucide-vue-next'
import { computed } from 'vue'

import {
  businessPlatformOptions,
  providerOptions,
  runtimePlatformOptions,
  scriptPurposeOptions,
  scriptAccountUsageModeOptions,
} from '@/config/options'
import type { AnyRecord } from '@/types/api'
import type { ColumnConfig, SelectOption } from '@/types/crud'

type ScriptCellKind = 'scriptIdentity' | 'scriptScope' | 'scriptTimeout' | 'scriptTimeline'

const props = defineProps<{
  kind: ScriptCellKind
  row: AnyRecord
  column: ColumnConfig
}>()

function text(value: unknown) {
  return value === undefined || value === null || value === '' ? '-' : String(value)
}

function optionLabel(options: SelectOption[], value: unknown) {
  return options.find((item) => String(item.value) === String(value))?.label || text(value)
}

function optionLabels(options: SelectOption[], value: unknown) {
  const values = Array.isArray(value) ? value : value ? [value] : []
  if (!values.length) return '未设置'
  return values.map((item) => optionLabel(options, item)).join(' / ')
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

function timeoutLabel(value: unknown) {
  const seconds = Number(value || 0)
  if (!Number.isFinite(seconds) || seconds <= 0) return '-'
  if (seconds % 3600 === 0) return `${seconds / 3600} 小时`
  if (seconds % 60 === 0) return `${seconds / 60} 分钟`
  return `${seconds} 秒`
}

const updatedAt = computed(() => compactDate(props.row.updated_at))
</script>

<template>
  <div v-if="kind === 'scriptIdentity'" class="script-cell script-identity">
    <span class="script-identity__icon"><Code2 /></span>
    <span class="script-identity__content">
      <el-tooltip :content="text(row.name)" placement="top" :show-after="500">
        <strong>{{ text(row.name) }}</strong>
      </el-tooltip>
      <span class="script-identity__meta">
        <code :title="text(row.script_key)">{{ text(row.script_key) }}</code>
      </span>
    </span>
  </div>

  <div v-else-if="kind === 'scriptScope'" class="script-cell script-scope">
    <div class="script-scope__purpose">
      <Layers3 />
      <strong>{{ optionLabel(scriptPurposeOptions, row.purpose) }}</strong>
    </div>
    <div class="script-scope__items">
      <span :title="optionLabel(scriptAccountUsageModeOptions, row.account_usage_mode)">
        <UserRoundCog />{{ optionLabel(scriptAccountUsageModeOptions, row.account_usage_mode) }}
      </span>
      <span :title="optionLabels(businessPlatformOptions, row.supported_business_platforms)">
        <AppWindow />{{ optionLabels(businessPlatformOptions, row.supported_business_platforms) }}
      </span>
      <span :title="optionLabels(runtimePlatformOptions, row.supported_runtime_platforms)">
        <Monitor />{{ optionLabels(runtimePlatformOptions, row.supported_runtime_platforms) }}
      </span>
      <span :title="optionLabels(providerOptions, row.supported_providers)">
        <Building2 />{{ optionLabels(providerOptions, row.supported_providers) }}
      </span>
    </div>
  </div>

  <div v-else-if="kind === 'scriptTimeout'" class="script-cell script-timeout">
    <Clock3 />
    <span>
      <strong>{{ timeoutLabel(row.max_timeout_seconds) }}</strong>
      <small>最大超时</small>
    </span>
  </div>

  <div v-else class="script-cell script-timeline">
    <Clock3 />
    <span>
      <strong>{{ updatedAt.date }}</strong>
      <small>{{ updatedAt.time || '更新时间' }}</small>
    </span>
  </div>
</template>

<style scoped>
.script-cell { min-width: 0; }
.script-identity { display: flex; align-items: center; gap: 10px; }
.script-identity__icon { display: inline-flex; width: 36px; height: 36px; flex: 0 0 36px; align-items: center; justify-content: center; border: 1px solid #cfe1f2; border-radius: 8px; color: #245f87; background: #edf6fc; }
.script-identity__icon svg { width: 18px; height: 18px; }
.script-identity__content { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 5px; }
.script-identity__content > strong { overflow: hidden; color: #243b53; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.script-identity__meta { display: flex; min-width: 0; align-items: center; gap: 7px; }
.script-identity__meta code { overflow: hidden; padding: 2px 6px; border: 1px solid #cfe1f2; border-radius: 4px; color: #24658f; background: #f2f8fc; font-size: 11px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.script-scope { display: flex; flex-direction: column; gap: 7px; }
.script-scope__purpose { display: flex; align-items: center; gap: 6px; color: #334e68; }
.script-scope__purpose svg { width: 14px; height: 14px; color: #527a98; }
.script-scope__purpose strong { font-size: 12px; }
.script-scope__items { display: flex; min-width: 0; flex-wrap: wrap; gap: 5px; }
.script-scope__items span { display: inline-flex; max-width: 100%; align-items: center; gap: 4px; overflow: hidden; padding: 2px 6px; border: 1px solid #dbe6ee; border-radius: 4px; color: #587087; background: #f8fafc; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.script-scope__items svg { width: 11px; height: 11px; flex: 0 0 11px; }
.script-timeout,
.script-timeline { display: flex; align-items: center; justify-content: center; gap: 7px; }
.script-timeout > svg,
.script-timeline > svg { width: 14px; height: 14px; flex: 0 0 14px; color: #527a98; }
.script-timeout > span,
.script-timeline > span { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.script-timeout strong,
.script-timeline strong { overflow: hidden; color: #40566c; font-size: 11px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.script-timeout small,
.script-timeline small { color: #8a9aab; font-size: 10px; white-space: nowrap; }
</style>
