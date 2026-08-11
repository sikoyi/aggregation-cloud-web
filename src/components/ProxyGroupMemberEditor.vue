<script setup lang="ts">
import { Eye, Search, Trash2, UserPlus } from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref, watch } from 'vue'

import { http } from '@/api/http'
import RemoteSelect from '@/components/RemoteSelect.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useCrossPageTableSelection } from '@/composables/useCrossPageTableSelection'
import { proxyModeOptions, proxyProtocolOptions, proxyUsageStatusOptions } from '@/config/options'
import type { AnyRecord, PageResult } from '@/types/api'
import type { RemoteSelectConfig } from '@/types/crud'
import { formatCell, formatDate, truncateId } from '@/utils/format'
import { notifyError } from '@/utils/notify'

const props = defineProps<{
  group: AnyRecord
}>()

const emit = defineEmits<{
  changed: []
}>()

const loading = ref(false)
const submitting = ref(false)
const keyword = ref('')
const proxyType = ref('')
const proxyMode = ref('')
const status = ref('')
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
const selectedProxyIds = ref<string[]>([])
const proxyDetailVisible = ref(false)
const proxyDetailLoading = ref(false)
const proxyDetail = ref<AnyRecord | null>(null)

const groupId = computed(() => String(props.group?.id || ''))
const selectedMemberIds = computed(() => selectedMembers.value.map((item) => String(item.id)))

const availableProxySelect = computed<RemoteSelectConfig>(() => ({
  endpoint: '/api/resource-center/proxies',
  labelKeys: ['name', 'source_proxy_url', 'host'],
  valueKey: 'id',
  detailPath: (value: string) => `/api/resource-center/proxies/${encodeURIComponent(value)}`,
  secondaryKeys: ['proxy_type', 'proxy_mode', 'status'],
  searchParam: 'keyword',
  pageSize: 50,
  multiple: true,
  params: {
    exclude_group_id: groupId.value,
  },
}))

async function loadMembers() {
  if (!groupId.value) return
  loading.value = true
  try {
    const data = await http.get<PageResult<AnyRecord>>(
      `/api/resource-center/proxy-groups/${groupId.value}/proxies`,
      {
        keyword: keyword.value || undefined,
        proxy_type: proxyType.value || undefined,
        proxy_mode: proxyMode.value || undefined,
        status: status.value || undefined,
        page: page.value,
        page_size: pageSize.value,
      },
    )
    members.value = data.items
    total.value = data.total
    await restorePageSelection()
  } catch (err) {
    notifyError(err, '加载组内代理失败', '加载组内代理失败')
  } finally {
    loading.value = false
  }
}

async function addMembers() {
  if (!selectedProxyIds.value.length) {
    ElMessage.warning('请选择要添加的代理')
    return
  }

  submitting.value = true
  try {
    const data = await http.post<AnyRecord>(`/api/resource-center/proxy-groups/${groupId.value}/proxies`, {
      proxy_ids: selectedProxyIds.value,
    })
    selectedProxyIds.value = []
    ElMessage.success(`已添加 ${Number(data.added_count || 0)} 个代理`)
    page.value = 1
    await loadMembers()
    emit('changed')
  } catch (err) {
    notifyError(err, '添加代理失败', '添加代理失败')
  } finally {
    submitting.value = false
  }
}

async function openProxyDetail(proxy: AnyRecord) {
  proxyDetailVisible.value = true
  proxyDetailLoading.value = true
  proxyDetail.value = proxy
  try {
    proxyDetail.value = await http.get<AnyRecord>(`/api/resource-center/proxies/${proxy.id}`)
  } catch (err) {
    notifyError(err, '加载代理详情失败', '加载代理详情失败')
  } finally {
    proxyDetailLoading.value = false
  }
}

async function removeMember(proxy: AnyRecord) {
  try {
    await ElMessageBox.confirm(
      `确认从该分组移除代理「${proxy.name || proxy.source_proxy_url || proxy.id}」？`,
      '移除代理',
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
    await http.delete(`/api/resource-center/proxy-groups/${groupId.value}/proxies/${proxy.id}`)
    ElMessage.success('代理已移出分组')
    if (members.value.length === 1 && page.value > 1) page.value -= 1
    clearMemberSelection()
    await loadMembers()
    emit('changed')
  } catch (err) {
    notifyError(err, '移除代理失败', '移除代理失败')
  } finally {
    submitting.value = false
  }
}

async function removeSelectedMembers() {
  if (!selectedMemberIds.value.length) {
    ElMessage.warning('请选择要移除的代理')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确认从该分组移除已选 ${selectedMemberIds.value.length} 个代理？`,
      '批量移除代理',
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
  const proxyIds = [...selectedMemberIds.value]
  const failed: string[] = []
  try {
    for (const proxyId of proxyIds) {
      try {
        await http.delete(`/api/resource-center/proxy-groups/${groupId.value}/proxies/${proxyId}`)
      } catch {
        failed.push(proxyId)
      }
    }
    if (failed.length) throw new Error(`有 ${failed.length} 个代理移除失败`)
    ElMessage.success(`已移除 ${proxyIds.length} 个代理`)
    clearMemberSelection()
    if (members.value.length <= proxyIds.length && page.value > 1) page.value -= 1
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

function resetSearch() {
  keyword.value = ''
  proxyType.value = ''
  proxyMode.value = ''
  status.value = ''
  searchMembers()
}

watch(
  () => props.group?.id,
  () => {
    page.value = 1
    keyword.value = ''
    proxyType.value = ''
    proxyMode.value = ''
    status.value = ''
    selectedProxyIds.value = []
    clearMemberSelection()
    loadMembers()
  },
)

onMounted(loadMembers)
</script>

<template>
  <section class="member-editor">
    <div class="member-editor__header">
      <div>
        <h3>组内代理</h3>
        <p>当前分组内代理可在这里添加、搜索、查看详情和移除。</p>
      </div>
      <el-tag size="small" effect="plain">共 {{ total }} 个</el-tag>
    </div>

    <div class="member-editor__add">
      <RemoteSelect
        v-model="selectedProxyIds"
        :config="availableProxySelect"
        :context="group"
        placeholder="搜索并选择要加入分组的代理"
      />
      <el-button type="primary" :icon="UserPlus" :loading="submitting" @click="addMembers">
        添加代理
      </el-button>
    </div>

    <div class="member-editor__search">
      <el-input
        v-model="keyword"
        clearable
        @input="clearMemberSelection"
        placeholder="搜索名称 / 代理链接 / Host"
        @keydown.enter="searchMembers"
      />
      <el-select
        v-model="proxyType"
        clearable
        class="member-editor__select"
        placeholder="代理协议"
        @change="searchMembers"
        @clear="searchMembers"
      >
        <el-option
          v-for="option in proxyProtocolOptions"
          :key="String(option.value)"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
      <el-select
        v-model="proxyMode"
        clearable
        class="member-editor__select"
        placeholder="代理类型"
        @change="searchMembers"
        @clear="searchMembers"
      >
        <el-option
          v-for="option in proxyModeOptions"
          :key="String(option.value)"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
      <el-select
        v-model="status"
        clearable
        class="member-editor__select"
        placeholder="使用状态"
        @change="searchMembers"
        @clear="searchMembers"
      >
        <el-option
          v-for="option in proxyUsageStatusOptions"
          :key="String(option.value)"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
      <el-button :icon="Search" :loading="loading" @click="searchMembers">搜索</el-button>
      <el-button :disabled="!keyword && !proxyType && !proxyMode && !status" @click="resetSearch">清空</el-button>
    </div>

    <div v-if="selectedMembers.length" class="member-editor__batch">
      <span>已选 {{ selectedMembers.length }} 个代理</span>
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
      empty-text="暂无组内代理"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="44" reserve-selection />
      <el-table-column prop="id" label="ID" min-width="90" align="center" header-align="center">
        <template #default="{ row }">
          <span class="font-mono text-xs">{{ truncateId(row.id) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="name" label="名称" min-width="150" />
      <el-table-column prop="source_proxy_url" label="代理链接" min-width="360" />
      <el-table-column prop="proxy_type" label="协议" min-width="90" align="center" header-align="center">
        <template #default="{ row }">
          {{ formatCell(row, { key: 'proxy_type', label: '协议', options: proxyProtocolOptions }) }}
        </template>
      </el-table-column>
      <el-table-column prop="proxy_mode" label="类型" min-width="100" align="center" header-align="center">
        <template #default="{ row }">
          {{ formatCell(row, { key: 'proxy_mode', label: '类型', options: proxyModeOptions }) }}
        </template>
      </el-table-column>
      <el-table-column prop="status" label="使用状态" min-width="120" align="center" header-align="center">
        <template #default="{ row }">
          <StatusBadge :value="row.status" />
        </template>
      </el-table-column>
      <el-table-column prop="updated_at" label="更新时间" min-width="170" align="center" header-align="center">
        <template #default="{ row }">
          {{ formatDate(row.updated_at) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="112" fixed="right" align="center" header-align="center">
        <template #default="{ row }">
          <el-space :size="2">
            <el-tooltip content="查看详情" placement="top">
              <el-button text circle :icon="Eye" :disabled="submitting" @click="openProxyDetail(row)" />
            </el-tooltip>
            <el-tooltip content="移除代理" placement="top">
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

    <el-dialog v-model="proxyDetailVisible" title="代理详情" width="720px" append-to-body destroy-on-close>
      <div v-loading="proxyDetailLoading">
        <el-descriptions v-if="proxyDetail" :column="2" border>
          <el-descriptions-item label="代理 ID">
            <span class="font-mono text-xs">{{ text(proxyDetail.id) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="使用状态">
            <StatusBadge :value="proxyDetail.status" />
          </el-descriptions-item>
          <el-descriptions-item label="代理名称">{{ text(proxyDetail.name) }}</el-descriptions-item>
          <el-descriptions-item label="代理协议">
            {{ formatCell(proxyDetail, { key: 'proxy_type', label: '代理协议', options: proxyProtocolOptions }) }}
          </el-descriptions-item>
          <el-descriptions-item label="代理类型">
            {{ formatCell(proxyDetail, { key: 'proxy_mode', label: '代理类型', options: proxyModeOptions }) }}
          </el-descriptions-item>
          <el-descriptions-item label="代理链接" :span="2">
            <span class="font-mono text-xs">{{ text(proxyDetail.source_proxy_url) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="Host">{{ text(proxyDetail.host) }}</el-descriptions-item>
          <el-descriptions-item label="端口">{{ text(proxyDetail.port) }}</el-descriptions-item>
          <el-descriptions-item label="用户名">{{ text(proxyDetail.username) }}</el-descriptions-item>
          <el-descriptions-item label="密码">{{ text(proxyDetail.password) }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ text(proxyDetail.remark) }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{ formatDate(proxyDetail.updated_at) }}</el-descriptions-item>
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

.member-editor__select {
  width: 140px;
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
