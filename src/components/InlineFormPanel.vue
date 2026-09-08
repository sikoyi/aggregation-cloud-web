<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'
defineProps<{ modelValue: boolean; title?: string; showClose?: boolean }>()
defineEmits<{ close: [] }>()
</script>
<template>
  <section v-if="modelValue" class="inline-form-panel">
    <header><el-button :icon="ArrowLeft" :disabled="showClose === false" @click="$emit('close')">返回分组列表</el-button><strong>{{ title }}</strong></header>
    <slot />
    <footer><slot name="footer" /></footer>
  </section>
</template>
<style scoped>
.inline-form-panel { display: flex; min-width: 0; flex-direction: column; gap: 16px; }
header { display: flex; align-items: center; gap: 12px; }
footer { display: flex; justify-content: flex-end; gap: 8px; }
</style>
