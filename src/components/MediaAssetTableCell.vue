<script setup lang="ts">
import { Clock3, Film, Image as ImageIcon, Layers3, Maximize2, Tags } from 'lucide-vue-next'
import { computed } from 'vue'

import { businessPlatformOptions, mediaAssetTypeOptions } from '@/config/options'
import type { AnyRecord } from '@/types/api'
import type { ColumnConfig, SelectOption } from '@/types/crud'

type MediaAssetCellKind =
  | 'mediaAssetIdentity'
  | 'mediaAssetPreview'
  | 'mediaAssetGroups'
  | 'mediaAssetPlatform'
  | 'mediaAssetType'
  | 'mediaAssetSpec'
  | 'mediaAssetTimeline'

const props = defineProps<{
  kind: MediaAssetCellKind
  row: AnyRecord
  column: ColumnConfig
  previewUrl?: string
}>()

const emit = defineEmits<{ preview: [] }>()

function text(value: unknown) {
  return value === undefined || value === null || value === '' ? '-' : String(value)
}

function optionLabel(options: SelectOption[], value: unknown) {
  return options.find((item) => String(item.value) === String(value))?.label || text(value)
}

function compactDate(value: unknown) {
  if (!value) return '-'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  const part = (number: number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())} ${part(date.getHours())}:${part(date.getMinutes())}`
}

function fileSize(value: unknown) {
  const bytes = Number(value)
  if (!Number.isFinite(bytes) || bytes <= 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}

const assetType = computed(() => String(props.row.asset_type || 'image'))
const assetTags = computed(() => {
  const values = Array.isArray(props.row.tags) ? props.row.tags : []
  return values.map((item) => String(item).trim()).filter(Boolean)
})
const groupNames = computed(() => {
  const values = Array.isArray(props.row.group_names) ? props.row.group_names : []
  return values.map((item) => String(item).trim()).filter(Boolean)
})
const dimensions = computed(() => {
  const width = Number(props.row.width)
  const height = Number(props.row.height)
  return width > 0 && height > 0 ? `${width} × ${height}` : ''
})
const timelineValue = computed(() => compactDate(props.row[props.column.key]))
</script>

<template>
  <div v-if="kind === 'mediaAssetIdentity'" class="asset-cell asset-identity">
    <span class="asset-identity__main">
      <el-tooltip :content="text(row.name)" placement="top" :show-after="500">
        <strong>{{ text(row.name) }}</strong>
      </el-tooltip>
      <span class="asset-identity__meta">
        <code>#{{ text(row.id) }}</code>
        <template v-if="assetTags.length">
          <el-tag v-for="tag in assetTags.slice(0, 2)" :key="tag" size="small" effect="plain" round>
            {{ tag }}
          </el-tag>
          <small v-if="assetTags.length > 2">+{{ assetTags.length - 2 }}</small>
        </template>
        <span v-else class="asset-identity__empty"><Tags />暂无标签</span>
      </span>
    </span>
  </div>

  <div v-else-if="kind === 'mediaAssetPreview'" class="asset-cell asset-preview">
    <button
      type="button"
      class="asset-preview__button"
      :class="{ 'is-empty': !previewUrl }"
      :disabled="!previewUrl"
      :aria-label="'预览素材：' + text(row.name)"
      @click="emit('preview')"
    >
      <img v-if="assetType === 'image' && previewUrl" :src="previewUrl" :alt="text(row.name)" />
      <video v-else-if="assetType === 'video' && previewUrl" :src="previewUrl" muted playsinline preload="metadata" />
      <Film v-else-if="assetType === 'video'" />
      <ImageIcon v-else />
      <span v-if="previewUrl" class="asset-preview__zoom"><Maximize2 /></span>
    </button>
  </div>

  <div v-else-if="kind === 'mediaAssetGroups'" class="asset-cell asset-groups">
    <template v-if="groupNames.length">
      <el-tag v-for="group in groupNames.slice(0, 3)" :key="group" type="primary" effect="plain" round>
        <Layers3 /><span>{{ group }}</span>
      </el-tag>
      <small v-if="groupNames.length > 3">+{{ groupNames.length - 3 }}</small>
    </template>
    <el-tag v-else type="info" effect="plain" round>未分组</el-tag>
  </div>

  <div v-else-if="kind === 'mediaAssetPlatform'" class="asset-cell asset-property">
    <el-tag type="primary" effect="light" round>
      {{ optionLabel(businessPlatformOptions, row.business_platform) }}
    </el-tag>
  </div>

  <div v-else-if="kind === 'mediaAssetType'" class="asset-cell asset-property">
    <el-tag :type="assetType === 'video' ? 'warning' : 'success'" effect="plain" round>
      <Film v-if="assetType === 'video'" />
      <ImageIcon v-else />
      {{ optionLabel(mediaAssetTypeOptions, row.asset_type) }}
    </el-tag>
  </div>

  <div v-else-if="kind === 'mediaAssetSpec'" class="asset-cell asset-spec">
    <strong>{{ fileSize(row.file_size) }}</strong>
    <small v-if="dimensions">{{ dimensions }}</small>
  </div>

  <div v-else class="asset-cell asset-timeline">
    <Clock3 />
    <strong>{{ timelineValue }}</strong>
  </div>
</template>

<style scoped>
.asset-cell { min-width: 0; }
.asset-identity { display: flex; align-items: center; min-height: 52px; }
.asset-preview { display: flex; align-items: center; justify-content: center; min-height: 64px; }
.asset-preview__button { position: relative; display: inline-flex; width: 72px; height: 56px; overflow: hidden; align-items: center; justify-content: center; padding: 0; border: 1px solid #d5e2ec; border-radius: 7px; color: #4f718a; background: #edf4f8; cursor: pointer; }
.asset-preview__button.is-empty { cursor: default; }
.asset-preview__button > img,
.asset-preview__button > video { width: 100%; height: 100%; object-fit: cover; }
.asset-preview__button > svg { width: 22px; height: 22px; }
.asset-preview__zoom { position: absolute; inset: auto 4px 4px auto; display: inline-flex; width: 20px; height: 20px; align-items: center; justify-content: center; border-radius: 5px; color: #fff; background: rgb(27 55 76 / 76%); opacity: 0; transition: opacity 0.16s ease; }
.asset-preview__zoom svg { width: 11px; height: 11px; }
.asset-preview__button:hover .asset-preview__zoom { opacity: 1; }
.asset-identity__main { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 7px; }
.asset-identity__main > strong { overflow: hidden; color: #243b53; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.asset-identity__meta { display: flex; min-width: 0; align-items: center; gap: 5px; overflow: hidden; }
.asset-identity__meta code { flex: 0 0 auto; color: #28719f; font-size: 11px; }
.asset-identity__meta :deep(.el-tag) { max-width: 76px; }
.asset-identity__meta :deep(.el-tag__content) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.asset-identity__meta small { color: #8293a5; font-size: 10px; }
.asset-identity__empty { display: inline-flex; align-items: center; gap: 3px; color: #94a3b8; font-size: 11px; white-space: nowrap; }
.asset-identity__empty svg { width: 11px; height: 11px; }
.asset-groups { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 5px; }
.asset-groups :deep(.el-tag) { max-width: 100%; }
.asset-groups :deep(.el-tag__content) { display: inline-flex; min-width: 0; align-items: center; gap: 4px; }
.asset-groups svg { width: 12px; height: 12px; flex: 0 0 12px; }
.asset-groups span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.asset-groups small { color: #8293a5; font-size: 10px; }
.asset-property { display: flex; align-items: center; justify-content: center; }
.asset-property :deep(.el-tag__content) { display: inline-flex; align-items: center; gap: 5px; }
.asset-property svg { width: 12px; height: 12px; }
.asset-spec { display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 4px; }
.asset-spec strong { color: #40566c; font-size: 12px; white-space: nowrap; }
.asset-spec small { color: #8293a5; font-size: 11px; white-space: nowrap; }
.asset-timeline { display: flex; align-items: center; justify-content: center; gap: 7px; }
.asset-timeline > svg { width: 14px; height: 14px; flex: 0 0 14px; color: #527a98; }
.asset-timeline strong { color: #40566c; font-size: 12px; white-space: nowrap; }
</style>
