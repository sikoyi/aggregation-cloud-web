<script setup lang="ts">
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-vue-next'

defineProps<{ index: number; count: number; scope: string; disabled?: boolean }>()
const emit = defineEmits<{ move: [from: number, to: number]; start: [event: DragEvent, index: number]; end: [] }>()
</script>

<template>
  <div class="external-order" :data-order-index="index">
    <el-tooltip content="拖动排序"><button type="button" class="external-order__handle" :draggable="!disabled" :disabled="disabled" aria-label="拖动排序" @dragstart="emit('start', $event, index)" @dragend="emit('end')"><GripVertical :size="16" /></button></el-tooltip>
    <el-tooltip content="上移"><el-button text circle :icon="ArrowUp" aria-label="上移" :disabled="disabled || index === 0" @click="emit('move', index, index - 1)" /></el-tooltip>
    <el-tooltip content="下移"><el-button text circle :icon="ArrowDown" aria-label="下移" :disabled="disabled || index === count - 1" @click="emit('move', index, index + 1)" /></el-tooltip>
  </div>
</template>

<style scoped>
.external-order { display: flex; align-items: center; width: 100px; min-height: 36px; }
.external-order :deep(.el-button) { margin-left: 0; }
.external-order__handle { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 32px; padding: 0; flex-shrink: 0; background: transparent; border: 0; color: var(--el-text-color-secondary); cursor: grab; }
.external-order__handle:active { cursor: grabbing; }
.external-order__handle:disabled { cursor: not-allowed; opacity: .45; }
.external-order__handle:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: -2px; }
</style>
