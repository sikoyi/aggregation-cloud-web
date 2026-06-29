<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import { http } from '@/api/http'
import type { AnyRecord, PageResult } from '@/types/api'

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
  label: string
  disabled?: boolean
  children?: SlotTreeNode[]
}

const treeRef = ref()
const loading = ref(false)
const treeData = ref<SlotTreeNode[]>([])
const treeProps = {
  label: 'label',
  children: 'children',
  disabled: 'disabled',
}

const selectedSlotIds = computed(() =>
  Array.isArray(props.modelValue) ? props.modelValue.filter(Boolean).map(String) : [],
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
    page: 1,
    page_size: 100,
    ...extra,
  }
}

function slotLabel(slot: AnyRecord) {
  return String(
    slot.display_name ||
      slot.provider_slot_no ||
      slot.provider_slot_id ||
      slot.id,
  )
}

function toSlotNode(slot: AnyRecord): SlotTreeNode {
  return {
    id: slotNodeId(String(slot.id)),
    slotId: String(slot.id),
    label: slotLabel(slot),
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

    const [groupsPage, slotsPage] = await Promise.all([
      http.get<PageResult<AnyRecord>>('/api/slot-groups', groupParams),
      http.get<PageResult<AnyRecord>>('/api/execution-slots', slotParams),
    ])

    const groupedSlotIds = new Set<string>()
    const groupNodes = await Promise.all(
      groupsPage.items.map(async (group) => {
        const slots = await http.get<PageResult<AnyRecord>>(
          `/api/slot-groups/${encodeURIComponent(String(group.id))}/slots`,
          { page: 1, page_size: 100 },
        )
        slots.items.forEach((slot) => groupedSlotIds.add(String(slot.id)))
        return {
          id: `group:${group.id}`,
          label: String(group.name || group.id),
          disabled: !slots.items.length,
          children: slots.items.map(toSlotNode),
        }
      }),
    )

    const ungroupedSlots = slotsPage.items.filter((slot) => !groupedSlotIds.has(String(slot.id)))
    treeData.value = [
      ...groupNodes,
      ...(ungroupedSlots.length
        ? [
            {
              id: 'group:ungrouped',
              label: '未分组设备',
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
    />
  </div>
</template>

<style scoped>
.slot-tree-select {
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
</style>
