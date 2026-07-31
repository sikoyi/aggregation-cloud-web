<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ListFilter, Search, X } from 'lucide-vue-next'

import { loadSlotSelectionOptions } from '@/api/selectionOptions'
import type { AnyRecord } from '@/types/api'
import { statusLabel, statusTagType } from '@/utils/format'
import { countFilteredTreeLeaves } from '@/utils/treeSelectionStats'
import { reconcileExpandedGroupKeys } from '@/utils/treeExpansion'

const props = defineProps<{
  modelValue: unknown
  disabled?: boolean
  filters?: AnyRecord
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
  deviceCount?: number
  disabled?: boolean
  children?: SlotTreeNode[]
}

const treeRef = ref()
const loading = ref(false)
const searchKeyword = ref('')
const treeData = ref<SlotTreeNode[]>([])
const selectedGroupNodeIds = ref<string[]>([])
const totalSlotCount = ref(0)
const loadedSlotIds = ref<Set<string>>(new Set())
const defaultExpandedGroupKeys = ref<string[]>([])
const collapsedGroupIds = new Set<string>()
const treeProps = {
  label: 'label',
  children: 'children',
  disabled: 'disabled',
  value: 'id',
}
const treeHeight = 350

const selectedSlotIds = computed(() =>
  Array.isArray(props.modelValue) ? props.modelValue.filter(Boolean).map(String) : [],
)
const selectedSlotCount = computed(() =>
  selectedSlotIds.value.filter((slotId) => loadedSlotIds.value.has(slotId)).length,
)
const groupOptions = computed(() => treeData.value.map((node) => ({
  value: node.id,
  label: node.label,
})))
const visibleTreeData = computed(() => {
  if (!selectedGroupNodeIds.value.length) return treeData.value
  const selectedIds = new Set(selectedGroupNodeIds.value)
  return treeData.value.filter((node) => selectedIds.has(node.id))
})
const filteredSlotCount = computed(() =>
  countFilteredTreeLeaves(visibleTreeData.value, searchKeyword.value),
)
const filterSignature = computed(() => JSON.stringify({
  business_platform: String(props.filters?.business_platform || ''),
  runtime_platform: String(props.filters?.runtime_platform || ''),
  provider: String(props.filters?.provider || ''),
}))
let loadRequestId = 0
let filterReloadTimer: number | undefined

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
    searchText: [label, providerSlotId, slot.provider_slot_no]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
    status: String(slot.status || 'offline'),
    disabled: Boolean(props.disabled) || slot.status === 'disabled',
  }
}

function filterNode(value: string, data: AnyRecord) {
  const keyword = value.trim().toLowerCase()
  if (!keyword) return true
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
    const slots = await loadSlotSelectionOptions(props.filters || {})
    if (requestId !== loadRequestId) return

    const eligibleSlotIds = new Set(slots.map((slot) => String(slot.id)))
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
    loadedSlotIds.value = eligibleSlotIds
    totalSlotCount.value = slots.length
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

    await nextTick()
    syncCheckedKeys()
    syncExpandedKeys()
    treeRef.value?.filter?.(searchKeyword.value)
  } finally {
    if (requestId === loadRequestId) loading.value = false
  }
}

function emitChecked() {
  const checkedNodes = (treeRef.value?.getCheckedNodes?.(true) || []) as SlotTreeNode[]
  const visibleSlotIds = new Set(
    visibleTreeData.value.flatMap((group) => group.children || []).map((node) => node.slotId),
  )
  const hiddenSelectedSlotIds = selectedSlotIds.value.filter(
    (slotId) => !visibleSlotIds.has(slotId),
  )
  emit(
    'update:modelValue',
    [
      ...hiddenSelectedSlotIds,
      ...checkedNodes
        .map((node) => node.slotId)
        .filter((slotId): slotId is string => Boolean(slotId)),
    ],
  )
}

onMounted(loadTree)

onBeforeUnmount(() => {
  loadRequestId += 1
  if (filterReloadTimer) window.clearTimeout(filterReloadTimer)
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
  <div class="slot-tree-select" v-loading="loading">
    <div class="slot-tree-toolbar">
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
              :type="selectedGroupNodeIds.length ? 'primary' : 'default'"
              plain
              :icon="ListFilter"
            >
              {{ selectedGroupNodeIds.length ? `已筛 ${selectedGroupNodeIds.length} 组` : '筛选分组' }}
            </el-button>
          </template>
          <div class="group-filter-popover">
            <div class="group-filter-popover__header">
              <span>显示设备分组</span>
              <el-button
                v-if="selectedGroupNodeIds.length"
                link
                type="primary"
                :icon="X"
                @click="selectedGroupNodeIds = []"
              >
                显示全部
              </el-button>
            </div>
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
      :item-size="38"
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
        <span class="slot-tree-node">
          <span class="slot-tree-node__copy">
            <span class="slot-tree-node__label">{{ data.label }}</span>
            <span v-if="data.providerSlotId" class="slot-tree-node__id">{{ data.providerSlotId }}</span>
          </span>
          <el-tag
            v-if="data.slotId"
            size="small"
            :type="statusTagType(data.status)"
            effect="light"
            round
          >
            {{ statusLabel(data.status) }}
          </el-tag>
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin-bottom: 8px;
  color: #65778a;
  font-size: 12px;
  text-align: center;
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

.group-filter-popover__header {
  display: flex;
  min-height: 32px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  color: #27364a;
  font-weight: 600;
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
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-right: 8px;
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
</style>
