<script setup lang="ts">
import { computed } from 'vue'
import { ExternalLink } from 'lucide-vue-next'
import type { AnyRecord } from '@/types/api'

const props = defineProps<{ job: AnyRecord }>()
const postUrl = computed(() => {
  try {
    const url = new URL(String(props.job.content_url || ''))
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''
  } catch { return '' }
})
</script>

<template>
  <section class="reply-post">
    <strong v-if="job.content_title">{{ job.content_title }}</strong>
    <p v-if="job.content_text && job.content_text !== job.content_title">{{ job.content_text }}</p>
    <span v-if="!job.content_title && !job.content_text" class="reply-post__empty">暂无帖子正文</span>
    <el-link v-if="postUrl" :href="postUrl" target="_blank" rel="noopener noreferrer" type="primary" :icon="ExternalLink">打开原帖</el-link>
    <span v-else class="reply-post__empty">暂无帖子链接</span>
  </section>
</template>

<style scoped>
.reply-post { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; min-width: 0; overflow-wrap: anywhere; }
.reply-post strong, .reply-post p { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 3; margin: 0; white-space: pre-line; line-height: 1.55; }
.reply-post strong { -webkit-line-clamp: 2; }
.reply-post__empty { color: #66788a; font-size: 12px; }
.reply-post :deep(.el-link__inner) { display: inline-flex; align-items: center; gap: 4px; }
</style>
