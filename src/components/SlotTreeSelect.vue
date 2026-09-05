<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ListFilter, Search, X } from 'lucide-vue-next'

import {
  loadSlotSelectionGroups,
  loadSlotSelectionIds,
  loadSlotSelectionPage,
  loadSlotSelectionPages,
  type SlotSelectionTreeQuery,
} from '@/api/selectionOptions'
import { usePersistentFilters } from '@/composables/usePersistentFilters'
import type { AnyRecord } from '@/types/api'
import { statusLabel, statusTagType } from '@/utils/format'

const props = defineProps<{
  modelValue: unknown
  disabled?: boolean
  filters?: AnyRecord
  showAccountPresenceFilter?: boolean
  accountPresence?: 'all' | 'bound' | 'unbound'
  warmupBusinessPlatform?: string
  taskBusinessPlatform?: string
  fillHeight?: boolean
  showPublishStats?: boolean
  publishContentId?: unknown
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

type PublishUsage = 'all' | 'today_not_sent' | 'today_sent' | 'content_not_sent' | 'content_sent'
type NodeType = 'group' | 'slot' | 'placeholder' | 'load-more'

interface SlotTreeNode {
  id: string
  nodeType: NodeType
  groupId?: string
  slotId?: string
  providerSlotId?: string
  label: string
  status?: string
  accountName?: string
  todayPublishCount?: number
  lastPublishedAt?: string
  selectedContentSucceededCount?: number
  selectedContentActiveCount?: number
  selectedContentFailedCount?: number
  deviceCount?: number
  loadedCount?: number
  page?: number
  hasMore?: boolean
  loading?: boolean
  loadError?: boolean
  selecting?: boolean
  separatorAfter?: boolean
  disabled?: boolean
  children?: SlotTreeNode[]
}

const PAGE_SIZE = 100
const DEFAULT_TREE_HEIGHT = 350

const treeRef = ref()
const rootRef = ref<HTMLElement>()
const toolbarRef = ref<HTMLElement>()
const loading = ref(false)
const treeData = ref<SlotTreeNode[]>([])
const totalCandidateCount = ref(0)
const expandedGroupKeys = ref<string[]>([])
const collapsedGroupIds = new Set<string>()
const treeHeight = ref(DEFAULT_TREE_HEIGHT)
const selectedWholeGroupIds = new Set<string>()
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
const selectedSlotIds = computed(() =>
  Array.isArray(props.modelValue) ? props.modelValue.filter(Boolean).map(String) : [],
)
const effectiveAccountPresence = computed<'all' | 'bound' | 'unbound'>(() => {
  const fixed = props.accountPresence || 'all'
  if (fixed !== 'all') return fixed
  return props.showAccountPresenceFilter ? accountPresenceFilter.value : 'all'
})
const selectionQuery = computed<SlotSelectionTreeQuery>(() => ({
  accountPresence: effectiveAccountPresence.value,
  warmupBusinessPlatform: props.warmupBusinessPlatform,
  taskBusinessPlatform: props.taskBusinessPlatform,
  keyword: searchKeyword.value,
  publish: Boolean(props.showPublishStats),
  publishUsage: publishUsageFilter.value,
  contentId: props.publishContentId,
}))
const visibleTreeData = computed(() => {
  const selected = new Set(selectedGroupNodeIds.value)
  return selected.size
    ? treeData.value.filter((node) => selected.has(node.id))
    : treeData.value
})
const groupOptions = computed(() => treeData.value.map((node) => ({
  value: node.id,
  label: node.label,
})))
const totalSlotCount = computed(() => totalCandidateCount.value)
const filteredSlotCount = computed(() => {
  if (!selectedGroupNodeIds.value.length) return totalCandidateCount.value
  return visibleTreeData.value.reduce((total, node) => total + Number(node.deviceCount || 0), 0)
})
const selectedSlotCount = computed(() => selectedSlotIds.value.length)
const activeFilterCount = computed(() => (
  selectedGroupNodeIds.value.length
  + (props.showAccountPresenceFilter && accountPresenceFilter.value !== 'all' ? 1 : 0)
  + (props.showPublishStats && publishUsageFilter.value !== 'all' ? 1 : 0)
))
const treeProps = {
  label: 'label',
  children: 'children',
  disabled: 'disabled',
  value: 'id',
}
const requestSignature = computed(() => JSON.stringify({
  business_platform: String(props.filters?.business_platform || ''),
  runtime_platform: String(props.filters?.runtime_platform || ''),
  provider: String(props.filters?.provider || ''),
  account_presence: effectiveAccountPresence.value,
  warmup_business_platform: String(props.warmupBusinessPlatform || ''),
  task_business_platform: String(props.taskBusinessPlatform || ''),
  publish_stats: Boolean(props.showPublishStats),
  publish_usage: publishUsageFilter.value,
  content_id: String(props.publishContentId || ''),
  keyword: searchKeyword.value.trim(),
}))

let loadRequestId = 0
let reloadTimer: number | undefined
let resizeObserver: ResizeObserver | undefined
const groupLoadPromises = new Map<string, Promise<void>>()

function updateTreeHeight() {
  if (!props.fillHeight || !rootRef.value) {
    treeHeight.value = DEFAULT_TREE_HEIGHT
    return
  }
  const toolbarHeight = toolbarRef.value?.offsetHeight || 0
  treeHeight.value = Math.max(260, rootRef.value.clientHeight - toolbarHeight - 10)
}

function slotNodeId(slotId: string) {
  return `slot:${slotId}`
}

function groupNodeId(groupId: string) {
  return `group:${groupId}`
}

function slotLabel(slot: AnyRecord) {
  return String(slot.display_name || slot.provider_slot_no || slot.provider_slot_id || '未命名设备')
}

function toSlotNode(slot: AnyRecord): SlotTreeNode {
  return {
    id: slotNodeId(String(slot.id)),
    nodeType: 'slot',
    slotId: String(slot.id),
    providerSlotId: String(slot.provider_slot_id || ''),
    label: slotLabel(slot),
    status: String(slot.status || 'offline'),
    accountName: String(slot.bound_account_name || ''),
    todayPublishCount: Number(slot.today_publish_count || 0),
    lastPublishedAt: String(slot.last_published_at || ''),
    selectedContentSucceededCount: Number(slot.selected_content_succeeded_count || 0),
    selectedContentActiveCount: Number(slot.selected_content_active_count || 0),
    selectedContentFailedCount: Number(slot.selected_content_failed_count || 0),
    disabled: Boolean(props.disabled),
  }
}

function placeholderNode(groupId: string, loadingState = false): SlotTreeNode {
  return {
    id: `placeholder:${groupId}`,
    nodeType: 'placeholder',
    groupId,
    label: loadingState ? '正在加载设备...' : '展开后加载设备',
    disabled: true,
  }
}

function decorateChildren(group: SlotTreeNode, slots: SlotTreeNode[]) {
  const children: SlotTreeNode[] = slots.map((slot, index) => ({
    ...slot,
    separatorAfter: (index + 1) % 10 === 0 && index < slots.length - 1,
  }))
  if (group.hasMore) {
    children.push({
      id: `load-more:${group.groupId}:${group.page}`,
      nodeType: 'load-more',
      groupId: group.groupId,
      label: group.loadError ? '加载失败，点击重试' : group.loading ? '正在加载更多...' : '继续加载剩余设备',
      loading: group.loading,
      disabled: true,
    })
  }
  return children
}

function syncCheckedKeys() {
  const selected = new Set(selectedSlotIds.value)
  const checkedKeys = selectedSlotIds.value.map(slotNodeId)
  treeData.value.forEach((group) => {
    const slots = (group.children || []).filter((node) => node.nodeType === 'slot' && node.slotId)
    const allLoadedSlotsSelected = slots.every((slot) => selected.has(String(slot.slotId)))
    if (selectedWholeGroupIds.has(group.id) && !allLoadedSlotsSelected) {
      selectedWholeGroupIds.delete(group.id)
    }
    if (
      (selectedWholeGroupIds.has(group.id) && allLoadedSlotsSelected)
      || (!group.hasMore && slots.length > 0 && allLoadedSlotsSelected)
    ) {
      checkedKeys.push(group.id)
    }
  })
  treeRef.value?.setCheckedKeys?.(checkedKeys)
}

function syncTreeData() {
  // el-tree-v2 does not rebuild its internal node map after nested children mutate.
  treeRef.value?.setData?.(visibleTreeData.value)
}

function syncExpandedKeys() {
  const visibleIds = new Set(visibleTreeData.value.map((node) => node.id))
  expandedGroupKeys.value = expandedGroupKeys.value.filter((id) => visibleIds.has(id))
  treeRef.value?.setExpandedKeys?.(expandedGroupKeys.value)
}

async function expandGroup(group: SlotTreeNode) {
  collapsedGroupIds.delete(group.id)
  if (!expandedGroupKeys.value.includes(group.id)) {
    expandedGroupKeys.value.push(group.id)
  }
  await nextTick()
  syncExpandedKeys()
}

async function loadGroupPage(group: SlotTreeNode, requestedPage?: number): Promise<boolean> {
  if (!group.groupId || group.loading) return false
  const page = requestedPage || Math.max(1, Number(group.page || 0) + 1)
  const requestId = loadRequestId
  const existingSlots = (group.children || []).filter((node) => node.nodeType === 'slot')
  group.loading = true
  group.loadError = false
  group.children = existingSlots.length
    ? decorateChildren(group, existingSlots)
    : [placeholderNode(group.groupId, true)]
  try {
    const result = await loadSlotSelectionPage(
      props.filters || {},
      selectionQuery.value,
      group.groupId,
      page,
      PAGE_SIZE,
    )
    if (requestId !== loadRequestId) return false
    const knownIds = new Set(existingSlots.map((node) => node.slotId))
    const appended = result.items
      .map(toSlotNode)
      .filter((node) => !knownIds.has(node.slotId))
    const slots = [...existingSlots, ...appended]
    group.page = page
    group.loadedCount = slots.length
    group.deviceCount = Number(result.total || group.deviceCount || 0)
    group.hasMore = slots.length < Number(result.total || 0)
    group.children = decorateChildren(group, slots)
    return appended.length > 0 || !group.hasMore
  } catch {
    if (requestId === loadRequestId) group.loadError = true
    return false
  } finally {
    group.loading = false
    if (requestId === loadRequestId) {
      const slots = (group.children || []).filter((node) => node.nodeType === 'slot')
      group.children = slots.length
        ? decorateChildren(group, slots)
        : group.hasMore
          ? [placeholderNode(group.groupId)]
          : []
      await nextTick()
      syncTreeData()
      syncCheckedKeys()
      syncExpandedKeys()
    }
  }
}

function loadExpandedGroup(group: SlotTreeNode) {
  if (!group.groupId) return Promise.resolve()
  const existing = groupLoadPromises.get(group.id)
  if (existing) return existing
  const requestId = loadRequestId
  const pending = (async () => {
    group.loading = true
    group.loadError = false
    try {
      await loadSlotSelectionPages(
        props.filters || {},
        selectionQuery.value,
        group.groupId!,
        {
          startPage: Math.max(1, Number(group.page || 0) + 1),
          pageSize: PAGE_SIZE,
          shouldContinue: () => (
            requestId === loadRequestId
            && Boolean(group.hasMore)
            && expandedGroupKeys.value.includes(group.id)
          ),
          onPage: async (result) => {
            if (requestId !== loadRequestId) return
            const existingSlots = (group.children || []).filter((node) => node.nodeType === 'slot')
            const knownIds = new Set(existingSlots.map((node) => node.slotId))
            const appended = result.items
              .map(toSlotNode)
              .filter((node) => !knownIds.has(node.slotId))
            const slots = [...existingSlots, ...appended]
            group.page = Number(result.page || group.page || 0)
            group.loadedCount = slots.length
            group.deviceCount = Number(result.total || group.deviceCount || 0)
            group.hasMore = slots.length < Number(result.total || 0)
            group.children = decorateChildren(group, slots)
            await nextTick()
            syncTreeData()
            syncCheckedKeys()
            syncExpandedKeys()
          },
        },
      )
    } catch {
      if (requestId === loadRequestId) group.loadError = true
    } finally {
      group.loading = false
      if (requestId === loadRequestId) {
        const slots = (group.children || []).filter((node) => node.nodeType === 'slot')
        group.children = decorateChildren(group, slots)
        await nextTick()
        syncTreeData()
        syncCheckedKeys()
        syncExpandedKeys()
      }
    }
  })().finally(() => {
    if (groupLoadPromises.get(group.id) === pending) groupLoadPromises.delete(group.id)
  })
  groupLoadPromises.set(group.id, pending)
  return pending
}

async function fillInitialViewport() {
  const itemSize = props.showPublishStats ? 56 : 42
  const targetRows = Math.max(8, Math.ceil(treeHeight.value / itemSize))
  let filledRows = 0
  for (const group of visibleTreeData.value) {
    if (filledRows >= targetRows) break
    if (collapsedGroupIds.has(group.id)) continue
    if (!group.loadedCount) await loadGroupPage(group, 1)
    if (!expandedGroupKeys.value.includes(group.id)) {
      expandedGroupKeys.value.push(group.id)
    }
    void loadExpandedGroup(group)
    filledRows += Math.max(1, Number(group.loadedCount || 0))
  }
  await nextTick()
  syncExpandedKeys()
  syncCheckedKeys()
}

async function loadTree() {
  const requestId = ++loadRequestId
  loading.value = true
  try {
    const result = await loadSlotSelectionGroups(props.filters || {}, selectionQuery.value)
    if (requestId !== loadRequestId) return
    selectedWholeGroupIds.clear()
    treeData.value = (Array.isArray(result.groups) ? result.groups : []).map((item) => {
      const groupId = String(item.id || 'ungrouped')
      return {
        id: groupNodeId(groupId),
        nodeType: 'group',
        groupId,
        label: String(item.name || (groupId === 'ungrouped' ? '未分组设备' : groupId)),
        deviceCount: Number(item.device_count || 0),
        loadedCount: 0,
        page: 0,
        hasMore: Number(item.device_count || 0) > 0,
        disabled: Boolean(props.disabled) || Number(item.device_count || 0) === 0,
        children: Number(item.device_count || 0) > 0 ? [placeholderNode(groupId)] : [],
      } satisfies SlotTreeNode
    })
    const availableGroupIds = new Set(treeData.value.map((group) => group.id))
    const validSelectedGroups = selectedGroupNodeIds.value.filter((id) => availableGroupIds.has(id))
    if (validSelectedGroups.length !== selectedGroupNodeIds.value.length) {
      selectedGroupNodeIds.value = validSelectedGroups
    }
    totalCandidateCount.value = Number(result.total || 0)
    expandedGroupKeys.value = []
    await nextTick()
    await fillInitialViewport()
  } finally {
    if (requestId === loadRequestId) loading.value = false
  }
}

async function handleNodeExpand(rawData: AnyRecord) {
  const data = rawData as unknown as SlotTreeNode
  if (data.nodeType !== 'group') return
  await expandGroup(data)
  if (!data.loadedCount) await loadGroupPage(data, 1)
  void loadExpandedGroup(data)
}

function handleNodeCollapse(rawData: AnyRecord) {
  const data = rawData as unknown as SlotTreeNode
  if (data.nodeType !== 'group') return
  collapsedGroupIds.add(data.id)
  expandedGroupKeys.value = expandedGroupKeys.value.filter((id) => id !== data.id)
}

async function handleGroupLabelClick(rawData: AnyRecord) {
  const data = rawData as unknown as SlotTreeNode
  if (data.nodeType !== 'group') return
  if (expandedGroupKeys.value.includes(data.id)) {
    handleNodeCollapse(data as unknown as AnyRecord)
    await nextTick()
    syncExpandedKeys()
    return
  }
  await handleNodeExpand(data as unknown as AnyRecord)
}

async function handleLoadMore(rawData: AnyRecord) {
  const data = rawData as unknown as SlotTreeNode
  if (data.nodeType !== 'load-more' || !data.groupId) return
  const group = treeData.value.find((item) => item.groupId === data.groupId)
  if (group) await loadExpandedGroup(group)
}

async function emitChecked(rawNode: AnyRecord, state: { checkedKeys?: Array<string | number> }) {
  const node = rawNode as unknown as SlotTreeNode
  if (node.nodeType === 'group' && node.groupId) {
    if (node.selecting) return
    const shouldSelect = (state.checkedKeys || []).includes(node.id)
    node.selecting = true
    try {
      const selectionIdsPromise = loadSlotSelectionIds(
        props.filters || {},
        selectionQuery.value,
        node.groupId,
      )
      const result = await selectionIdsPromise
      const targetIds = (result.slot_ids || []).map(String)
      const selected = new Set(selectedSlotIds.value)
      targetIds.forEach((slotId) => {
        if (shouldSelect) selected.add(slotId)
        else selected.delete(slotId)
      })
      emit('update:modelValue', [...selected])
      if (shouldSelect) selectedWholeGroupIds.add(node.id)
      else selectedWholeGroupIds.delete(node.id)
      await nextTick()
      syncCheckedKeys()
    } finally {
      node.selecting = false
      await nextTick()
      syncCheckedKeys()
      syncExpandedKeys()
    }
    return
  }
  if (node.nodeType !== 'slot' || !node.slotId) return
  treeData.value.forEach((group) => {
    if ((group.children || []).some((child) => child.id === node.id)) {
      selectedWholeGroupIds.delete(group.id)
    }
  })
  const selected = new Set(selectedSlotIds.value)
  if ((state.checkedKeys || []).includes(node.id)) selected.add(node.slotId)
  else selected.delete(node.slotId)
  emit('update:modelValue', [...selected])
}

onMounted(() => {
  loadTree()
  if (!props.fillHeight || typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver(() => {
    updateTreeHeight()
  })
  if (rootRef.value) resizeObserver.observe(rootRef.value)
  if (toolbarRef.value) resizeObserver.observe(toolbarRef.value)
  nextTick(updateTreeHeight)
})

onBeforeUnmount(() => {
  loadRequestId += 1
  groupLoadPromises.clear()
  if (reloadTimer) window.clearTimeout(reloadTimer)
  resizeObserver?.disconnect()
})

watch(selectedSlotIds, () => nextTick(syncCheckedKeys))

watch(selectedGroupNodeIds, async () => {
  await nextTick()
  await fillInitialViewport()
})

watch(
  requestSignature,
  () => {
    if (reloadTimer) window.clearTimeout(reloadTimer)
    reloadTimer = window.setTimeout(() => {
      reloadTimer = undefined
      loadTree()
    }, 300)
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
          placeholder="设备名称 / ID，多个用逗号分隔"
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
      :default-expanded-keys="expandedGroupKeys"
      :check-strictly="true"
      :expand-on-click-node="false"
      scrollbar-always-on
      empty-text="暂无可选设备"
      @check="emitChecked"
      @node-expand="handleNodeExpand"
      @node-collapse="handleNodeCollapse"
    >
      <template #default="{ data }">
        <button
          v-if="data.nodeType === 'load-more'"
          type="button"
          class="slot-tree-load-more"
          :disabled="data.loading"
          @click.stop="handleLoadMore(data)"
        >
          {{ data.label }}
        </button>
        <span
          v-else
          class="slot-tree-node"
          :class="{ 'slot-tree-node--section-end': data.separatorAfter }"
        >
          <span class="slot-tree-node__copy">
            <span
              class="slot-tree-node__label"
              :class="{ 'slot-tree-node__label--group': data.nodeType === 'group' }"
              @click.stop="handleGroupLabelClick(data)"
            >{{ data.label }}</span>
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
          <el-tag
            v-else-if="data.nodeType === 'group'"
            size="small"
            type="info"
            effect="plain"
            round
          >
            {{ data.loading ? '加载中' : `${data.deviceCount || 0} 台` }}
          </el-tag>
        </span>
      </template>
    </el-tree-v2>
  </div>
</template>

<style scoped>
.slot-tree-select {
  width: 100%;
  min-height: 260px;
  max-height: 420px;
  box-sizing: border-box;
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

.slot-tree-node--section-end {
  padding-bottom: 6px;
}

.slot-tree-node--section-end::after {
  position: absolute;
  right: 10px;
  bottom: 2px;
  left: 4px;
  height: 1px;
  background: #c8d5e2;
  content: '';
}

.slot-tree-node__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  line-height: 1.3;
}

.slot-tree-node__label,
.slot-tree-node__id,
.slot-tree-node__account {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slot-tree-node__label--group {
  cursor: pointer;
}

.slot-tree-node__id {
  color: #7b8da1;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10px;
}

.slot-tree-node__account {
  color: #65778a;
  font-size: 11px;
}

.slot-tree-node__tags {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
}

.slot-tree-load-more {
  width: 100%;
  height: 30px;
  border: 0;
  background: transparent;
  color: #1f668f;
  cursor: pointer;
  font-size: 12px;
  text-align: left;
}

.slot-tree-load-more:hover {
  color: #164e73;
  text-decoration: underline;
}

.slot-tree-load-more:disabled {
  color: #9aa8b7;
  cursor: wait;
  text-decoration: none;
}
</style>
