<script setup lang="ts">
defineProps<{ modelValue: string; options: { value: string; label: string }[]; disabled?: boolean; label: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <el-radio-group :model-value="modelValue" :disabled="disabled" :aria-label="label" class="group-tags" @update:model-value="emit('update:modelValue', String($event))">
    <el-radio v-for="option in options" :key="option.value" :value="option.value" border :title="option.label">{{ option.label }}</el-radio>
  </el-radio-group>
</template>

<style scoped>
.group-tags { display: flex; flex-wrap: wrap; gap: 8px; width: 100%; max-height: 168px; overflow-y: auto; padding: 2px; align-content: flex-start; }
.group-tags :deep(.el-radio) { margin: 0; max-width: 100%; height: auto; min-height: 32px; padding: 6px 10px; border-radius: 4px; }
.group-tags :deep(.el-radio__label) { white-space: normal; overflow-wrap: anywhere; line-height: 20px; min-width: 0; }
.group-tags :deep(.el-radio__input) { flex-shrink: 0; }
</style>
