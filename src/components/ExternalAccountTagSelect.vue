<script setup lang="ts">
import { GripVertical, Plus } from 'lucide-vue-next'
import { useExternalOrderDrag } from '@/composables/useExternalOrderDrag'
const props = defineProps<{ modelValue: string[]; options: { value: string; label: string }[]; disabled?: boolean; label: string; reorderable?: boolean; creatable?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string[]]; move: [from: number, to: number]; create: [] }>()
const drag = useExternalOrderDrag(() => props.options.map(option => option.value), () => !!props.disabled || !props.reorderable, (from, to) => emit('move', from, to))
</script>

<template>
  <el-checkbox-group :model-value="modelValue" :disabled="disabled" :aria-label="label" class="group-tags" @update:model-value="emit('update:modelValue', $event.map(String))">
    <div v-for="(option, index) in options" :key="option.value" class="group-tags__item" :class="{ 'is-sortable': reorderable, 'is-drop-target': drag.target.value === index }" @dragover="drag.over($event, index)" @drop="drag.drop($event, index)">
      <button v-if="reorderable" type="button" class="group-tags__handle" :aria-label="`调整${option.label}顺序`" :draggable="!disabled" :disabled="disabled" @dragstart="drag.start($event, index)" @dragend="drag.end" @keydown.alt.left.prevent="index > 0 && emit('move', index, index - 1)" @keydown.alt.up.prevent="index > 0 && emit('move', index, index - 1)" @keydown.alt.right.prevent="index < options.length - 1 && emit('move', index, index + 1)" @keydown.alt.down.prevent="index < options.length - 1 && emit('move', index, index + 1)"><GripVertical :size="14" /></button>
      <el-checkbox :value="option.value" :border="!reorderable" :title="option.label">{{ option.label }}</el-checkbox>
    </div>
    <el-tooltip v-if="creatable" content="新增标签"><el-button class="group-tags__add" :icon="Plus" :disabled="disabled" aria-label="新增标签" @click="emit('create')" /></el-tooltip>
    <span v-if="!options.length" class="empty-tags">暂无账号标签</span>
  </el-checkbox-group>
</template>

<style scoped>
.group-tags { display: flex; flex-wrap: wrap; gap: 8px; width: 100%; max-height: 168px; overflow-y: auto; padding: 2px; align-content: flex-start; }
.group-tags :deep(.el-checkbox) { margin: 0; max-width: 100%; height: auto; min-height: 32px; padding: 6px 10px; border-radius: 4px; }
.group-tags :deep(.el-checkbox__label) { white-space: normal; overflow-wrap: anywhere; line-height: 20px; min-width: 0; }
.group-tags :deep(.el-checkbox__input) { flex-shrink: 0; }
.empty-tags { color: var(--el-text-color-secondary); }
.group-tags__item { display: inline-flex; align-items: stretch; max-width: 100%; min-width: 0; }
.group-tags__item.is-sortable { border: 1px solid var(--el-border-color); border-radius: 4px; }
.group-tags__item.is-drop-target { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); box-shadow: inset 2px 0 var(--el-color-primary); }
.group-tags__handle { display: inline-flex; justify-content: center; align-items: center; width: 22px; flex-shrink: 0; border: 0; border-right: 1px solid var(--el-border-color-lighter); background: transparent; color: var(--el-text-color-secondary); cursor: grab; padding: 0; }
.group-tags__handle:active { cursor: grabbing; }
.group-tags__handle:disabled { cursor: not-allowed; opacity: .45; }
.group-tags__handle:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: -2px; }
.group-tags__add { width: 34px; height: 34px; padding: 0; margin: 0; flex-shrink: 0; }
</style>
