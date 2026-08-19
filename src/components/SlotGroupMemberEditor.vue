<script setup lang="ts">
import { Eye, Plus, Search, Trash2 } from 'lucide-vue-next'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { http } from '@/api/http'
import DeviceTableCell from '@/components/DeviceTableCell.vue'
import RemoteSelect from '@/components/RemoteSelect.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useCrossPageTableSelection } from '@/composables/useCrossPageTableSelection'
import { REALTIME_EVENT_NAME, type RealtimeEventPayload } from '@/composables/useRealtimeEvents'
import { businessPlatformLabel, runtimePlatformOptions } from '@/config/options'
import type { AnyRecord, PageResult } from '@/types/api'
import type { ColumnConfig, RemoteSelectConfig } from '@/types/crud'
import { formatDate } from '@/utils/format'
import { getErrorMessage, notifyError } from '@/utils/notify'

const props = defineProps<{
  group: AnyRecord
}>()

const emit = defineEmits<{
  changed: []
}>()

const loading = ref(false)
const submitting = ref(false)
const keyword = ref('')
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const members = ref<AnyRecord[]>([])
const {
  tableRef: memberTableRef,
  selectedRows: selectedMembers,
  handleSelectionChange,
  restorePageSelection,
  clearSelection: clearMemberSelection,
} = useCrossPageTableSelection(members, (row) => String(row.id))
const selectedSlotIds = ref<string[]>([])
const slotDetailVisible = ref(false)
const slotDetailLoading = ref(false)
const slotDetail = ref<AnyRecord | null>(null)
const groupSyncColumn: ColumnConfig = { key: 'group_name', label: '分组同步' }
let realtimeRefreshTimer: number | undefined

const groupId = computed(() => String(props.group?.id || ''))
const selectedMemberIds = computed(() => selectedMembers.value.map((item) => String(item.id)))

const availableSlotSelect = computed<RemoteSelectConfig>(() => ({
  endpoint: '/api/execution-slots',
  labelKeys: ['display_name', 'provider_slot_id', 'provider_slot_no'],
  valueKey: 'id',
  detailPath: (value: string) => `/api/execution-slots/${encodeURIComponent(value)}`,
  secondaryKeys: ['provider_slot_id', 'provider', 'status'],
  searchParam: 'keyword',
  pageSize: 50,
  multiple: true,
  params: {
    runtime_platform: props.group?.runtime_platform,
    provider: props.group?.provider,
    exclude_group_id: groupId.value,
  },
}))

async function loadMembers() {
  if (!groupId.value) return
  loading.value = true
  try {
    const data = await http.get<PageResult<AnyRecord>>(
      `/api/slot-groups/${groupId.value}/slots`,
      {
        keyword: keyword.value || undefined,
        page: page.value,
        page_size: pageSize.value,
      },
    )
    members.value = data.items
    total.value = data.total
    await restorePageSelection()
  } catch (err) {
    notifyError(err, '加载组内设备失败', '加载组内设备失败')
  } finally {
    loading.value = false
  }
}

async function addMembers() {
  if (!selectedSlotIds.value.length) {
    ElMessage.warning('请选择要添加的设备')
    return
  }

  submitting.value = true
  const slotIds = [...selectedSlotIds.value]
  try {
    const data = await http.post<AnyRecord>(`/api/slot-groups/${groupId.value}/slots/batch`, {
      slot_ids: slotIds,
    })
    const localApplied = Number(data.local_applied_count || 0)
    const submitted = Number(data.submitted_count || 0)
    const skipped = Number(data.skipped_count || 0)
    const failed = Number(data.failed_count || 0)
    selectedSlotIds.value = []
    ElNotification({
      type: failed ? 'warning' : submitted ? 'info' : 'success',
      title: failed ? '设备分组部分失败' : '设备分组处理完成',
      message: `本地生效 ${localApplied} 台，远端已提交 ${submitted} 台，跳过 ${skipped} 台，失败 ${failed} 台`,
      duration: 7000,
    })
    page.value = 1
    await loadMembers()
    emit('changed')
  } catch (err) {
    notifyError(err, '添加设备失败', '添加设备失败')
  } finally {
    submitting.value = false
  }
}

async function openSlotDetail(slot: AnyRecord) {
  slotDetailVisible.value = true
  slotDetailLoading.value = true
  slotDetail.value = slot
  try {
    slotDetail.value = await http.get<AnyRecord>(`/api/execution-slots/${slot.id}`)
  } catch (err) {
    notifyError(err, '加载设备详情失败', '加载设备详情失败')
  } finally {
    slotDetailLoading.value = false
  }
}

async function removeMember(slot: AnyRecord) {
  try {
    await ElMessageBox.confirm(
      `确认从该分组移除设备「${slot.display_name || slot.provider_slot_id || '未命名设备'}」？`,
      '移除设备',
      {
        type: 'warning',
        confirmButtonText: '移除',
        cancelButtonText: '取消',
      },
    )
  } catch {
    return
  }

  submitting.value = true
  try {
    const data = await http.delete<AnyRecord>(`/api/slot-groups/${groupId.value}/slots/${slot.id}`)
    const remoteSubmitted = data.mode === 'remote_submitted'
    ElNotification({
      type: remoteSubmitted ? 'info' : 'success',
      title: remoteSubmitted ? '移出分组已提交' : '设备已移出分组',
      message: remoteSubmitted ? '供应商确认后，系统中的成员关系才会更新' : '分组成员关系已更新',
      duration: 6000,
    })
    if (members.value.length === 1 && page.value > 1) page.value -= 1
    clearMemberSelection()
    await loadMembers()
    emit('changed')
  } catch (err) {
    notifyError(err, '移除设备失败', '移除设备失败')
  } finally {
    submitting.value = false
  }
}

async function removeSelectedMembers() {
  if (!selectedMemberIds.value.length) {
    ElMessage.warning('请选择要移除的设备')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确认从该分组移除已选 ${selectedMemberIds.value.length} 台设备？`,
      '批量移除设备',
      {
        type: 'warning',
        confirmButtonText: '移除',
        cancelButtonText: '取消',
      },
    )
  } catch {
    return
  }

  submitting.value = true
  const slotIds = [...selectedMemberIds.value]
  let localApplied = 0
  let submitted = 0
  const failures: string[] = []
  try {
    for (const slotId of slotIds) {
      try {
        const data = await http.delete<AnyRecord>(`/api/slot-groups/${groupId.value}/slots/${slotId}`)
        if (data.mode === 'remote_submitted') submitted += 1
        else if (data.changed) localApplied += 1
      } catch (err) {
        failures.push(`${slotId}：${getErrorMessage(err, '移除失败')}`)
      }
    }
    ElNotification({
      type: failures.length ? 'warning' : submitted ? 'info' : 'success',
      title: failures.length ? '批量移除部分失败' : '批量移除处理完成',
      message: `本地生效 ${localApplied} 台，远端已提交 ${submitted} 台，失败 ${failures.length} 台${failures.length ? `；${failures.slice(0, 2).join('；')}` : ''}`,
      duration: 8000,
    })
    clearMemberSelection()
    if (members.value.length <= slotIds.length && page.value > 1) page.value -= 1
    await loadMembers()
    emit('changed')
  } catch (err) {
    notifyError(err, '批量移除失败', '批量移除失败')
  } finally {
    submitting.value = false
  }
}

function searchMembers() {
  clearMemberSelection()
  page.value = 1
  loadMembers()
}

function handlePageSizeChange() {
  page.value = 1
  loadMembers()
}

function text(value: unknown) {
  return value === undefined || value === null || value === '' ? '-' : String(value)
}

function runtimePlatformLabel(value: unknown) {
  const option = runtimePlatformOptions.find((item) => item.value === String(value || ''))
  return option?.label || text(value)
}

function resetSearch() {
  keyword.value = ''
  searchMembers()
}

function handleRealtimeEvent(event: Event) {
  const payload = (event as CustomEvent<RealtimeEventPayload>).detail
  if (payload?.topic !== 'runtime' || realtimeRefreshTimer) return
  realtimeRefreshTimer = window.setTimeout(async () => {
    realtimeRefreshTimer = undefined
    await loadMembers()
  }, 1200)
}

watch(
  () => props.group?.id,
  () => {
    page.value = 1
    keyword.value = ''
    selectedSlotIds.value = []
    clearMemberSelection()
    loadMembers()
  },
)

onMounted(() => {
  loadMembers()
  window.addEventListener(REALTIME_EVENT_NAME, handleRealtimeEvent)
})

onBeforeUnmount(() => {
  window.removeEventListener(REALTIME_EVENT_NAME, handleRealtimeEvent)
  if (realtimeRefreshTimer) window.clearTimeout(realtimeRefreshTimer)
})
</script>

<template>
  <section class="member-editor">
    <div class="member-editor__header">
      <div>
        <h3>组内设备</h3>
        <p>当前分组内设备可在这里添加、搜索、查看详情和移除。</p>
      </div>
      <el-tag size="small" effect="plain">共 {{ total }} 台</el-tag>
    </div>

    <div class="member-editor__add">
      <RemoteSelect
        v-model="selectedSlotIds"
        :config="availableSlotSelect"
        :context="group"
        placeholder="搜索并选择要加入分组的设备"
      />
      <el-button type="primary" :icon="Plus" :loading="submitting" @click="addMembers">
        添加设备
      </el-button>
    </div>

    <div class="member-editor__search">
      <el-input
        v-model="keyword"
        clearable
        @input="clearMemberSelection"
        placeholder="搜索设备名称 / 设备 ID / 序号"
        @keydown.enter="searchMembers"
      />
      <el-button :icon="Search" :loading="loading" @click="searchMembers">搜索</el-button>
      <el-button :disabled="!keyword" @click="resetSearch">清空</el-button>
    </div>

    <div v-if="selectedMembers.length" class="member-editor__batch">
      <span>已选 {{ selectedMembers.length }} 台设备</span>
      <el-button
        size="small"
        type="danger"
        plain
        :icon="Trash2"
        :loading="submitting"
        @click="removeSelectedMembers"
      >
        批量移除
      </el-button>
    </div>

    <el-table
      ref="memberTableRef"
      v-loading="loading"
      :data="members"
      row-key="id"
      border
      stripe
      table-layout="auto"
      class="member-editor__table"
      empty-text="暂无组内设备"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="44" reserve-selection />
      <el-table-column prop="provider_slot_id" label="设备 ID" min-width="170" />
      <el-table-column prop="display_name" label="名称" min-width="170" />
      <el-table-column prop="provider_slot_no" label="序号" min-width="130" />
      <el-table-column prop="status" label="状态" min-width="110" align="center" header-align="center">
        <template #default="{ row }">
          <StatusBadge :value="row.status" />
        </template>
      </el-table-column>
      <el-table-column label="分组同步" min-width="160">
        <template #default="{ row }">
          <DeviceTableCell kind="deviceGroup" :row="row" :column="groupSyncColumn" />
        </template>
      </el-table-column>
      <el-table-column prop="last_seen_at" label="心跳" min-width="170" align="center" header-align="center">
        <template #default="{ row }">
          {{ formatDate(row.last_seen_at) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="112" fixed="right" align="center" header-align="center">
        <template #default="{ row }">
          <el-space :size="2">
            <el-tooltip content="查看详情" placement="top">
              <el-button text circle :icon="Eye" :disabled="submitting" @click="openSlotDetail(row)" />
            </el-tooltip>
            <el-tooltip content="移除设备" placement="top">
              <el-button text circle type="danger" :icon="Trash2" :disabled="submitting" @click="removeMember(row)" />
            </el-tooltip>
          </el-space>
        </template>
      </el-table-column>
    </el-table>

    <div class="member-editor__pagination">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        background
        layout="total, sizes, prev, pager, next"
        :page-sizes="[10, 20, 50]"
        :total="total"
        @current-change="loadMembers"
        @size-change="handlePageSizeChange"
      />
    </div>

    <el-dialog
      v-model="slotDetailVisible"
      title="设备详情"
      width="720px"
      append-to-body
      destroy-on-close
    >
      <div v-loading="slotDetailLoading">
        <el-descriptions v-if="slotDetail" :column="2" border>
          <el-descriptions-item label="设备 ID">
            <span class="font-mono text-xs">{{ text(slotDetail.provider_slot_id) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <StatusBadge :value="slotDetail.status" />
          </el-descriptions-item>
          <el-descriptions-item label="名称">{{ text(slotDetail.display_name) }}</el-descriptions-item>
          <el-descriptions-item label="Provider 序号">{{ text(slotDetail.provider_slot_no) }}</el-descriptions-item>
          <el-descriptions-item label="供应商">{{ text(slotDetail.provider) }}</el-descriptions-item>
          <el-descriptions-item label="业务 App">{{ businessPlatformLabel(slotDetail.business_platform) }}</el-descriptions-item>
          <el-descriptions-item label="执行平台">{{ runtimePlatformLabel(slotDetail.runtime_platform) }}</el-descriptions-item>
          <el-descriptions-item label="账号 ID">
            <span class="font-mono text-xs">{{ text(slotDetail.bound_account_id) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="代理 ID">
            <span class="font-mono text-xs">{{ text(slotDetail.proxy_id) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="Runtime ID">
            <span class="font-mono text-xs">{{ text(slotDetail.runtime_instance_id) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="当前任务 ID">
            <span class="font-mono text-xs">{{ text(slotDetail.current_task_run_id) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="最近心跳">{{ formatDate(slotDetail.last_seen_at) }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{ formatDate(slotDetail.updated_at) }}</el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>
  </section>
</template>

<style scoped>
.member-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border: 1px solid #e6edf3;
  border-radius: 8px;
  background: #ffffff;
}

.member-editor__header,
.member-editor__add,
.member-editor__search,
.member-editor__batch,
.member-editor__pagination {
  display: flex;
  align-items: center;
  gap: 10px;
}

.member-editor__header {
  justify-content: space-between;
}

.member-editor__batch {
  justify-content: space-between;
  min-height: 40px;
  padding: 8px 10px;
  border: 1px solid #dbe4f0;
  border-radius: 8px;
  background: #f8fafc;
  color: #52606d;
  font-size: 13px;
}

.member-editor__header h3 {
  margin: 0;
  color: #1f2933;
  font-size: 15px;
  font-weight: 700;
}

.member-editor__header p {
  margin: 4px 0 0;
  color: #7b8794;
  font-size: 12px;
}

.member-editor__add :deep(.el-select),
.member-editor__search :deep(.el-input) {
  flex: 1;
}

.member-editor__table :deep(.el-table__cell) {
  padding: 8px 0;
}

.member-editor__pagination {
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .member-editor__header,
  .member-editor__add,
  .member-editor__search,
  .member-editor__batch {
    align-items: stretch;
    flex-direction: column;
  }

  .member-editor__pagination {
    justify-content: flex-start;
    overflow-x: auto;
  }
}
</style>
