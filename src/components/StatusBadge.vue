<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  value: unknown
}>()

const text = computed(() => String(props.value || '-'))
const type = computed(() => {
  const value = text.value.toLowerCase()
  if (['enabled', 'normal', 'idle', 'online', 'queued', 'succeeded', 'logged_in'].includes(value)) {
    return 'success'
  }
  if (['running', 'dispatching', 'starting', 'waiting_slot', 'waiting_runtime'].includes(value)) {
    return 'primary'
  }
  if (['disabled', 'offline', 'archived', 'canceled'].includes(value)) {
    return 'info'
  }
  if (['failed', 'error', 'expired', 'lost', 'restricted'].includes(value)) {
    return 'danger'
  }
  return 'warning'
})
</script>

<template>
  <el-tag :type="type" effect="light" round>{{ text }}</el-tag>
</template>
