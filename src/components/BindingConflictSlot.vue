<script setup lang="ts">
import { Copy, ExternalLink } from 'lucide-vue-next'
import { ElMessage } from 'element-plus'

import type { BindingConflictSlot } from '@/api/bindingConflicts'

withDefaults(defineProps<{ slot: BindingConflictSlot | null; restricted: boolean; canNavigate: boolean; emptyText?: string }>(), {
  emptyText: '环境已不存在',
})
defineEmits<{ navigate: [id: string] }>()

async function copyId(id: string) {
  try {
    await navigator.clipboard.writeText(id)
    ElMessage.success('ID 已复制')
  } catch {
    ElMessage.error('复制失败，请手动复制 ID')
  }
}
</script>

<template>
  <div class="conflict-slot">
    <span v-if="restricted" class="conflict-slot__empty">无权查看此环境</span>
    <template v-else-if="slot">
      <strong>{{ slot.display_name || slot.provider_slot_id || `设备 #${slot.id}` }}</strong>
      <div class="conflict-slot__id">
        <span>环境 ID <code>{{ slot.provider_slot_id || '-' }}</code></span>
        <el-tooltip v-if="slot.provider_slot_id" content="复制环境 ID" placement="top">
          <el-button text circle :icon="Copy" aria-label="复制环境 ID" @click="copyId(slot.provider_slot_id)" />
        </el-tooltip>
      </div>
      <div class="conflict-slot__id">
        <span>设备记录 ID <code>{{ slot.id }}</code></span>
        <el-tooltip content="复制设备记录 ID" placement="top">
          <el-button text circle :icon="Copy" aria-label="复制设备记录 ID" @click="copyId(slot.id)" />
        </el-tooltip>
        <el-tooltip v-if="canNavigate" content="定位设备" placement="top">
          <el-button text circle type="primary" :icon="ExternalLink" aria-label="定位设备" @click="$emit('navigate', slot.id)" />
        </el-tooltip>
      </div>
    </template>
    <span v-else class="conflict-slot__empty">{{ emptyText }}</span>
  </div>
</template>

<style scoped>
.conflict-slot { display: flex; min-width: 0; flex-direction: column; gap: 4px; }
.conflict-slot strong { color: var(--app-text, #334e68); font-size: 13px; overflow-wrap: anywhere; }
.conflict-slot__id { display: flex; align-items: center; gap: 4px; color: var(--app-text-muted, #66788a); font-size: 11px; }
.conflict-slot__id > span { min-width: 0; overflow-wrap: anywhere; }
.conflict-slot__id code { color: var(--app-blue, #28719f); }
.conflict-slot__id :deep(.el-button) { width: 26px; height: 26px; flex: 0 0 26px; margin-left: 0; }
.conflict-slot__empty { color: var(--app-text-muted, #8494a5); font-size: 12px; }
</style>
