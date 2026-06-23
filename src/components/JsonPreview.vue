<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  value: unknown
}>()

const pretty = computed(() => JSON.stringify(props.value ?? {}, null, 2))
</script>

<template>
  <pre class="max-h-80 overflow-auto rounded-md border border-line bg-slate-950 p-3 text-xs leading-5 text-slate-100">{{ pretty }}</pre>
</template>
