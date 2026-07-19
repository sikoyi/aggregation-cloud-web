<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Search } from 'lucide-vue-next'

import { loadSlotSelectionOptions } from '@/api/selectionOptions'
import type { AnyRecord } from '@/types/api'
import { statusLabel, statusTagType } from '@/utils/format'

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
const groupedSlotCount = ref(0)
const totalSlotCount = ref(0)
const loadedSlotIds = ref<Set<string>>(new Set())
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
    groupedSlotCount.value = groupedSlotIds.size
    totalSlotCount.value = slots.length
    treeData.value = [
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

    await nextTick()
    syncCheckedKeys()
    treeRef.value?.setExpandedKeys?.(treeData.value.map((node) => node.id))
    treeRef.value?.filter?.(searchKeyword.value)
  } finally {
    if (requestId === loadRequestId) loading.value = false
  }
}

function emitChecked() {
  const checkedNodes = (treeRef.value?.getCheckedNodes?.(true) || []) as SlotTreeNode[]
  emit(
    'update:modelValue',
    checkedNodes
      .map((node) => node.slotId)
      .filter((slotId): slotId is string => Boolean(slotId)),
  )
}

onMounted(loadTree)

onBeforeUnmount(() => {
  loadRequestId += 1
  if (filterReloadTimer) window.clearTimeout(filterReloadTimer)
})

watch(selectedSlotIds, () => nextTick(syncCheckedKeys))

watch(searchKeyword, (value) => treeRef.value?.filter?.(value))

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
        <span>分组设备 <strong>{{ groupedSlotCount }}</strong></span>
        <span>已选设备 <strong>{{ selectedSlotCount }}</strong></span>
        <span>设备总数 <strong>{{ totalSlotCount }}</strong></span>
      </div>
      <el-input
        v-model="searchKeyword"
        :prefix-icon="Search"
        clearable
        placeholder="搜索设备名称 / Provider ID"
      />
    </div>
    <el-tree-v2
      ref="treeRef"
      :data="treeData"
      :props="treeProps"
      :height="treeHeight"
      :item-size="38"
      show-checkbox
      :default-expanded-keys="treeData.map((node) => node.id)"
      :check-strictly="false"
      :expand-on-click-node="false"
      :filter-method="filterNode"
      scrollbar-always-on
      empty-text="暂无可选设备"
      @check="emitChecked"
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
