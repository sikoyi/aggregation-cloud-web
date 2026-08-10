<script setup lang="ts">
import { Search, X } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import { http, resolveBackendUrl } from '@/api/http'
import { usePersistentFilters } from '@/composables/usePersistentFilters'
import StatusBadge from '@/components/StatusBadge.vue'
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
  'update:modelValue': [value: string]
}>()

const dialogVisible = ref(false)
const listLoading = ref(false)
const previewLoading = ref(false)
const selectedLoading = ref(false)
const { filters: pickerFilters } = usePersistentFilters('picker:contents', {
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
const contents = ref<AnyRecord[]>([])
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const draftValue = ref('')
const previewContent = ref<AnyRecord | null>(null)
const previewAssets = ref<AnyRecord[]>([])
const selectedContent = ref<AnyRecord | null>(null)
const selectedAssets = ref<AnyRecord[]>([])
let previewRequestId = 0
let selectedRequestId = 0

const selectedId = computed(() => String(props.modelValue || ''))
const selectedImageUrls = computed(() => imageUrls(selectedAssets.value))
const previewImageUrls = computed(() => imageUrls(previewAssets.value))

function resolvedValue(value: string | ((context?: AnyRecord) => string)) {
  return typeof value === 'function' ? value(props.context) : value
}

function resolvedParams(value?: AnyRecord | ((context?: AnyRecord) => AnyRecord)) {
  return typeof value === 'function' ? value(props.context) : { ...(value || {}) }
}

function imageUrls(assets: AnyRecord[]) {
  return assets
    .filter((asset) => String(asset.asset_type || '') === 'image')
    .map((asset) => resolveBackendUrl(asset.source_url))
    .filter(Boolean)
}

function contentSummary(content: AnyRecord | null) {
  const text = String(content?.text_body || '').trim()
  return text || '该内容没有文本正文'
}

function contentGroupNames(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : []
}

async function loadAssets(assetIds: unknown) {
  const ids = Array.isArray(assetIds) ? assetIds.map(String).filter(Boolean) : []
  if (!ids.length) return []
  const settled = await Promise.allSettled(
    ids.map((id) => http.get<AnyRecord>(`/api/resource-center/media-assets/${encodeURIComponent(id)}`)),
  )
  return settled
    .filter((item): item is PromiseFulfilledResult<AnyRecord> => item.status === 'fulfilled')
    .map((item) => item.value)
}

async function loadContentDetail(contentId: string) {
  if (!contentId) return { content: null, assets: [] as AnyRecord[] }
  const detailPath = props.config.detailPath?.(contentId)
    || `${resolvedValue(props.config.endpoint)}/${encodeURIComponent(contentId)}`
  const content = await http.get<AnyRecord>(detailPath)
  return {
    content,
    assets: await loadAssets(content.material_asset_ids),
  }
}

async function loadSelectedContent() {
  const requestId = ++selectedRequestId
  if (!selectedId.value) {
    selectedContent.value = null
    selectedAssets.value = []
    return
  }
  selectedLoading.value = true
  try {
    const detail = await loadContentDetail(selectedId.value)
    if (requestId !== selectedRequestId) return
    selectedContent.value = detail.content
    selectedAssets.value = detail.assets
  } catch (error) {
    if (requestId === selectedRequestId) {
      selectedContent.value = null
      selectedAssets.value = []
      notifyError(error, '加载内容预览失败', '暂时无法加载已选内容')
    }
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
    notifyError(error, '加载内容池失败', '暂时无法加载内容池')
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

async function loadContents() {
  listLoading.value = true
  try {
    const data = await http.get<PageResult<AnyRecord>>(resolvedValue(props.config.endpoint), {
      ...resolvedParams(props.config.params),
      ...groupParams(),
      [props.config.searchParam || 'keyword']: keyword.value || undefined,
      page: page.value,
      page_size: pageSize.value,
    })
    contents.value = data.items
    total.value = data.total
    if (!previewContent.value && data.items.length) await showPreview(data.items[0])
  } catch (error) {
    notifyError(error, '加载内容失败', '暂时无法加载内容列表')
  } finally {
    listLoading.value = false
  }
}

async function showPreview(content: AnyRecord) {
  const requestId = ++previewRequestId
  previewLoading.value = true
  previewContent.value = content
  previewAssets.value = []
  try {
    const detail = await loadContentDetail(String(content.id || ''))
    if (requestId !== previewRequestId) return
    previewContent.value = detail.content
    previewAssets.value = detail.assets
  } catch (error) {
    if (requestId === previewRequestId) notifyError(error, '加载内容预览失败', '暂时无法加载内容预览')
  } finally {
    if (requestId === previewRequestId) previewLoading.value = false
  }
}

async function openDialog() {
  if (props.disabled) return
  dialogVisible.value = true
  draftValue.value = selectedId.value
  page.value = 1
  previewContent.value = selectedContent.value
  previewAssets.value = selectedAssets.value
  await Promise.all([loadGroups(), loadContents()])
}

function searchContents() {
  page.value = 1
  previewContent.value = null
  previewAssets.value = []
  void loadContents()
}

function selectContent(content: AnyRecord) {
  draftValue.value = String(content.id || '')
  void showPreview(content)
}

function confirmSelection() {
  emit('update:modelValue', draftValue.value)
  dialogVisible.value = false
}

function clearSelection() {
  emit('update:modelValue', '')
}

watch(selectedId, () => {
  void loadSelectedContent()
}, { immediate: true })
</script>

<template>
  <div class="content-picker">
    <div class="content-picker__actions">
      <el-button type="primary" plain :icon="Search" :disabled="disabled" @click="openDialog">
        {{ selectedContent ? '重新选择内容' : (placeholder || '选择指定内容') }}
      </el-button>
      <el-button v-if="selectedId" :icon="X" :disabled="disabled" @click="clearSelection">清除</el-button>
    </div>

    <div v-if="selectedId && !disabled" v-loading="selectedLoading" class="selected-content">
      <div class="selected-content__header">
        <div>
          <strong>{{ selectedContent?.title || `内容 #${selectedId}` }}</strong>
          <div class="selected-content__meta">
            <StatusBadge v-if="selectedContent?.status" :value="selectedContent.status" />
            <span v-for="name in contentGroupNames(selectedContent?.content_group_names)" :key="name">{{ name }}</span>
          </div>
        </div>
      </div>
      <div class="selected-content__text">{{ contentSummary(selectedContent) }}</div>
      <div v-if="selectedImageUrls.length" class="selected-content__images">
        <el-image
          v-for="url in selectedImageUrls"
          :key="url"
          :src="url"
          :preview-src-list="selectedImageUrls"
          preview-teleported
          fit="cover"
        />
      </div>
    </div>

    <el-dialog
      v-model="dialogVisible"
      title="选择指定内容"
      width="1040px"
      append-to-body
      destroy-on-close
      class="content-picker-dialog"
    >
      <div class="content-picker-dialog__filters">
        <el-select v-model="selectedGroup" filterable @change="searchContents">
          <el-option label="全部内容池" :value="GROUP_ALL" />
          <el-option
            v-for="group in groups"
            :key="String(group.id)"
            :label="String(group.name || group.id)"
            :value="String(group.id)"
          />
          <el-option label="未分组内容" :value="GROUP_UNGROUPED" />
        </el-select>
        <el-input v-model="keyword" clearable placeholder="搜索标题、正文或标签" @keyup.enter="searchContents" />
        <el-button type="primary" :icon="Search" :loading="listLoading" @click="searchContents">查询</el-button>
      </div>

      <div class="content-picker-dialog__body">
        <div v-loading="listLoading" class="content-picker-dialog__list">
          <button
            v-for="content in contents"
            :key="String(content.id)"
            type="button"
            class="content-option"
            :class="{ 'is-selected': draftValue === String(content.id) }"
            @click="selectContent(content)"
          >
            <span class="content-option__title">{{ content.title || `内容 #${content.id}` }}</span>
            <span class="content-option__summary">{{ contentSummary(content) }}</span>
            <span class="content-option__meta">
              <StatusBadge :value="content.status" />
              <span>{{ contentGroupNames(content.content_group_names).join('、') || '未分组' }}</span>
            </span>
          </button>
          <el-empty v-if="!listLoading && !contents.length" description="没有符合条件的内容" :image-size="70" />
          <el-pagination
            v-if="total > pageSize"
            v-model:current-page="page"
            :page-size="pageSize"
            :total="total"
            layout="prev, pager, next"
            small
            @current-change="loadContents"
          />
        </div>

        <div v-loading="previewLoading" class="content-preview">
          <template v-if="previewContent">
            <div class="content-preview__header">
              <div>
                <span>内容预览</span>
                <strong>{{ previewContent.title || `内容 #${previewContent.id}` }}</strong>
              </div>
              <StatusBadge :value="previewContent.status" />
            </div>
            <div class="content-preview__text">{{ contentSummary(previewContent) }}</div>
            <div v-if="previewImageUrls.length" class="content-preview__images">
              <el-image
                v-for="url in previewImageUrls"
                :key="url"
                :src="url"
                :preview-src-list="previewImageUrls"
                preview-teleported
                fit="contain"
              />
            </div>
            <el-empty v-else description="该内容没有图片" :image-size="56" />
          </template>
          <el-empty v-else description="请选择左侧内容查看预览" :image-size="70" />
        </div>
      </div>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!draftValue" @click="confirmSelection">确认选择</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.content-picker,
.selected-content {
  width: 100%;
}

.content-picker__actions,
.selected-content__meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.selected-content {
  margin-top: 10px;
  border: 1px solid #dbe4f0;
  border-radius: 8px;
  padding: 12px;
  background: #f8fafc;
}

.selected-content__header strong,
.content-preview__header strong {
  display: block;
  color: #172033;
  font-size: 14px;
}

.selected-content__meta {
  flex-wrap: wrap;
  margin-top: 6px;
  color: #64748b;
  font-size: 12px;
}

.selected-content__text,
.content-preview__text {
  margin-top: 10px;
  color: #334155;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}

.selected-content__text {
  max-height: 120px;
  overflow: auto;
}

.selected-content__images,
.content-preview__images {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.selected-content__images {
  max-height: 220px;
  overflow-y: auto;
}

.selected-content__images :deep(.el-image) {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 6px;
  background: #eef2f7;
}

.content-picker-dialog__filters {
  display: grid;
  grid-template-columns: 220px minmax(260px, 1fr) auto;
  gap: 10px;
  margin-bottom: 14px;
}

.content-picker-dialog__body {
  display: grid;
  grid-template-columns: minmax(300px, 0.85fr) minmax(420px, 1.15fr);
  height: min(520px, 62vh);
  border: 1px solid #dbe4f0;
  border-radius: 8px;
  overflow: hidden;
}

.content-picker-dialog__list {
  min-width: 0;
  padding: 10px;
  border-right: 1px solid #dbe4f0;
  background: #f8fafc;
  overflow-y: auto;
}

.content-option {
  display: block;
  width: 100%;
  margin-bottom: 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 11px 12px;
  background: #fff;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.content-option:hover,
.content-option.is-selected {
  border-color: #409eff;
  background: #ecf5ff;
}

.content-option__title,
.content-option__summary,
.content-option__meta {
  display: block;
}

.content-option__title {
  overflow: hidden;
  color: #172033;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.content-option__summary {
  margin-top: 6px;
  overflow: hidden;
  color: #64748b;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.content-option__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  color: #64748b;
  font-size: 12px;
}

.content-picker-dialog__list :deep(.el-pagination) {
  justify-content: center;
  margin-top: 12px;
}

.content-preview {
  min-width: 0;
  padding: 18px;
  overflow-y: auto;
}

.content-preview__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.content-preview__header span {
  display: block;
  margin-bottom: 5px;
  color: #64748b;
  font-size: 12px;
}

.content-preview__images :deep(.el-image) {
  width: 100%;
  min-height: 140px;
  max-height: 260px;
  border-radius: 6px;
  background: #eef2f7;
}

@media (max-width: 768px) {
  .content-picker-dialog__filters,
  .content-picker-dialog__body {
    grid-template-columns: 1fr;
  }

  .content-picker-dialog__body {
    height: auto;
    max-height: 70vh;
  }

  .content-picker-dialog__list {
    max-height: 300px;
    border-right: 0;
    border-bottom: 1px solid #dbe4f0;
  }
}
</style>
