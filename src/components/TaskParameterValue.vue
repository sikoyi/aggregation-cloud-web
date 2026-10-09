<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ value: unknown }>()
const entries = computed(() => props.value !== null && typeof props.value === 'object'
  ? Object.entries(props.value) : null)
const text = computed(() => props.value === null ? 'null' : String(props.value ?? ''))
</script>

<template>
  <details v-if="entries" class="parameter-node">
    <summary>{{ Array.isArray(value) ? '数组' : '对象' }} · {{ entries.length }} 项</summary>
    <dl>
      <div v-for="[key, item] in entries" :key="key" class="parameter-entry">
        <dt>{{ key }}</dt><dd><TaskParameterValue :value="item" /></dd>
      </div>
    </dl>
  </details>
  <details v-else-if="text.length > 100 || text.includes('\n')" class="parameter-node">
    <summary><span class="parameter-summary">{{ text.slice(0, 100) }}</span><span>展开</span></summary>
    <pre>{{ text }}</pre>
  </details>
  <span v-else class="parameter-text">{{ text }}</span>
</template>

<style scoped>
.parameter-node { min-width: 0; }
summary { cursor: pointer; overflow-wrap: anywhere; }
.parameter-summary { display: inline; margin-right: 8px; white-space: pre-wrap; }
summary > span:last-child { color: var(--el-color-primary); }
dl { margin: 8px 0 0; padding-left: 12px; border-left: 2px solid var(--el-border-color); }
.parameter-entry { margin: 8px 0; min-width: 0; }
dt { font-weight: 600; overflow-wrap: anywhere; }
dd { margin: 4px 0 0; min-width: 0; }
pre, .parameter-text { white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; font: inherit; }
pre { max-height: 280px; overflow-y: auto; margin: 8px 0; }
</style>
