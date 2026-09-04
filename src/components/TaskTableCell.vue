<script setup lang="ts">
import { Ban, CalendarClock, CheckCircle2, CheckSquare2, CircleX, Clock3, Cpu, UserRound } from 'lucide-vue-next'
import { computed } from 'vue'

import { businessPlatformOptions, providerOptions, runtimePlatformOptions } from '@/config/options'
import type { AnyRecord } from '@/types/api'
import type { ColumnConfig } from '@/types/crud'

type TaskCellKind = 'taskIdentity' | 'taskOperator' | 'taskPlatform' | 'taskResult' | 'taskTimeline'

const props = defineProps<{
  kind: TaskCellKind
  row: AnyRecord
  column: ColumnConfig
}>()

function text(value: unknown) {
  return value === undefined || value === null || value === '' ? '-' : String(value)
}

function optionLabel(options: Array<{ label: string; value: unknown }>, value: unknown) {
  return options.find((item) => String(item.value) === String(value))?.label || text(value)
}

function compactDate(value: unknown) {
  if (!value) return '-'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  const part = (number: number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())} ${part(date.getHours())}:${part(date.getMinutes())}`
}

const taskTitle = computed(() => text(props.row.title))
const taskId = computed(() => text(props.row.id))
const creatorName = computed(() => text(
  props.row.creator_display_name || props.row.creator_username || props.row.created_by,
))
const creatorSecondary = computed(() => {
  const username = String(props.row.creator_username || '').trim()
  const displayName = String(props.row.creator_display_name || '').trim()
  if (username && username !== displayName) return `@${username}`
  if (!username && props.row.created_by) return `ID ${props.row.created_by}`
  return ''
})
const businessPlatform = computed(() => optionLabel(businessPlatformOptions, props.row.business_platform))
const runtimePlatform = computed(() => optionLabel(runtimePlatformOptions, props.row.runtime_platform))
const provider = computed(() => optionLabel(providerOptions, props.row.provider))
</script>

<template>
  <div v-if="kind === 'taskIdentity'" class="task-cell task-identity">
    <span class="task-identity__icon"><CheckSquare2 /></span>
    <span class="task-identity__content">
      <el-tooltip :content="taskTitle" placement="top" :show-after="500">
        <strong>{{ taskTitle }}</strong>
      </el-tooltip>
      <span :title="`任务 ID ${taskId}`">ID {{ taskId }}</span>
    </span>
  </div>

  <div v-else-if="kind === 'taskOperator'" class="task-cell task-operator">
    <span class="task-operator__icon"><UserRound /></span>
    <span class="task-operator__content">
      <strong>{{ creatorName }}</strong>
      <span v-if="creatorSecondary">{{ creatorSecondary }}</span>
    </span>
  </div>

  <div v-else-if="kind === 'taskPlatform'" class="task-cell task-platform">
    <div class="task-platform__primary">
      <Cpu />
      <strong>{{ businessPlatform }}</strong>
    </div>
    <div class="task-platform__tags">
      <el-tag size="small" type="primary" effect="light">{{ runtimePlatform }}</el-tag>
      <el-tag size="small" effect="plain">{{ provider }}</el-tag>
    </div>
  </div>

  <div v-else-if="kind === 'taskResult'" class="task-cell task-result">
    <div class="task-result__counts">
      <span class="task-result__count task-result__count--success" title="成功数量">
        <CheckCircle2 />成功 <strong>{{ Number(row.child_succeeded || 0) }}</strong>
      </span>
      <span class="task-result__count task-result__count--failed" title="失败数量">
        <CircleX />失败 <strong>{{ Number(row.child_failed || 0) }}</strong>
      </span>
      <span class="task-result__count task-result__count--canceled" title="取消数量">
        <Ban />取消 <strong>{{ Number(row.child_canceled || 0) }}</strong>
      </span>
    </div>
  </div>

  <div v-else class="task-cell task-timeline">
    <div class="task-timeline__row">
      <CalendarClock />
      <span><small>创建</small><strong>{{ compactDate(row.created_at) }}</strong></span>
    </div>
    <div class="task-timeline__row task-timeline__row--secondary">
      <Clock3 />
      <span><small>结束</small><strong>{{ compactDate(row.finished_at) }}</strong></span>
    </div>
  </div>
</template>

<style scoped>
.task-cell { min-width: 0; }
.task-identity { display: flex; align-items: center; gap: 10px; }
.task-identity__icon { display: inline-flex; width: 36px; height: 36px; flex: 0 0 36px; align-items: center; justify-content: center; border: 1px solid #cfe1f2; border-radius: 8px; color: #245f87; background: #edf6fc; }
.task-identity__icon svg { width: 18px; height: 18px; }
.task-identity__content { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
.task-identity__content strong,
.task-identity__content span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.task-identity__content strong { color: #243b53; font-size: 13px; }
.task-identity__content span { color: #8293a5; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; }
.task-operator { display: flex; align-items: center; gap: 8px; }
.task-operator__icon { display: inline-flex; width: 30px; height: 30px; flex: 0 0 30px; align-items: center; justify-content: center; border-radius: 8px; color: #3f6f8f; background: #edf5fa; }
.task-operator__icon svg { width: 15px; height: 15px; }
.task-operator__content { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.task-operator__content strong,
.task-operator__content span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.task-operator__content strong { color: #334e68; font-size: 12px; }
.task-operator__content span { color: #8293a5; font-size: 11px; }
.task-platform { display: flex; flex-direction: column; gap: 7px; }
.task-platform__primary { display: flex; align-items: center; gap: 6px; color: #334e68; white-space: nowrap; }
.task-platform__primary svg { width: 14px; height: 14px; color: #527a98; }
.task-platform__primary strong { font-size: 12px; }
.task-platform__tags { display: flex; flex-wrap: nowrap; gap: 5px; white-space: nowrap; }
.task-platform__tags :deep(.el-tag) { flex: 0 0 auto; }
.task-result { display: flex; align-items: center; justify-content: center; padding: 0 8px; }
.task-result__counts { display: flex; align-items: center; justify-content: center; gap: 12px; white-space: nowrap; }
.task-result__count { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; line-height: 20px; }
.task-result__count svg { width: 13px; height: 13px; flex: 0 0 13px; }
.task-result__count strong { font-size: 13px; font-weight: 700; }
.task-result__count--success { color: #3e7c55; }
.task-result__count--failed { color: #c04b4b; }
.task-result__count--canceled { color: #7c8794; }
.task-timeline { display: flex; flex-direction: column; gap: 6px; }
.task-timeline__row { display: flex; min-width: 0; align-items: center; gap: 7px; }
.task-timeline__row > svg { width: 13px; height: 13px; flex: 0 0 13px; color: #4f8b68; }
.task-timeline__row > span { display: grid; min-width: 0; grid-template-columns: 28px minmax(0, 1fr); align-items: center; gap: 5px; }
.task-timeline__row small { color: #8a9aab; font-size: 10px; }
.task-timeline__row strong { color: #40566c; font-size: 11px; font-weight: 600; white-space: nowrap; }
.task-timeline__row--secondary > svg { color: #8a9aab; }
</style>
