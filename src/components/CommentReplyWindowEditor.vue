<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next'
import { validReplyWindows, type CommentReplyWindow } from '@/api/commentReplySchedule'

const props = defineProps<{ modelValue: CommentReplyWindow[]; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [CommentReplyWindow[]] }>()
function update(index: number, range: string[] | null) {
  if (!range || range.length !== 2) return
  emit('update:modelValue', props.modelValue.map((window, i) => i === index ? { start: range[0]!, end: range[1]! } : window))
}
</script>

<template>
  <div class="reply-windows">
    <div v-for="(window, index) in modelValue" :key="index" class="reply-window">
      <el-time-picker :model-value="window.start" format="HH:mm" value-format="HH:mm"
        :clearable="false" :disabled="disabled" :aria-label="`评论回复开始 ${index + 1}`" @update:model-value="update(index, [$event, window.end])" />
      <span>至</span>
      <el-time-picker :model-value="window.end" format="HH:mm" value-format="HH:mm"
        :clearable="false" :disabled="disabled" :aria-label="`评论回复结束 ${index + 1}`" @update:model-value="update(index, [window.start, $event])" />
      <span v-if="window.end < window.start" class="reply-window__overnight">次日</span>
      <el-tooltip content="删除时间范围"><el-button :icon="Trash2" :disabled="disabled" :aria-label="`删除时间范围 ${index + 1}`"
        @click="emit('update:modelValue', modelValue.filter((_, i) => i !== index))" /></el-tooltip>
    </div>
    <el-button :icon="Plus" :disabled="disabled || modelValue.length >= 24" @click="emit('update:modelValue', [...modelValue, { start: '09:00', end: '11:00' }])">添加时间范围</el-button>
    <span v-if="modelValue.length && !validReplyWindows(modelValue)" class="reply-window__error">开始和结束不能相同，各时间范围不能重叠</span>
  </div>
</template>

<style scoped>
.reply-windows { display: grid; gap: 10px; width: 100%; min-width: 0; }
.reply-window { display: flex; align-items: center; gap: 8px; min-width: 0; }
.reply-window :deep(.el-date-editor) { flex: 1; min-width: 0; width: 0; }
.reply-window :deep(.el-button) { flex: 0 0 32px; width: 32px; padding: 0; }
.reply-window__overnight { flex-shrink: 0; font-size: 12px; color: var(--app-text-muted); }
.reply-window__error { font-size: 13px; color: var(--el-color-warning); }
</style>
