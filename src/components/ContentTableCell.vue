<script setup lang="ts">
import { Clock3, FileText, Image as ImageIcon, Layers3, Tags, Video } from 'lucide-vue-next'
import { computed } from 'vue'

import { businessPlatformOptions, contentTypeOptions } from '@/config/options'
import type { AnyRecord } from '@/types/api'
import type { ColumnConfig, SelectOption } from '@/types/crud'

type ContentCellKind = 'contentIdentity' | 'contentPools' | 'contentPlatform' | 'contentType' | 'contentTimeline'

const props = defineProps<{
  kind: ContentCellKind
  row: AnyRecord
  column: ColumnConfig
}>()

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

const contentTags = computed(() => {
  const values = Array.isArray(props.row.tags) ? props.row.tags : []
  return values.map((item) => String(item).trim()).filter(Boolean)
})
const groupNames = computed(() => {
  const values = Array.isArray(props.row.content_group_names) ? props.row.content_group_names : []
  return values.map((item) => String(item).trim()).filter(Boolean)
})
const contentType = computed(() => String(props.row.content_type || 'text'))
const updatedAt = computed(() => compactDate(props.row.updated_at))
</script>

<template>
  <div v-if="kind === 'contentIdentity'" class="content-cell content-identity">
    <span class="content-identity__icon" :class="`is-${contentType}`">
      <Video v-if="contentType === 'video'" />
      <ImageIcon v-else-if="contentType === 'image'" />
      <Layers3 v-else-if="contentType === 'mixed'" />
      <FileText v-else />
    </span>
    <span class="content-identity__main">
      <el-tooltip :content="text(row.title)" placement="top" :show-after="500">
        <strong>{{ text(row.title) }}</strong>
      </el-tooltip>
      <span v-if="contentTags.length" class="content-identity__tags">
        <el-tag v-for="tag in contentTags.slice(0, 2)" :key="tag" size="small" effect="plain" round>
          {{ tag }}
        </el-tag>
        <small v-if="contentTags.length > 2">+{{ contentTags.length - 2 }}</small>
      </span>
      <span v-else class="content-identity__empty"><Tags />暂无标签</span>
    </span>
  </div>

  <div v-else-if="kind === 'contentPools'" class="content-cell content-pools">
    <template v-if="groupNames.length">
      <el-tag v-for="group in groupNames.slice(0, 3)" :key="group" type="primary" effect="plain" round>
        <Layers3 /><span>{{ group }}</span>
      </el-tag>
      <small v-if="groupNames.length > 3">+{{ groupNames.length - 3 }}</small>
    </template>
    <el-tag v-else type="info" effect="plain" round>未加入内容池</el-tag>
  </div>

  <div v-else-if="kind === 'contentPlatform'" class="content-cell content-property">
    <el-tag type="primary" effect="light" round>
      {{ optionLabel(businessPlatformOptions, row.business_platform) }}
    </el-tag>
  </div>

  <div v-else-if="kind === 'contentType'" class="content-cell content-property">
    <el-tag type="info" effect="plain" round>
      {{ optionLabel(contentTypeOptions, row.content_type) }}
    </el-tag>
  </div>

  <div v-else class="content-cell content-timeline">
    <Clock3 />
    <strong>{{ updatedAt }}</strong>
  </div>
</template>

<style scoped>
.content-cell { min-width: 0; }
.content-identity { display: flex; align-items: center; gap: 10px; }
.content-identity__icon { display: inline-flex; width: 38px; height: 38px; flex: 0 0 38px; align-items: center; justify-content: center; border: 1px solid #cfe1f2; border-radius: 8px; color: #24658f; background: #edf6fc; }
.content-identity__icon.is-image { color: #16845b; border-color: #ccebdc; background: #effaf5; }
.content-identity__icon.is-video { color: #8b5a17; border-color: #f0dfbd; background: #fff9ed; }
.content-identity__icon.is-mixed { color: #7157a8; border-color: #dfd6f3; background: #f7f3ff; }
.content-identity__icon svg { width: 18px; height: 18px; }
.content-identity__main { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 6px; }
.content-identity__main > strong { overflow: hidden; color: #243b53; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.content-identity__tags { display: flex; min-width: 0; align-items: center; gap: 4px; overflow: hidden; }
.content-identity__tags :deep(.el-tag) { max-width: 88px; }
.content-identity__tags :deep(.el-tag__content) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.content-identity__tags small { color: #8293a5; font-size: 10px; }
.content-identity__empty { display: inline-flex; align-items: center; gap: 4px; color: #94a3b8; font-size: 11px; }
.content-identity__empty svg { width: 12px; height: 12px; }
.content-pools { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; }
.content-pools :deep(.el-tag) { max-width: 100%; }
.content-pools :deep(.el-tag__content) { display: inline-flex; min-width: 0; align-items: center; gap: 4px; }
.content-pools svg { width: 12px; height: 12px; flex: 0 0 12px; }
.content-pools span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.content-pools small { color: #8293a5; font-size: 10px; }
.content-property { display: flex; align-items: center; justify-content: center; }
.content-timeline { display: flex; align-items: center; justify-content: center; gap: 7px; }
.content-timeline > svg { width: 14px; height: 14px; flex: 0 0 14px; color: #527a98; }
.content-timeline strong { color: #40566c; font-size: 12px; white-space: nowrap; }
</style>
