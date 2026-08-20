<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ListFilter, Search, X } from 'lucide-vue-next'

import { loadPublishSlotSelectionOptions, loadSlotSelectionOptions } from '@/api/selectionOptions'
import { usePersistentFilters } from '@/composables/usePersistentFilters'
import type { AnyRecord } from '@/types/api'
import { statusLabel, statusTagType } from '@/utils/format'
import {
  countFilteredTreeLeaves,
  filterTreeByAccountPresence,
  filterTreeByLeafKeyword,
  filteredTreeLeaves,
  mergeFilteredTreeSelection,
  toggleFilteredTreeSelection,
} from '@/utils/treeSelectionStats'
import { reconcileExpandedGroupKeys } from '@/utils/treeExpansion'

const props = defineProps<{
  modelValue: unknown
  disabled?: boolean
  filters?: AnyRecord
  showAccountPresenceFilter?: boolean
  accountPresence?: 'all' | 'bound' | 'unbound'
  fillHeight?: boolean
  showPublishStats?: boolean
  publishContentId?: unknown
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

interface SlotTreeNode {
  id: string
  slotId?: string
  providerSlotId?: string
  label: string
  searchText?: string
  status?: string
  hasAccount?: boolean
  accountName?: string
  accountLoginStatus?: string
  todayPublishCount?: number
  lastPublishedAt?: string
  selectedContentSucceededCount?: number
  selectedContentActiveCount?: number
  selectedContentFailedCount?: number
  deviceCount?: number
  separatorAfter?: boolean
  disabled?: boolean
  children?: SlotTreeNode[]
}

const treeRef = ref()
const rootRef = ref<HTMLElement>()
const toolbarRef = ref<HTMLElement>()
const loading = ref(false)
const treeData = ref<SlotTreeNode[]>([])
const { filters: persistentFilters } = usePersistentFilters('selector:devices', {
  keyword: '',
  groupNodeIds: [] as string[],
  accountPresence: 'all' as 'all' | 'bound' | 'unbound',
  publishUsage: 'all' as PublishUsage,
})
const searchKeyword = computed({
  get: () => String(persistentFilters.keyword || ''),
  set: (value: string) => { persistentFilters.keyword = value },
})
const selectedGroupNodeIds = computed<string[]>({
  get: () => Array.isArray(persistentFilters.groupNodeIds)
    ? persistentFilters.groupNodeIds.map(String)
    : [],
  set: (value) => { persistentFilters.groupNodeIds = [...new Set(value.map(String))] },
})
const accountPresenceFilter = computed<'all' | 'bound' | 'unbound'>({
  get: () => ['bound', 'unbound'].includes(String(persistentFilters.accountPresence))
    ? persistentFilters.accountPresence as 'bound' | 'unbound'
    : 'all',
  set: (value) => { persistentFilters.accountPresence = value },
})
type PublishUsage = 'all' | 'today_not_sent' | 'today_sent' | 'content_not_sent' | 'content_sent'
const publishUsageFilter = computed<PublishUsage>({
  get: () => {
    const value = String(persistentFilters.publishUsage || 'all') as PublishUsage
    if (!['all', 'today_not_sent', 'today_sent', 'content_not_sent', 'content_sent'].includes(value)) {
      return 'all'
    }
    if (!props.publishContentId && value.startsWith('content_')) return 'all'
    return value
  },
  set: (value) => { persistentFilters.publishUsage = value },
})
const loadedSlotIds = ref<Set<string>>(new Set())
const defaultExpandedGroupKeys = ref<string[]>([])
const collapsedGroupIds = new Set<string>()
const treeProps = {
  label: 'label',
  children: 'children',
  disabled: 'disabled',
  value: 'id',
}
const treeHeight = ref(350)

const selectedSlotIds = computed(() =>
  Array.isArray(props.modelValue) ? props.modelValue.filter(Boolean).map(String) : [],
)
const selectedSlotCount = computed(() =>
  selectedSlotIds.value.filter((slotId) => loadedSlotIds.value.has(slotId)).length,
)
const fixedTreeData = computed(() =>
  filterTreeByAccountPresence(treeData.value, props.accountPresence || 'all'),
)
const totalSlotCount = computed(() => countFilteredTreeLeaves(fixedTreeData.value, ''))
const groupOptions = computed(() => fixedTreeData.value.map((node) => ({
  value: node.id,
  label: node.label,
})))
const activeFilterCount = computed(() => (
  selectedGroupNodeIds.value.length
  + (props.showAccountPresenceFilter && accountPresenceFilter.value !== 'all' ? 1 : 0)
  + (props.showPublishStats && publishUsageFilter.value !== 'all' ? 1 : 0)
))

function matchesPublishUsage(node: SlotTreeNode) {
  const usage = publishUsageFilter.value
  if (!props.showPublishStats || usage === 'all') return true
  if (usage === 'today_not_sent') return Number(node.todayPublishCount || 0) === 0
  if (usage === 'today_sent') return Number(node.todayPublishCount || 0) > 0
  if (usage === 'content_not_sent') {
    return Number(node.selectedContentSucceededCount || 0) === 0
      && Number(node.selectedContentActiveCount || 0) === 0
  }
  return Number(node.selectedContentSucceededCount || 0) > 0
}

function filterTreeByPublishUsage(nodes: SlotTreeNode[]) {
  if (!props.showPublishStats || publishUsageFilter.value === 'all') return nodes
  return nodes
    .map((node) => ({
      ...node,
      children: (node.children || []).filter(matchesPublishUsage),
    }))
    .filter((node) => Boolean(node.children?.length))
}

const visibleTreeData = computed(() => {
  const selectedIds = new Set(selectedGroupNodeIds.value)
  const grouped = selectedGroupNodeIds.value.length
    ? fixedTreeData.value.filter((node) => selectedIds.has(node.id))
    : fixedTreeData.value
  const accountFilter = props.showAccountPresenceFilter ? accountPresenceFilter.value : 'all'
  const accountFiltered = filterTreeByAccountPresence(grouped, accountFilter)
  const publishFiltered = filterTreeByPublishUsage(accountFiltered)
  return filterTreeByLeafKeyword(publishFiltered, searchKeyword.value).map((node) => {
    const children = node.children || []
    return {
      ...node,
      deviceCount: children.length,
      children: children.map((child, index) => ({
        ...child,
        separatorAfter: (index + 1) % 10 === 0 && index < children.length - 1,
      })),
    }
  })
})
const filteredSlotCount = computed(() =>
  countFilteredTreeLeaves(visibleTreeData.value, ''),
)
const filterSignature = computed(() => JSON.stringify({
  runtime_platform: String(props.filters?.runtime_platform || ''),
  provider: String(props.filters?.provider || ''),
  account_presence: String(props.accountPresence || 'all'),
  publish_stats: Boolean(props.showPublishStats),
  content_id: String(props.publishContentId || ''),
}))
let loadRequestId = 0
let filterReloadTimer: number | undefined
let resizeObserver: ResizeObserver | undefined

function updateTreeHeight() {
  if (!props.fillHeight || !rootRef.value) {
    treeHeight.value = 350
    return
  }
  const toolbarHeight = toolbarRef.value?.offsetHeight || 0
  treeHeight.value = Math.max(260, rootRef.value.clientHeight - toolbarHeight - 10)
}

function slotNodeId(slotId: string) {
  return `slot:${slotId}`
}

function slotLabel(slot: AnyRecord) {
  return String(
    slot.display_name ||
      slot.provider_slot_no ||
      slot.provider_slot_id ||
      '未命名设备',
  )
}

function toSlotNode(slot: AnyRecord): SlotTreeNode {
  const label = slotLabel(slot)
  const providerSlotId = String(slot.provider_slot_id || '')
  return {
    id: slotNodeId(String(slot.id)),
    slotId: String(slot.id),
    providerSlotId,
    label,
    searchText: [label, providerSlotId, slot.provider_slot_no, slot.bound_account_name]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
    status: String(slot.status || 'offline'),
    hasAccount: Boolean(slot.bound_account_id),
    accountName: String(slot.bound_account_name || ''),
    accountLoginStatus: String(slot.bound_account_login_status || ''),
    todayPublishCount: Number(slot.today_publish_count || 0),
    lastPublishedAt: String(slot.last_published_at || ''),
    selectedContentSucceededCount: Number(slot.selected_content_succeeded_count || 0),
    selectedContentActiveCount: Number(slot.selected_content_active_count || 0),
    selectedContentFailedCount: Number(slot.selected_content_failed_count || 0),
    disabled: Boolean(props.disabled),
  }
}

function filterNode(value: string, data: AnyRecord) {
  const keyword = value.trim().toLowerCase()
  if (!keyword) return true
  if (Array.isArray(data.children)) return true
  return String(data.searchText || data.label).toLowerCase().includes(keyword)
}

function syncCheckedKeys() {
  const keys = selectedSlotIds.value.map(slotNodeId)
  treeRef.value?.setCheckedKeys?.(keys)
}

function syncExpandedKeys() {
  const visibleGroupIds = new Set(visibleTreeData.value.map((node) => node.id))
  defaultExpandedGroupKeys.value = reconcileExpandedGroupKeys(
    treeData.value.map((node) => node.id),
    collapsedGroupIds,
  ).filter((groupId) => visibleGroupIds.has(groupId))
  treeRef.value?.setExpandedKeys?.(defaultExpandedGroupKeys.value)
}

function handleNodeExpand(data: AnyRecord) {
  const nodeId = String(data.id || '')
  if (nodeId && Array.isArray(data.children) && data.children.length) {
    collapsedGroupIds.delete(nodeId)
    if (!defaultExpandedGroupKeys.value.includes(nodeId)) {
      defaultExpandedGroupKeys.value = [...defaultExpandedGroupKeys.value, nodeId]
    }
  }
}

function handleNodeCollapse(data: AnyRecord) {
  const nodeId = String(data.id || '')
  if (nodeId && Array.isArray(data.children) && data.children.length) {
    collapsedGroupIds.add(nodeId)
    defaultExpandedGroupKeys.value = defaultExpandedGroupKeys.value.filter(
      (groupId) => groupId !== nodeId,
    )
  }
}

async function loadTree() {
  const requestId = ++loadRequestId
  loading.value = true
  try {
    const slots = props.showPublishStats
      ? await loadPublishSlotSelectionOptions(props.filters || {}, props.publishContentId)
      : await loadSlotSelectionOptions(props.filters || {})
    if (requestId !== loadRequestId) return

    const slotsByGroup = new Map<string, AnyRecord[]>()
    const groupNames = new Map<string, string>()
    const groupedSlotIds = new Set<string>()

    // 精简接口已带回分组信息，选择器只需一次请求即可组装完整设备树。
    slots.forEach((slot) => {
      const groupId = String(slot.group_id || '')
      if (!groupId) return
      const items = slotsByGroup.get(groupId) || []
      items.push(slot)
      slotsByGroup.set(groupId, items)
      groupNames.set(groupId, String(slot.group_name || groupId))
      groupedSlotIds.add(String(slot.id))
    })

    const groupNodes = Array.from(slotsByGroup.entries()).map(([groupId, items]) => {
      const label = groupNames.get(groupId) || groupId
      return {
        id: `group:${groupId}`,
        label,
        searchText: label.toLowerCase(),
        deviceCount: items.length,
        disabled: Boolean(props.disabled) || !items.length,
        children: items.map(toSlotNode),
      }
    })

    const ungroupedSlots = slots.filter((slot) => !groupedSlotIds.has(String(slot.id)))
    const nextTreeData = [
      ...groupNodes.filter((node) => node.children.length),
      ...(ungroupedSlots.length
        ? [
            {
              id: 'group:ungrouped',
              label: '未分组设备',
              searchText: '未分组设备',
              deviceCount: ungroupedSlots.length,
              children: ungroupedSlots.map(toSlotNode),
            },
          ]
        : []),
    ]
    treeData.value = nextTreeData
    const selectableTreeData = filterTreeByAccountPresence(
      nextTreeData,
      props.accountPresence || 'all',
    )
    loadedSlotIds.value = new Set(
      filteredTreeLeaves(selectableTreeData, '')
        .map((node) => node.slotId)
        .filter((slotId): slotId is string => Boolean(slotId)),
    )

    await nextTick()
    syncCheckedKeys()
    syncExpandedKeys()
    treeRef.value?.filter?.(searchKeyword.value)
  } finally {
    if (requestId === loadRequestId) loading.value = false
  }
}

function emitChecked(node: unknown) {
  const checkedNode = node as SlotTreeNode
  if (searchKeyword.value.trim() && checkedNode.children?.length) {
    const groupVisibleSlotIds = filteredTreeLeaves(
      [checkedNode],
      searchKeyword.value,
    )
      .map((node) => node.slotId)
      .filter((slotId): slotId is string => Boolean(slotId))

    // 隐藏成员会让分组节点保持半选，分组点击需按当前可见成员主动切换全选或反选。
    emit(
      'update:modelValue',
      toggleFilteredTreeSelection(selectedSlotIds.value, groupVisibleSlotIds),
    )
    return
  }

  const checkedNodes = (treeRef.value?.getCheckedNodes?.(true) || []) as SlotTreeNode[]
  const checkedSlotIds = checkedNodes
    .map((node) => node.slotId)
    .filter((slotId): slotId is string => Boolean(slotId))
  const visibleSlotIds = filteredTreeLeaves(
    visibleTreeData.value,
    searchKeyword.value,
  )
    .map((node) => node.slotId)
    .filter((slotId): slotId is string => Boolean(slotId))

  // 搜索只改变本次勾选范围，不能覆盖搜索结果之外已经选中的设备。
  emit(
    'update:modelValue',
    mergeFilteredTreeSelection(selectedSlotIds.value, checkedSlotIds, visibleSlotIds),
  )
}

onMounted(() => {
  loadTree()
  if (!props.fillHeight || typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver(updateTreeHeight)
  if (rootRef.value) resizeObserver.observe(rootRef.value)
  if (toolbarRef.value) resizeObserver.observe(toolbarRef.value)
  nextTick(updateTreeHeight)
})

onBeforeUnmount(() => {
  loadRequestId += 1
  if (filterReloadTimer) window.clearTimeout(filterReloadTimer)
  resizeObserver?.disconnect()
})

watch(selectedSlotIds, () => nextTick(syncCheckedKeys))

watch(searchKeyword, (value) => treeRef.value?.filter?.(value))

watch(visibleTreeData, async () => {
  await nextTick()
  syncCheckedKeys()
  syncExpandedKeys()
  treeRef.value?.filter?.(searchKeyword.value)
})

watch(
  filterSignature,
  () => {
    if (filterReloadTimer) window.clearTimeout(filterReloadTimer)
    filterReloadTimer = window.setTimeout(() => {
      filterReloadTimer = undefined
      loadTree()
    }, 250)
  },
)
</script>

<template>
  <div
    ref="rootRef"
    class="slot-tree-select"
    :class="{ 'slot-tree-select--fill': fillHeight }"
    v-loading="loading"
  >
    <div ref="toolbarRef" class="slot-tree-toolbar">
      <div class="slot-tree-summary">
        <span>设备总数 <strong>{{ totalSlotCount }}</strong></span>
        <span>当前筛选 <strong>{{ filteredSlotCount }}</strong></span>
        <span>已选设备 <strong>{{ selectedSlotCount }}</strong></span>
      </div>
      <div class="slot-tree-filters">
        <el-input
          v-model="searchKeyword"
          :prefix-icon="Search"
          clearable
          placeholder="搜索设备名称 / Provider ID"
        />
        <el-popover placement="bottom-end" :width="260" trigger="click">
          <template #reference>
            <el-button
              class="slot-tree-filter-button"
              :type="activeFilterCount ? 'primary' : 'default'"
              :plain="!activeFilterCount"
              :icon="ListFilter"
              :data-filter-count="activeFilterCount || undefined"
              :title="activeFilterCount ? `已启用 ${activeFilterCount} 项筛选` : '筛选设备'"
              circle
              aria-label="筛选设备"
            />
          </template>
          <div class="group-filter-popover">
            <div class="group-filter-popover__header">
              <span>{{ showAccountPresenceFilter ? '筛选设备' : '显示设备分组' }}</span>
              <el-button
                v-if="activeFilterCount"
                link
                type="primary"
                :icon="X"
                @click="selectedGroupNodeIds = []; accountPresenceFilter = 'all'; publishUsageFilter = 'all'"
              >
                显示全部
              </el-button>
            </div>
            <div v-if="showAccountPresenceFilter" class="account-presence-filter">
              <span>账号情况</span>
              <el-segmented
                v-model="accountPresenceFilter"
                :options="[
                  { label: '全部', value: 'all' },
                  { label: '有号', value: 'bound' },
                  { label: '无号', value: 'unbound' },
                ]"
                size="small"
              />
            </div>
            <el-divider v-if="showAccountPresenceFilter" />
            <div v-if="showPublishStats" class="account-presence-filter">
              <span>发布情况</span>
              <el-select v-model="publishUsageFilter" size="small">
                <el-option label="全部账号" value="all" />
                <el-option label="今日未发布" value="today_not_sent" />
                <el-option label="今日已发布" value="today_sent" />
                <el-option v-if="publishContentId" label="未发当前内容" value="content_not_sent" />
                <el-option v-if="publishContentId" label="已发当前内容" value="content_sent" />
              </el-select>
            </div>
            <el-divider v-if="showPublishStats" />
            <el-scrollbar max-height="260px">
              <el-checkbox-group v-model="selectedGroupNodeIds" class="group-filter-popover__options">
                <el-checkbox
                  v-for="option in groupOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </el-checkbox>
              </el-checkbox-group>
            </el-scrollbar>
          </div>
        </el-popover>
      </div>
    </div>
    <el-tree-v2
      ref="treeRef"
      :data="visibleTreeData"
      :props="treeProps"
      :height="treeHeight"
      :item-size="showPublishStats ? 56 : 42"
      show-checkbox
      :default-expanded-keys="defaultExpandedGroupKeys"
      :check-strictly="false"
      :expand-on-click-node="false"
      :filter-method="filterNode"
      scrollbar-always-on
      empty-text="暂无可选设备"
      @check="emitChecked"
      @node-expand="handleNodeExpand"
      @node-collapse="handleNodeCollapse"
    >
      <template #default="{ data }">
        <span
          class="slot-tree-node"
          :class="{ 'slot-tree-node--section-end': data.separatorAfter }"
        >
          <span class="slot-tree-node__copy">
            <span class="slot-tree-node__label">{{ data.label }}</span>
            <span v-if="showPublishStats && data.slotId" class="slot-tree-node__account">
              {{ data.accountName || '未绑定账号' }}
            </span>
            <span v-else-if="data.providerSlotId" class="slot-tree-node__id">{{ data.providerSlotId }}</span>
          </span>
          <span v-if="data.slotId" class="slot-tree-node__tags">
            <el-tag
              v-if="showPublishStats"
              size="small"
              :type="data.selectedContentActiveCount > 0
                ? 'warning'
                : publishContentId && data.selectedContentSucceededCount > 0
                  ? 'success'
                  : data.todayPublishCount > 0
                    ? 'primary'
                    : 'info'"
              effect="light"
              round
              :title="data.lastPublishedAt ? `最近发布：${data.lastPublishedAt}` : '暂无发布记录'"
            >
              {{ data.selectedContentActiveCount > 0
                ? '发送中'
                : publishContentId && data.selectedContentSucceededCount > 0
                  ? `当前已发 ${data.selectedContentSucceededCount}`
                  : data.todayPublishCount > 0
                    ? `今日已发 ${data.todayPublishCount}`
                    : '今日未发' }}
            </el-tag>
            <el-tag
              v-if="!showPublishStats || data.status !== 'idle'"
              size="small"
              :type="statusTagType(data.status)"
              effect="light"
              round
            >
              {{ statusLabel(data.status) }}
            </el-tag>
          </span>
          <el-tag v-else-if="data.deviceCount !== undefined" size="small" type="info" effect="plain" round>
            {{ data.deviceCount }} 台
          </el-tag>
        </span>
      </template>
    </el-tree-v2>
  </div>
</template>

<style scoped>
.slot-tree-select {
  width: 100%;
  box-sizing: border-box;
  min-height: 260px;
  max-height: 420px;
  overflow: auto;
  padding: 10px 12px;
  border: 1px solid #dbe4f0;
  border-radius: 6px;
  background: #f8fafc;
}

.slot-tree-select--fill {
  height: 100%;
  min-height: 380px;
  max-height: none;
  overflow: hidden;
}

.slot-tree-select :deep(.el-tree),
.slot-tree-select :deep(.el-tree-v2) {
  background: transparent;
}

.slot-tree-toolbar {
  position: sticky;
  z-index: 2;
  top: -10px;
  margin: -10px -12px 10px;
  padding: 10px 12px;
  border-bottom: 1px solid #dbe4f0;
  background: rgb(248 250 252 / 96%);
  backdrop-filter: blur(4px);
}

.slot-tree-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(72px, 1fr));
  gap: 6px;
  margin-bottom: 8px;
  color: #65778a;
  font-size: 12px;
  text-align: center;
}

.slot-tree-summary span {
  display: inline-flex;
  min-width: 72px;
  align-items: baseline;
  justify-content: center;
  white-space: nowrap;
}

.slot-tree-summary strong {
  margin-left: 3px;
  color: #1f668f;
  font-size: 13px;
}

.slot-tree-filters {
  display: flex;
  align-items: center;
  gap: 8px;
}

.slot-tree-filters :deep(.el-input) {
  min-width: 0;
  flex: 1;
}

.slot-tree-filter-button {
  position: relative;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  overflow: visible;
}

.slot-tree-filter-button[data-filter-count]::after {
  position: absolute;
  top: -7px;
  right: -7px;
  display: inline-flex;
  min-width: 17px;
  height: 17px;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  border: 2px solid #fff;
  border-radius: 9px;
  background: #1f668f;
  color: #fff;
  content: attr(data-filter-count);
  font-size: 10px;
  line-height: 13px;
  pointer-events: none;
}

.group-filter-popover__header {
  display: flex;
  min-height: 32px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  color: #27364a;
  font-weight: 600;
}

.account-presence-filter {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: #27364a;
  font-size: 13px;
  font-weight: 600;
}

.account-presence-filter :deep(.el-segmented) {
  width: 100%;
}

.group-filter-popover :deep(.el-divider) {
  margin: 12px 0;
}

.group-filter-popover__options {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.group-filter-popover__options :deep(.el-checkbox) {
  width: 100%;
  height: 34px;
  margin-right: 0;
  padding: 0 6px;
  border-radius: 4px;
}

.group-filter-popover__options :deep(.el-checkbox:hover) {
  background: #f3f7fb;
}

.slot-tree-select :deep(.el-tree-node__content) {
  min-width: 0;
}

.slot-tree-node {
  position: relative;
  display: flex;
  height: 100%;
  min-width: 0;
  box-sizing: border-box;
  flex: 1;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-right: 8px;
}

.slot-tree-node--section-end::after {
  position: absolute;
  right: 10px;
  bottom: 2px;
  left: 4px;
  height: 1px;
  background: #c8d5e2;
  content: '';
  pointer-events: none;
}

.slot-tree-node--section-end {
  padding-bottom: 6px;
}

.slot-tree-node__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slot-tree-node__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  line-height: 1.3;
}

.slot-tree-node__id {
  overflow: hidden;
  color: #7b8da1;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slot-tree-node__account {
  overflow: hidden;
  color: #65778a;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slot-tree-node__tags {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
}

.slot-tree-node__tags :deep(.el-tag) {
  max-width: 92px;
}
</style>
