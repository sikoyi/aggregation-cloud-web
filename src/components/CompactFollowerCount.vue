<script setup lang="ts">
import { computed } from 'vue'
import { formatCompactCount } from '@/utils/compactCount'
const props = defineProps<{ value: unknown }>()
const count = computed(() => formatCompactCount(props.value))
</script>

<template>
  <el-popover v-if="count.expandable" trigger="click" placement="top" :width="200">
    <span class="follower-count__full">粉丝：{{ count.full }}</span>
    <template #reference>
      <button type="button" class="follower-count" title="点击查看完整粉丝数" :aria-label="`查看完整粉丝数（${count.compact}）`">{{ count.compact }}</button>
    </template>
  </el-popover>
  <span v-else>{{ count.compact }}</span>
</template>

<style scoped>
.follower-count { padding: 0; border: 0; background: none; color: inherit; font: inherit; font-variant-numeric: tabular-nums; cursor: pointer; text-decoration: underline dotted; text-underline-offset: 4px; }
.follower-count:focus-visible { outline: 2px solid var(--app-blue, #32688d); outline-offset: 3px; }
.follower-count__full { overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
</style>
