<script setup lang="ts">
defineProps<{ modelValue: string[]; options: { value: string; label: string }[]; disabled?: boolean; label: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()
</script>

<template>
  <el-checkbox-group :model-value="modelValue" :disabled="disabled" :aria-label="label" class="group-tags" @update:model-value="emit('update:modelValue', $event.map(String))">
    <el-checkbox v-for="option in options" :key="option.value" :value="option.value" border :title="option.label">{{ option.label }}</el-checkbox>
    <span v-if="!options.length" class="empty-tags">暂无账号标签</span>
  </el-checkbox-group>
</template>

<style scoped>
.group-tags { display: flex; flex-wrap: wrap; gap: 8px; width: 100%; max-height: 168px; overflow-y: auto; padding: 2px; align-content: flex-start; }
.group-tags :deep(.el-checkbox) { margin: 0; max-width: 100%; height: auto; min-height: 32px; padding: 6px 10px; border-radius: 4px; }
.group-tags :deep(.el-checkbox__label) { white-space: normal; overflow-wrap: anywhere; line-height: 20px; min-width: 0; }
.group-tags :deep(.el-checkbox__input) { flex-shrink: 0; }
.empty-tags { color: var(--el-text-color-secondary); }
</style>
