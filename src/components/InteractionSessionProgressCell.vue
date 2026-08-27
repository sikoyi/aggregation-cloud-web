<script setup lang="ts">
import { computed } from 'vue'

import type { AnyRecord } from '@/types/api'

const props = defineProps<{
  row: AnyRecord
}>()

const finished = computed(() => Math.max(0, Number(props.row.step_finished || 0)))
const total = computed(() => Math.max(0, Number(props.row.step_total || 0)))
const percentage = computed(() => (
  total.value > 0
    ? Math.min(100, Math.round((finished.value / total.value) * 100))
    : 0
))
const progressColor = computed(() => percentage.value >= 100 ? '#67c23a' : '#409eff')

function formatProgress() {
  return `${finished.value}/${total.value}`
}
</script>

<template>
  <div class="interaction-progress">
    <el-progress
      :percentage="percentage"
      :stroke-width="8"
      :color="progressColor"
      :format="formatProgress"
    />
  </div>
</template>

<style scoped>
.interaction-progress {
  width: 100%;
  min-width: 120px;
}

.interaction-progress :deep(.el-progress__text) {
  min-width: 42px;
  color: #526578;
  font-size: 12px !important;
}
</style>
