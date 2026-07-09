<script setup lang="ts">
import { Eye, Search, Trash2, UserPlus } from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref, watch } from 'vue'

import { http } from '@/api/http'
import RemoteSelect from '@/components/RemoteSelect.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { contentStatusOptions, contentTypeOptions } from '@/config/options'
import type { AnyRecord, PageResult } from '@/types/api'
import type { RemoteSelectConfig } from '@/types/crud'
import { formatDate, truncateId } from '@/utils/format'
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
const contentType = ref('')
const status = ref('unused')
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const members = ref<AnyRecord[]>([])
const selectedMembers = ref<AnyRecord[]>([])
const selectedContentIds = ref<string[]>([])
const contentDetailVisible = ref(false)
const contentDetailLoading = ref(false)
const contentDetail = ref<AnyRecord | null>(null)

const groupId = computed(() => String(props.group?.id || ''))
const selectedContentIdValues = computed(() => selectedMembers.value.map((item) => String(item.id)))

const availableContentSelect = computed<RemoteSelectConfig>(() => ({
  endpoint: '/api/content-center/contents',
  labelKeys: ['title', 'id'],
  valueKey: 'id',
  detailPath: (value: string) => `/api/content-center/contents/${encodeURIComponent(value)}`,
  secondaryKeys: ['content_type', 'status'],
  searchParam: 'keyword',
  pageSize: 50,
  multiple: true,
  params: {
    business_platform: props.group?.business_platform || undefined,
    status: 'unused',
  },
}))

async function loadMembers() {
  if (!groupId.value) return
  loading.value = true
  try {
    const data = await http.get<PageResult<AnyRecord>>(
      `/api/content-center/content-groups/${groupId.value}/contents`,
      {
        keyword: keyword.value || undefined,
        content_type: contentType.value || undefined,
        status: status.value || undefined,
        page: page.value,
        page_size: pageSize.value,
      },
    )
    members.value = data.items
    total.value = data.total
    selectedMembers.value = []
  } catch (err) {
    notifyError(err, '加载组内内容失败', '加载组内内容失败')
  } finally {
    loading.value = false
  }
}

async function addMembers() {
  if (!selectedContentIds.value.length) {
    ElMessage.warning('请选择要添加的内容')
    return
  }

  submitting.value = true
  try {
    const data = await http.post<AnyRecord>(`/api/content-center/content-groups/${groupId.value}/contents`, {
      content_ids: selectedContentIds.value,
    })
    selectedContentIds.value = []
    ElMessage.success(`已添加 ${Number(data.added_count || 0)} 条内容`)
    page.value = 1
    await loadMembers()
    emit('changed')
  } catch (err) {
    notifyError(err, '添加内容失败', '添加内容失败')
  } finally {
    submitting.value = false
  }
}

async function openContentDetail(content: AnyRecord) {
  contentDetailVisible.value = true
  contentDetailLoading.value = true
  contentDetail.value = content
  try {
    contentDetail.value = await http.get<AnyRecord>(`/api/content-center/contents/${content.id}`)
  } catch (err) {
    notifyError(err, '加载内容详情失败', '加载内容详情失败')
  } finally {
    contentDetailLoading.value = false
  }
}

async function removeMember(content: AnyRecord) {
  try {
    await ElMessageBox.confirm(
      `确认从内容池移除「${content.title || content.id}」吗？内容本身不会被删除。`,
      '移除内容',
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
    await http.delete(`/api/content-center/content-groups/${groupId.value}/contents/${content.id}`)
    ElMessage.success('内容已移出内容池')
    if (members.value.length === 1 && page.value > 1) page.value -= 1
    await loadMembers()
    emit('changed')
  } catch (err) {
    notifyError(err, '移除内容失败', '移除内容失败')
  } finally {
    submitting.value = false
  }
}

async function removeSelectedMembers() {
  if (!selectedContentIdValues.value.length) {
    ElMessage.warning('请选择要移除的内容')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确认从内容池移除已选 ${selectedContentIdValues.value.length} 条内容吗？`,
      '批量移除内容',
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
  const contentIds = [...selectedContentIdValues.value]
  const failed: string[] = []
  try {
    for (const contentId of contentIds) {
      try {
        await http.delete(`/api/content-center/content-groups/${groupId.value}/contents/${contentId}`)
      } catch {
        failed.push(contentId)
      }
    }
    if (failed.length) throw new Error(`有 ${failed.length} 条内容移除失败`)
    ElMessage.success(`已移除 ${contentIds.length} 条内容`)
    selectedMembers.value = []
    if (members.value.length <= contentIds.length && page.value > 1) page.value -= 1
    await loadMembers()
    emit('changed')
  } catch (err) {
    notifyError(err, '批量移除失败', '批量移除失败')
  } finally {
    submitting.value = false
  }
}

function searchMembers() {
  page.value = 1
  loadMembers()
}

function handleSelectionChange(selection: AnyRecord[]) {
  selectedMembers.value = selection
}

function text(value: unknown) {
  return value === undefined || value === null || value === '' ? '-' : String(value)
}

function contentTypeLabel(value: unknown) {
  const option = contentTypeOptions.find((item) => String(item.value) === String(value))
  return option?.label || text(value)
}

function materialAssetCount(value: unknown) {
  return Array.isArray(value) ? value.length : 0
}

function resetSearch() {
  keyword.value = ''
  contentType.value = ''
  status.value = 'unused'
  searchMembers()
}

watch(
  () => props.group?.id,
  () => {
    page.value = 1
    keyword.value = ''
    contentType.value = ''
    status.value = 'unused'
    selectedContentIds.value = []
    loadMembers()
  },
)

onMounted(loadMembers)
</script>

<template>
  <section class="member-editor">
    <div class="member-editor__header">
      <div>
        <div class="text-sm font-semibold text-ink">组内内容</div>
        <div class="text-xs text-slate-500">任务下发选择内容池时，会从这里的未使用内容里随机抽取。</div>
      </div>
      <el-button :icon="Search" :loading="loading" @click="loadMembers">刷新</el-button>
    </div>

    <div class="member-editor__add">
      <RemoteSelect
        v-model="selectedContentIds"
        :config="availableContentSelect"
        placeholder="选择要加入内容池的内容"
      />
      <el-button type="primary" :icon="UserPlus" :loading="submitting" @click="addMembers">添加内容</el-button>
    </div>

    <div class="member-editor__search">
      <el-input v-model="keyword" clearable placeholder="标题 / 正文 / 备注 / 标签" @keyup.enter="searchMembers" />
      <el-select v-model="contentType" clearable placeholder="内容类型">
        <el-option
          v-for="option in contentTypeOptions"
          :key="String(option.value)"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
      <el-select v-model="status" clearable placeholder="状态">
        <el-option
          v-for="option in contentStatusOptions"
          :key="String(option.value)"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
      <el-button type="primary" @click="searchMembers">查询</el-button>
      <el-button @click="resetSearch">清空</el-button>
    </div>

    <div v-if="selectedMembers.length" class="member-editor__batch">
      <span>已选 {{ selectedMembers.length }} 条</span>
      <el-button type="danger" plain :icon="Trash2" :loading="submitting" @click="removeSelectedMembers">
        批量移除
      </el-button>
    </div>

    <el-table
      v-loading="loading"
      :data="members"
      border
      class="member-editor__table"
      row-key="id"
      empty-text="暂无组内内容"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="46" align="center" />
      <el-table-column label="ID" width="92" align="center">
        <template #default="{ row }">
          <span class="font-mono text-xs">{{ truncateId(row.id) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="内容标题" min-width="220" show-overflow-tooltip />
      <el-table-column label="类型" width="110" align="center">
        <template #default="{ row }">{{ contentTypeLabel(row.content_type) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="110" align="center">
        <template #default="{ row }"><StatusBadge :value="row.status" /></template>
      </el-table-column>
      <el-table-column label="标签" min-width="160">
        <template #default="{ row }">
          <div class="flex flex-wrap gap-1">
            <el-tag v-for="tag in row.tags || []" :key="tag" size="small" effect="plain">{{ tag }}</el-tag>
            <span v-if="!(row.tags || []).length" class="text-slate-400">-</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" width="170" align="center">
        <template #default="{ row }">{{ formatDate(row.updated_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="120" align="center" fixed="right">
        <template #default="{ row }">
          <div class="inline-flex items-center gap-1">
            <el-tooltip content="查看详情" placement="top">
              <el-button :icon="Eye" circle plain @click="openContentDetail(row)" />
            </el-tooltip>
            <el-tooltip content="移除内容" placement="top">
              <el-button :icon="Trash2" circle plain type="danger" @click="removeMember(row)" />
            </el-tooltip>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <div class="member-editor__pagination">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        @current-change="loadMembers"
        @size-change="searchMembers"
      />
    </div>

    <el-dialog v-model="contentDetailVisible" title="内容详情" width="680px" append-to-body destroy-on-close>
      <div v-loading="contentDetailLoading">
        <el-descriptions v-if="contentDetail" :column="2" border>
          <el-descriptions-item label="ID">
            <span class="font-mono text-xs">{{ text(contentDetail.id) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="标题">{{ text(contentDetail.title) }}</el-descriptions-item>
          <el-descriptions-item label="业务 App">{{ text(contentDetail.business_platform) }}</el-descriptions-item>
          <el-descriptions-item label="类型">{{ contentTypeLabel(contentDetail.content_type) }}</el-descriptions-item>
          <el-descriptions-item label="状态"><StatusBadge :value="contentDetail.status" /></el-descriptions-item>
          <el-descriptions-item label="素材数量">{{ materialAssetCount(contentDetail.material_asset_ids) }}</el-descriptions-item>
          <el-descriptions-item label="正文" :span="2">
            <div class="whitespace-pre-wrap leading-6">{{ text(contentDetail.text_body) }}</div>
          </el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ text(contentDetail.remark) }}</el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>
  </section>
</template>

<style scoped>
.member-editor {
  display: flex;
  flex-direction: column;
  gap: 14px;
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

.member-editor__header,
.member-editor__batch {
  justify-content: space-between;
}

.member-editor__add {
  align-items: stretch;
}

.member-editor__add :deep(.remote-select) {
  flex: 1;
}

.member-editor__search {
  flex-wrap: wrap;
}

.member-editor__search .el-input {
  width: 260px;
}

.member-editor__search .el-select {
  width: 150px;
}

.member-editor__table {
  width: 100%;
}

.member-editor__pagination {
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .member-editor__add,
  .member-editor__search,
  .member-editor__batch {
    align-items: stretch;
    flex-direction: column;
  }

  .member-editor__search .el-input,
  .member-editor__search .el-select {
    width: 100%;
  }
}
</style>
