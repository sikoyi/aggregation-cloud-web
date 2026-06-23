<script setup lang="ts">
import { computed } from 'vue'

import { statusTone } from '@/utils/format'

const props = defineProps<{
  value: unknown
}>()

const text = computed(() => String(props.value || '-'))
</script>

<template>
  <span class="badge" :class="statusTone(value)">{{ text }}</span>
</template>
