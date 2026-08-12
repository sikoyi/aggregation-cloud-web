<script setup lang="ts">
import { Image as ImageIcon, Play } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import { http, resolveBackendUrl } from '@/api/http'
import type { AnyRecord } from '@/types/api'

const props = withDefaults(defineProps<{
  record: AnyRecord
  mode?: 'compact' | 'full'
  section?: 'all' | 'text' | 'media'
}>(), {
  mode: 'compact',
  section: 'all',
})

const loadedAssets = ref<AnyRecord[]>([])
const videoVisible = ref(false)
const videoUrl = ref('')
const videoTitle = ref('')
let requestId = 0

const assetIds = computed(() => (
  Array.isArray(props.record.material_asset_ids)
    ? props.record.material_asset_ids.map(String).filter(Boolean)
    : []
))
const embeddedAssets = computed(() => (
  Array.isArray(props.record.material_assets) ? props.record.material_assets : []
))
const assets = computed(() => embeddedAssets.value.length ? embeddedAssets.value : loadedAssets.value)
const visibleAssets = computed(() => props.mode === 'compact' ? assets.value.slice(0, 3) : assets.value)
const imageUrls = computed(() => assets.value
  .filter((asset) => assetKind(asset) === 'image')
  .map((asset) => assetUrl(asset))
  .filter(Boolean))
const textContent = computed(() => String(props.record.text_body || '').trim())

function assetKind(asset: AnyRecord) {
  const type = String(asset.asset_type || '').toLowerCase()
  const mime = String(asset.mime_type || '').toLowerCase()
  if (type === 'image' || mime.startsWith('image/')) return 'image'
  if (type === 'video' || mime.startsWith('video/')) return 'video'
  return 'other'
}

function assetUrl(asset: AnyRecord) {
  const rawUrl = String(asset.source_url || '').trim()
  return rawUrl && !rawUrl.startsWith('local://') ? resolveBackendUrl(rawUrl) : ''
}

function openVideo(asset: AnyRecord) {
  const url = assetUrl(asset)
  if (!url) return
  videoUrl.value = url
  videoTitle.value = String(asset.name || '视频预览')
  videoVisible.value = true
}

async function loadMissingAssets() {
  const currentRequest = ++requestId
  if (props.section === 'text' || !assetIds.value.length || embeddedAssets.value.length) {
    loadedAssets.value = []
    return
  }
  const settled = await Promise.allSettled(
    assetIds.value.map((id) => http.get<AnyRecord>(`/api/resource-center/media-assets/${encodeURIComponent(id)}`)),
  )
  if (currentRequest !== requestId) return
  loadedAssets.value = settled
    .filter((item): item is PromiseFulfilledResult<AnyRecord> => item.status === 'fulfilled')
    .map((item) => item.value)
}

watch(
  () => [assetIds.value.join(','), embeddedAssets.value],
  () => { void loadMissingAssets() },
  { immediate: true },
)
</script>

<template>
  <div :class="['content-preview', `content-preview--${mode}`, `content-preview--${section}`]">
    <div v-if="mode === 'full'" class="content-preview__heading">内容预览</div>
    <template v-if="section !== 'media'">
      <p v-if="textContent" class="content-preview__text">{{ textContent }}</p>
      <p v-else class="content-preview__empty">暂无文本正文</p>
    </template>

    <div v-if="section !== 'text' && visibleAssets.length" class="content-preview__assets">
      <template v-for="asset in visibleAssets" :key="String(asset.id)">
        <el-image
          v-if="assetKind(asset) === 'image' && assetUrl(asset)"
          class="content-preview__media"
          :src="assetUrl(asset)"
          :alt="String(asset.name || '内容图片')"
          :preview-src-list="imageUrls"
          preview-teleported
          fit="cover"
        />
        <button
          v-else-if="assetKind(asset) === 'video' && assetUrl(asset)"
          type="button"
          class="content-preview__video"
          :aria-label="`播放视频：${String(asset.name || '内容视频')}`"
          @click="openVideo(asset)"
        >
          <video :src="assetUrl(asset)" muted playsinline preload="metadata" />
          <span><Play class="h-4 w-4" /></span>
        </button>
        <div v-else class="content-preview__file" :title="String(asset.name || '关联素材')">
          <ImageIcon class="h-4 w-4" />
          <span>{{ asset.name || '关联素材' }}</span>
        </div>
      </template>
      <span v-if="mode === 'compact' && assets.length > visibleAssets.length" class="content-preview__more">
        +{{ assets.length - visibleAssets.length }}
      </span>
    </div>
    <p v-else-if="section === 'media'" class="content-preview__empty">暂无媒体资源</p>

    <el-dialog
      v-model="videoVisible"
      :title="videoTitle"
      width="min(92vw, 960px)"
      destroy-on-close
      append-to-body
    >
      <div class="content-preview__player">
        <video :src="videoUrl" controls autoplay playsinline preload="metadata" />
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.content-preview {
  min-width: 0;
}

.content-preview__heading {
  margin-bottom: 10px;
  color: #1f2933;
  font-size: 14px;
  font-weight: 700;
}

.content-preview__text {
  margin: 0;
  color: #334e68;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}

.content-preview--compact .content-preview__text {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  font-size: 13px;
}

.content-preview__empty {
  margin: 0;
  color: #94a3b8;
  font-size: 13px;
}

.content-preview__assets {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}

.content-preview__media,
.content-preview__video {
  width: 64px;
  height: 64px;
  border: 1px solid #d9e2ec;
  border-radius: 6px;
  background: #0f172a;
}

.content-preview--full .content-preview__media,
.content-preview--full .content-preview__video {
  width: 104px;
  height: 104px;
}

.content-preview__media {
  cursor: zoom-in;
}

.content-preview--media .content-preview__assets {
  justify-content: center;
}

.content-preview__video {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  overflow: hidden;
  cursor: pointer;
}

.content-preview__video video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.content-preview__video span {
  position: absolute;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  color: #fff;
  background: rgb(15 23 42 / 72%);
}

.content-preview__file {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 150px;
  height: 36px;
  padding: 0 10px;
  overflow: hidden;
  border: 1px solid #d9e2ec;
  border-radius: 6px;
  color: #52606d;
  background: #f8fafc;
  font-size: 12px;
}

.content-preview__file span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.content-preview__more {
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
}

.content-preview--compact.content-preview--media .content-preview__assets {
  flex-wrap: nowrap;
  justify-content: center;
  margin-top: 0;
}

.content-preview--compact.content-preview--media .content-preview__media,
.content-preview--compact.content-preview--media .content-preview__video {
  width: 58px;
  height: 58px;
}

.content-preview--compact.content-preview--media .content-preview__empty {
  display: inline-flex;
  min-height: 58px;
  align-items: center;
  justify-content: center;
}
.content-preview__player {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  max-height: 72vh;
  overflow: hidden;
  border-radius: 8px;
  background: #000;
}

.content-preview__player video {
  display: block;
  width: 100%;
  max-height: 72vh;
}
</style>
