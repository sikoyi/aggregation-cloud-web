<script setup lang="ts">
import { CalendarClock, CheckSquare2, Clock3, Cpu } from 'lucide-vue-next'
import { computed } from 'vue'

import { businessPlatformOptions, providerOptions, runtimePlatformOptions } from '@/config/options'
import type { AnyRecord } from '@/types/api'
import type { ColumnConfig } from '@/types/crud'
import { formatDate } from '@/utils/format'

type TaskCellKind = 'taskIdentity' | 'taskPlatform' | 'taskTimeline'

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

const taskTitle = computed(() => text(props.row.title))
const taskId = computed(() => text(props.row.id))
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
      <span>任务 #{{ taskId }}</span>
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

  <div v-else class="task-cell task-timeline">
    <div class="task-timeline__row">
      <CalendarClock />
      <span><small>创建</small><strong>{{ formatDate(row.created_at) }}</strong></span>
    </div>
    <div class="task-timeline__row task-timeline__row--secondary">
      <Clock3 />
      <span><small>结束</small><strong>{{ formatDate(row.finished_at) }}</strong></span>
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
.task-platform { display: flex; flex-direction: column; gap: 7px; }
.task-platform__primary { display: flex; align-items: center; gap: 6px; color: #334e68; }
.task-platform__primary svg { width: 14px; height: 14px; color: #527a98; }
.task-platform__primary strong { font-size: 12px; }
.task-platform__tags { display: flex; flex-wrap: wrap; gap: 5px; }
.task-timeline { display: flex; flex-direction: column; gap: 6px; }
.task-timeline__row { display: flex; min-width: 0; align-items: center; gap: 7px; }
.task-timeline__row > svg { width: 13px; height: 13px; flex: 0 0 13px; color: #4f8b68; }
.task-timeline__row > span { display: grid; min-width: 0; grid-template-columns: 28px minmax(0, 1fr); align-items: center; gap: 5px; }
.task-timeline__row small { color: #8a9aab; font-size: 10px; }
.task-timeline__row strong { overflow: hidden; color: #40566c; font-size: 11px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.task-timeline__row--secondary > svg { color: #8a9aab; }
</style>
