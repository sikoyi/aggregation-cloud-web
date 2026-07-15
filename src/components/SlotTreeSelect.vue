<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import { getAllPages } from '@/api/http'
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
  status?: string
  deviceCount?: number
  disabled?: boolean
  children?: SlotTreeNode[]
}

const treeRef = ref()
const loading = ref(false)
const treeData = ref<SlotTreeNode[]>([])
const groupedSlotCount = ref(0)
const totalSlotCount = ref(0)
const loadedSlotIds = ref<Set<string>>(new Set())
const treeProps = {
  label: 'label',
  children: 'children',
  disabled: 'disabled',
}

const selectedSlotIds = computed(() =>
  Array.isArray(props.modelValue) ? props.modelValue.filter(Boolean).map(String) : [],
)
const selectedSlotCount = computed(() =>
  selectedSlotIds.value.filter((slotId) => loadedSlotIds.value.has(slotId)).length,
)

function slotNodeId(slotId: string) {
  return `slot:${slotId}`
}

function queryParams(extra: AnyRecord = {}) {
  const filters = props.filters || {}
  return {
    provider: filters.provider || undefined,
    business_platform: filters.business_platform || undefined,
    runtime_platform: filters.runtime_platform || undefined,
    ...extra,
  }
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
  return {
    id: slotNodeId(String(slot.id)),
    slotId: String(slot.id),
    providerSlotId: String(slot.provider_slot_id || ''),
    label: slotLabel(slot),
    status: String(slot.status || 'offline'),
    disabled: slot.status === 'disabled',
  }
}

function syncCheckedKeys() {
  const keys = selectedSlotIds.value.map(slotNodeId)
  treeRef.value?.setCheckedKeys?.(keys)
}

async function loadTree() {
  loading.value = true
  try {
    const groupParams = queryParams()
    const slotParams = queryParams()
    delete slotParams.runtime_platform

    const [groups, slots] = await Promise.all([
      getAllPages<AnyRecord>('/api/slot-groups', groupParams),
      getAllPages<AnyRecord>('/api/execution-slots', slotParams),
    ])

    const eligibleSlotIds = new Set(slots.map((slot) => String(slot.id)))
    const groupedSlotIds = new Set<string>()
    const groupNodes = await Promise.all(
      groups.map(async (group) => {
        const groupSlots = await getAllPages<AnyRecord>(
          `/api/slot-groups/${encodeURIComponent(String(group.id))}/slots`,
          {},
        )
        const items = groupSlots.filter((slot) => eligibleSlotIds.has(String(slot.id)))
        items.forEach((slot) => groupedSlotIds.add(String(slot.id)))
        return {
          id: `group:${group.id}`,
          label: String(group.name || group.id),
          deviceCount: items.length,
          disabled: !items.length,
          children: items.map(toSlotNode),
        }
      }),
    )

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
              deviceCount: ungroupedSlots.length,
              children: ungroupedSlots.map(toSlotNode),
            },
          ]
        : []),
    ]

    await nextTick()
    syncCheckedKeys()
  } finally {
    loading.value = false
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

watch(selectedSlotIds, () => nextTick(syncCheckedKeys))

watch(
  () => props.filters,
  () => loadTree(),
  { deep: true },
)
</script>

<template>
  <div class="slot-tree-select" v-loading="loading">
    <div class="slot-tree-summary">
      <span>分组设备 <strong>{{ groupedSlotCount }}</strong></span>
      <span>已选设备 <strong>{{ selectedSlotCount }}</strong></span>
      <span>设备总数 <strong>{{ totalSlotCount }}</strong></span>
    </div>
    <el-tree
      ref="treeRef"
      :data="treeData"
      :props="treeProps"
      node-key="id"
      show-checkbox
      default-expand-all
      :check-strictly="false"
      :expand-on-click-node="false"
      :disabled="disabled"
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
    </el-tree>
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

.slot-tree-select :deep(.el-tree) {
  background: transparent;
}

.slot-tree-summary {
  position: sticky;
  z-index: 2;
  top: -10px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin: -10px -12px 10px;
  padding: 10px 12px;
  border-bottom: 1px solid #dbe4f0;
  background: rgb(248 250 252 / 96%);
  color: #65778a;
  font-size: 12px;
  text-align: center;
  backdrop-filter: blur(4px);
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
