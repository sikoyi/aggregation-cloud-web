<script setup lang="ts">
import { Images, Search, X } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import { http, resolveBackendUrl } from '@/api/http'
import { usePersistentFilters } from '@/composables/usePersistentFilters'
import type { AnyRecord, PageResult } from '@/types/api'
import type { RemoteSelectConfig } from '@/types/crud'
import { notifyError } from '@/utils/notify'

const GROUP_ALL = '__all__'
const GROUP_UNGROUPED = '__ungrouped__'

const props = defineProps<{
  modelValue: unknown
  config: RemoteSelectConfig
  context?: AnyRecord
  disabled?: boolean
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const dialogVisible = ref(false)
const loading = ref(false)
const selectedLoading = ref(false)
const { filters: pickerFilters } = usePersistentFilters('picker:images', {
  keyword: '',
  selectedGroup: GROUP_ALL,
})
const keyword = computed({
  get: () => String(pickerFilters.keyword || ''),
  set: (value: string) => { pickerFilters.keyword = value },
})
const selectedGroup = computed({
  get: () => String(pickerFilters.selectedGroup || GROUP_ALL),
  set: (value: string) => { pickerFilters.selectedGroup = value },
})
const groups = ref<AnyRecord[]>([])
const assets = ref<AnyRecord[]>([])
const selectedAssets = ref<AnyRecord[]>([])
const draftIds = ref<string[]>([])
const page = ref(1)
const pageSize = ref(18)
const total = ref(0)
let selectedRequestId = 0

const selectedIds = computed(() => (
  Array.isArray(props.modelValue)
    ? [...new Set(props.modelValue.map(String).filter(Boolean))]
    : []
))
const selectedPreviewUrls = computed(() => selectedAssets.value.map(assetUrl).filter(Boolean))

function resolvedValue(value: string | ((context?: AnyRecord) => string)) {
  return typeof value === 'function' ? value(props.context) : value
}

function resolvedParams(value?: AnyRecord | ((context?: AnyRecord) => AnyRecord)) {
  return typeof value === 'function' ? value(props.context) : { ...(value || {}) }
}

function assetUrl(asset: AnyRecord) {
  return resolveBackendUrl(asset.source_url)
}

function assetGroupNames(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : []
}

async function loadSelectedAssets() {
  const requestId = ++selectedRequestId
  if (!selectedIds.value.length) {
    selectedAssets.value = []
    return
  }
  selectedLoading.value = true
  try {
    const settled = await Promise.allSettled(
      selectedIds.value.map((id) => (
        props.config.detailPath
          ? http.get<AnyRecord>(props.config.detailPath(id))
          : http.get<AnyRecord>(`${resolvedValue(props.config.endpoint)}/${encodeURIComponent(id)}`)
      )),
    )
    if (requestId !== selectedRequestId) return
    selectedAssets.value = settled
      .filter((item): item is PromiseFulfilledResult<AnyRecord> => item.status === 'fulfilled')
      .map((item) => item.value)
  } finally {
    if (requestId === selectedRequestId) selectedLoading.value = false
  }
}

async function loadGroups() {
  const group = props.config.group
  if (!group) return
  try {
    groups.value = (
      await http.get<PageResult<AnyRecord>>(resolvedValue(group.endpoint), {
        ...resolvedParams(group.params),
        page: 1,
        page_size: 100,
      })
    ).items
  } catch (error) {
    notifyError(error, '加载素材组失败', '暂时无法加载素材组')
  }
}

function groupParams() {
  const group = props.config.group
  if (!group || selectedGroup.value === GROUP_ALL) return {}
  if (selectedGroup.value === GROUP_UNGROUPED) {
    return { [group.ungroupedParam || 'ungrouped']: true }
  }
  return { [group.groupParam || 'group_id']: selectedGroup.value }
}

async function loadAssets() {
  loading.value = true
  try {
    const data = await http.get<PageResult<AnyRecord>>(resolvedValue(props.config.endpoint), {
      ...resolvedParams(props.config.params),
      ...groupParams(),
      [props.config.searchParam || 'keyword']: keyword.value || undefined,
      page: page.value,
      page_size: pageSize.value,
    })
    assets.value = props.config.matchesContext
      ? data.items.filter((item) => props.config.matchesContext?.(item, props.context))
      : data.items
    total.value = data.total
  } catch (error) {
    notifyError(error, '加载评论图片失败', '暂时无法加载素材图片')
  } finally {
    loading.value = false
  }
}

async function openDialog() {
  if (props.disabled) return
  dialogVisible.value = true
  draftIds.value = [...selectedIds.value]
  page.value = 1
  await Promise.all([loadGroups(), loadAssets()])
}

function searchAssets() {
  page.value = 1
  void loadAssets()
}

function isSelected(asset: AnyRecord) {
  return draftIds.value.includes(String(asset.id || ''))
}

function toggleAsset(asset: AnyRecord) {
  const id = String(asset.id || '')
  if (!id) return
  draftIds.value = isSelected(asset)
    ? draftIds.value.filter((item) => item !== id)
    : [...draftIds.value, id]
}

function removeSelected(id: string) {
  emit('update:modelValue', selectedIds.value.filter((item) => item !== id))
}

function clearSelection() {
  emit('update:modelValue', [])
}

function confirmSelection() {
  emit('update:modelValue', [...draftIds.value])
  dialogVisible.value = false
}

watch(selectedIds, () => {
  void loadSelectedAssets()
}, { immediate: true })
</script>

<template>
  <div class="image-picker">
    <div class="image-picker__actions">
      <el-button type="primary" plain :icon="Images" :disabled="disabled" @click="openDialog">
        {{ selectedIds.length ? `已选择 ${selectedIds.length} 张图片` : (placeholder || '选择评论图片') }}
      </el-button>
      <el-button v-if="selectedIds.length" :icon="X" :disabled="disabled" @click="clearSelection">清空</el-button>
    </div>

    <div v-if="selectedIds.length" v-loading="selectedLoading" class="selected-images">
      <div v-for="asset in selectedAssets" :key="String(asset.id)" class="selected-image">
        <el-image
          :src="assetUrl(asset)"
          :preview-src-list="selectedPreviewUrls"
          preview-teleported
          fit="cover"
        />
        <el-tooltip content="移除图片" placement="top">
          <el-button
            class="selected-image__remove"
            :icon="X"
            circle
            size="small"
            @click="removeSelected(String(asset.id))"
          />
        </el-tooltip>
        <span>{{ asset.name || `素材 #${asset.id}` }}</span>
      </div>
    </div>

    <el-dialog
      v-model="dialogVisible"
      title="选择评论图片"
      width="980px"
      append-to-body
      destroy-on-close
      class="image-picker-dialog"
    >
      <div class="image-picker-dialog__filters">
        <el-select v-model="selectedGroup" filterable @change="searchAssets">
          <el-option label="全部素材组" :value="GROUP_ALL" />
          <el-option
            v-for="group in groups"
            :key="String(group.id)"
            :label="String(group.name || group.id)"
            :value="String(group.id)"
          />
          <el-option label="未分组素材" :value="GROUP_UNGROUPED" />
        </el-select>
        <el-input v-model="keyword" clearable placeholder="搜索素材名称、地址或标签" @keyup.enter="searchAssets" />
        <el-button type="primary" :icon="Search" :loading="loading" @click="searchAssets">查询</el-button>
      </div>

      <div class="image-picker-dialog__summary">
        <span>当前已选 <strong>{{ draftIds.length }}</strong> 张图片</span>
        <el-button v-if="draftIds.length" text type="primary" @click="draftIds = []">清空选择</el-button>
      </div>

      <div v-loading="loading" class="image-picker-dialog__grid">
        <button
          v-for="asset in assets"
          :key="String(asset.id)"
          type="button"
          class="image-option"
          :class="{ 'is-selected': isSelected(asset) }"
          @click="toggleAsset(asset)"
        >
          <el-image
            :src="assetUrl(asset)"
            :preview-src-list="[assetUrl(asset)]"
            preview-teleported
            fit="cover"
            @click.stop
          />
          <span class="image-option__name">{{ asset.name || `素材 #${asset.id}` }}</span>
          <span class="image-option__groups">{{ assetGroupNames(asset.group_names).join('、') || '未分组' }}</span>
          <el-tag v-if="isSelected(asset)" class="image-option__selected" type="primary" effect="dark" size="small">
            已选
          </el-tag>
        </button>
        <el-empty v-if="!loading && !assets.length" description="没有符合条件的图片" :image-size="76" />
      </div>

      <el-pagination
        v-if="total > pageSize"
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        class="image-picker-dialog__pagination"
        @current-change="loadAssets"
      />

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmSelection">确认选择（{{ draftIds.length }}）</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.image-picker {
  width: 100%;
}

.image-picker__actions,
.image-picker-dialog__summary {
  display: flex;
  align-items: center;
  gap: 8px;
}

.selected-images {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: 10px;
  margin-top: 10px;
  max-height: 240px;
  overflow-y: auto;
}

.selected-image {
  position: relative;
  min-width: 0;
  border: 1px solid #dbe4f0;
  border-radius: 8px;
  padding: 6px;
  background: #f8fafc;
}

.selected-image :deep(.el-image) {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 6px;
  background: #eef2f7;
}

.selected-image span {
  display: block;
  margin-top: 5px;
  overflow: hidden;
  color: #475569;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-image__remove {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
}

.image-picker-dialog__filters {
  display: grid;
  grid-template-columns: 220px minmax(260px, 1fr) auto;
  gap: 10px;
}

.image-picker-dialog__summary {
  justify-content: space-between;
  min-height: 42px;
  margin: 12px 0;
  border-bottom: 1px solid #e5eaf1;
  color: #64748b;
  font-size: 13px;
}

.image-picker-dialog__summary strong {
  color: #256a98;
  font-size: 16px;
}

.image-picker-dialog__grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
  min-height: 360px;
  max-height: 52vh;
  overflow-y: auto;
}

.image-option {
  position: relative;
  min-width: 0;
  align-self: start;
  border: 1px solid #dbe4f0;
  border-radius: 8px;
  padding: 6px;
  background: #fff;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.image-option:hover,
.image-option.is-selected {
  border-color: #409eff;
  box-shadow: 0 0 0 1px rgb(64 158 255 / 18%);
}

.image-option :deep(.el-image) {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 6px;
  background: #eef2f7;
}

.image-option__name,
.image-option__groups {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.image-option__name {
  margin-top: 6px;
  color: #172033;
  font-size: 12px;
  font-weight: 600;
}

.image-option__groups {
  margin-top: 3px;
  color: #94a3b8;
  font-size: 11px;
}

.image-option__selected {
  position: absolute;
  top: 10px;
  right: 10px;
}

.image-picker-dialog__grid :deep(.el-empty) {
  grid-column: 1 / -1;
}

.image-picker-dialog__pagination {
  justify-content: flex-end;
  margin-top: 14px;
}

@media (max-width: 900px) {
  .image-picker-dialog__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .image-picker-dialog__filters {
    grid-template-columns: 1fr;
  }

  .image-picker-dialog__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
