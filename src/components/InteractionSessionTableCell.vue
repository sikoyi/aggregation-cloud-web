<script setup lang="ts">
import { ExternalLink } from 'lucide-vue-next'
import { computed } from 'vue'

import type { AnyRecord } from '@/types/api'

const props = defineProps<{
  row: AnyRecord
}>()

const targetUrl = computed(() => String(props.row.target_content_url || '').trim())
const platformContentId = computed(() => String(props.row.target_platform_content_id || '').trim())
const isSquareInteraction = computed(() => String(props.row.interaction_mode || '') === 'square_numeric')
const targetTitle = computed(() => String(
  props.row.target_content_title
    || platformContentId.value
    || (isSquareInteraction.value ? '广场实时内容' : '目标内容未命名'),
).trim())
</script>

<template>
  <div class="interaction-target-content">
    <el-link
      v-if="targetUrl"
      :href="targetUrl"
      target="_blank"
      rel="noopener noreferrer"
      type="primary"
      :underline="false"
    >
      <strong :title="targetTitle">{{ targetTitle }}</strong>
      <ExternalLink />
    </el-link>
    <span v-else class="interaction-target-content__plain" :title="targetTitle">
      {{ targetTitle }}
    </span>
  </div>
</template>

<style scoped>
.interaction-target-content { display: flex; min-width: 0; justify-content: center; }
.interaction-target-content :deep(.el-link) { display: inline-flex; max-width: 100%; }
.interaction-target-content :deep(.el-link__inner) { display: flex; min-width: 0; align-items: center; gap: 6px; }
.interaction-target-content :deep(svg) { width: 14px; height: 14px; flex: 0 0 14px; }
.interaction-target-content strong,
.interaction-target-content__plain { display: block; overflow: hidden; max-width: 100%; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.interaction-target-content__plain { color: #526578; }
</style>
