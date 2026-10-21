<script setup lang="ts">
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-vue-next'

const props = defineProps<{ index: number; count: number; scope: string; disabled?: boolean }>()
const emit = defineEmits<{ move: [from: number, to: number] }>()
function start(event: DragEvent) {
  if (props.disabled || !event.dataTransfer) { event.preventDefault(); return }
  event.dataTransfer.setData('text/plain', JSON.stringify({ scope: props.scope, index: props.index }))
  event.dataTransfer.effectAllowed = 'move'
}
function drop(event: DragEvent) {
  if (props.disabled) return
  try {
    const value = JSON.parse(event.dataTransfer?.getData('text/plain') || '{}')
    if (value.scope === props.scope && Number.isInteger(value.index) && value.index >= 0 && value.index < props.count && value.index !== props.index) emit('move', value.index, props.index)
  } catch { /* Ignore unrelated drag content. */ }
}
</script>

<template>
  <div class="external-order" @dragover.prevent @drop.prevent="drop">
    <el-tooltip content="拖动排序"><span :draggable="!disabled" @dragstart="start"><el-button text circle :icon="GripVertical" aria-label="拖动排序" :disabled="disabled" /></span></el-tooltip>
    <el-tooltip content="上移"><el-button text circle :icon="ArrowUp" aria-label="上移" :disabled="disabled || index === 0" @click="emit('move', index, index - 1)" /></el-tooltip>
    <el-tooltip content="下移"><el-button text circle :icon="ArrowDown" aria-label="下移" :disabled="disabled || index === count - 1" @click="emit('move', index, index + 1)" /></el-tooltip>
  </div>
</template>

<style scoped>
.external-order { display: flex; align-items: center; width: 100px; min-height: 36px; }
.external-order :deep(.el-button) { margin-left: 0; }
.external-order span[draggable=true] { cursor: grab; }
</style>
