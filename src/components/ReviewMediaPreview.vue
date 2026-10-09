<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ExternalLink } from 'lucide-vue-next'

const props = defineProps<{ url: string }>()
const failed = ref(false)
const safeUrl = computed(() => {
  try {
    const url = new URL(props.url)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''
  } catch { return '' }
})
const video = computed(() => Boolean(safeUrl.value) && /\.(mp4|webm|mov|m4v|ogg)$/i.test(new URL(safeUrl.value).pathname))
watch(() => props.url, () => { failed.value = false })
</script>

<template>
  <div class="review-media-preview">
    <div v-if="!safeUrl || failed" class="media-error" role="status">{{ safeUrl ? '媒体加载失败' : '媒体链接无效' }}</div>
    <video v-else-if="video" :src="safeUrl" controls playsinline preload="metadata" aria-label="视频预览" @error="failed = true" />
    <el-image v-else :src="safeUrl" fit="contain" loading="lazy" :preview-src-list="[safeUrl]" preview-teleported @error="failed = true" />
    <a v-if="safeUrl" :href="safeUrl" target="_blank" rel="noopener noreferrer" class="media-link"><ExternalLink :size="12" />打开媒体</a>
  </div>
</template>

<style scoped>
.review-media-preview { width: 100%; height: 100%; display: flex; flex-direction: column; gap: 4px; }
.review-media-preview video, .review-media-preview .el-image, .media-error { width: 100%; flex: 1; min-height: 0; border: 1px solid var(--el-border-color); border-radius: 4px; object-fit: contain; }
.media-error { display: flex; align-items: center; justify-content: center; text-align: center; font-size: 12px; color: var(--el-text-color-secondary); }
.media-link { display: flex; align-items: center; justify-content: center; gap: 4px; font-size: 12px; color: var(--el-color-primary); white-space: nowrap; }
</style>
