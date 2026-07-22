<script setup lang="ts">
import { Search, Trash2, UserPlus } from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref, watch } from 'vue'

import { http, resolveBackendUrl } from '@/api/http'
import RemoteSelect from '@/components/RemoteSelect.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { mediaAssetStatusOptions, mediaAssetTypeOptions } from '@/config/options'
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
const assetType = ref('')
const status = ref('')
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const members = ref<AnyRecord[]>([])
const selectedMembers = ref<AnyRecord[]>([])
const selectedAssetIds = ref<string[]>([])

const groupId = computed(() => String(props.group?.id || ''))
const selectedMemberIds = computed(() => selectedMembers.value.map((item) => String(item.id)))

const availableAssetSelect = computed<RemoteSelectConfig>(() => ({
  endpoint: '/api/resource-center/media-assets',
  labelKeys: ['name', 'source_url', 'storage_uri'],
  valueKey: 'id',
  detailPath: (value: string) => `/api/resource-center/media-assets/${encodeURIComponent(value)}`,
  secondaryKeys: ['asset_type', 'status'],
  searchParam: 'keyword',
  pageSize: 50,
  multiple: true,
  params: {
    business_platform: props.group?.business_platform || undefined,
    status: 'enabled',
  },
}))

async function loadMembers() {
  if (!groupId.value) return
  loading.value = true
  try {
    const data = await http.get<PageResult<AnyRecord>>(
      `/api/resource-center/media-asset-groups/${groupId.value}/assets`,
      {
        keyword: keyword.value || undefined,
        asset_type: assetType.value || undefined,
        status: status.value || undefined,
        page: page.value,
        page_size: pageSize.value,
      },
    )
    members.value = data.items
    total.value = data.total
    selectedMembers.value = []
  } catch (err) {
    notifyError(err, '加载组内素材失败', '加载组内素材失败')
  } finally {
    loading.value = false
  }
}

async function addMembers() {
  if (!selectedAssetIds.value.length) {
    ElMessage.warning('请选择要添加的素材')
    return
  }
  submitting.value = true
  try {
    const data = await http.post<AnyRecord>(
      `/api/resource-center/media-asset-groups/${groupId.value}/assets`,
      { asset_ids: selectedAssetIds.value },
    )
    selectedAssetIds.value = []
    ElMessage.success(
      `已添加 ${Number(data.added_count || 0)} 个素材，跳过 ${Number(data.skipped_count || 0)} 个重复素材`,
    )
    page.value = 1
    await loadMembers()
    emit('changed')
  } catch (err) {
    notifyError(err, '添加素材失败', '添加素材失败')
  } finally {
    submitting.value = false
  }
}

async function removeMember(asset: AnyRecord, confirm = true) {
  if (confirm) {
    try {
      await ElMessageBox.confirm(
        `确认从素材组移除「${asset.name || asset.id}」吗？素材文件本身不会被删除。`,
        '移除素材',
        {
          type: 'warning',
          confirmButtonText: '移除',
          cancelButtonText: '取消',
        },
      )
    } catch {
      return false
    }
  }
  await http.delete(`/api/resource-center/media-asset-groups/${groupId.value}/assets/${asset.id}`)
  return true
}

async function removeSingleMember(asset: AnyRecord) {
  submitting.value = true
  try {
    if (!await removeMember(asset)) return
    ElMessage.success('素材已移出素材组')
    if (members.value.length === 1 && page.value > 1) page.value -= 1
    await loadMembers()
    emit('changed')
  } catch (err) {
    notifyError(err, '移除素材失败', '移除素材失败')
  } finally {
    submitting.value = false
  }
}

async function removeSelectedMembers() {
  if (!selectedMemberIds.value.length) {
    ElMessage.warning('请选择要移除的素材')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认从素材组移除已选 ${selectedMemberIds.value.length} 个素材吗？`,
      '批量移除素材',
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
  const selected = [...selectedMembers.value]
  let failedCount = 0
  try {
    for (const asset of selected) {
      try {
        await removeMember(asset, false)
      } catch {
        failedCount += 1
      }
    }
    if (failedCount) throw new Error(`有 ${failedCount} 个素材移除失败`)
    ElMessage.success(`已移除 ${selected.length} 个素材`)
    if (members.value.length <= selected.length && page.value > 1) page.value -= 1
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

function resetSearch() {
  keyword.value = ''
  assetType.value = ''
  status.value = ''
  searchMembers()
}

function typeLabel(value: unknown) {
  return mediaAssetTypeOptions.find((item) => String(item.value) === String(value))?.label || String(value || '-')
}

function assetUrl(asset: AnyRecord) {
  return resolveBackendUrl(String(asset.source_url || ''))
}

watch(
  () => props.group?.id,
  () => {
    page.value = 1
    keyword.value = ''
    assetType.value = ''
    status.value = ''
    selectedAssetIds.value = []
    loadMembers()
  },
)

onMounted(loadMembers)
</script>

<template>
  <section class="member-editor">
    <div class="member-editor__header">
      <div>
        <h3>组内素材</h3>
        <p>脚本选择素材组后，服务端会从已启用的组内素材中随机选择一条下发。</p>
      </div>
      <el-tag size="small" effect="plain">共 {{ total }} 个</el-tag>
    </div>

    <div class="member-editor__add">
      <RemoteSelect
        v-model="selectedAssetIds"
        :config="availableAssetSelect"
        :context="group"
        placeholder="搜索并选择要加入素材组的素材"
      />
      <el-button type="primary" :icon="UserPlus" :loading="submitting" @click="addMembers">
        添加素材
      </el-button>
    </div>

    <div class="member-editor__search">
      <el-input v-model="keyword" clearable placeholder="素材名称 / 地址 / 标签" @keyup.enter="searchMembers" />
      <el-select v-model="assetType" clearable placeholder="素材类型" @change="searchMembers">
        <el-option
          v-for="option in mediaAssetTypeOptions"
          :key="String(option.value)"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
      <el-select v-model="status" clearable placeholder="素材状态" @change="searchMembers">
        <el-option
          v-for="option in mediaAssetStatusOptions"
          :key="String(option.value)"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
      <el-button type="primary" :icon="Search" :loading="loading" @click="searchMembers">查询</el-button>
      <el-button :disabled="!keyword && !assetType && !status" @click="resetSearch">清空</el-button>
    </div>

    <div v-if="selectedMembers.length" class="member-editor__batch">
      <span>已选 {{ selectedMembers.length }} 个素材</span>
      <el-button type="danger" plain :icon="Trash2" :loading="submitting" @click="removeSelectedMembers">
        批量移除
      </el-button>
    </div>

    <el-table
      v-loading="loading"
      :data="members"
      border
      stripe
      row-key="id"
      class="member-editor__table"
      empty-text="暂无组内素材"
      @selection-change="selectedMembers = $event"
    >
      <el-table-column type="selection" width="46" align="center" />
      <el-table-column label="ID" width="92" align="center">
        <template #default="{ row }"><span class="font-mono text-xs">{{ truncateId(row.id) }}</span></template>
      </el-table-column>
      <el-table-column label="预览" width="90" align="center">
        <template #default="{ row }">
          <el-image
            v-if="row.asset_type === 'image' && assetUrl(row)"
            class="member-editor__preview"
            :src="assetUrl(row)"
            :preview-src-list="[assetUrl(row)]"
            preview-teleported
            fit="cover"
          />
          <el-tag v-else size="small" effect="plain">{{ typeLabel(row.asset_type) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="name" label="素材名称" min-width="220" show-overflow-tooltip />
      <el-table-column label="类型" width="110" align="center">
        <template #default="{ row }">{{ typeLabel(row.asset_type) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="110" align="center">
        <template #default="{ row }"><StatusBadge :value="row.status" /></template>
      </el-table-column>
      <el-table-column label="更新时间" width="170" align="center">
        <template #default="{ row }">{{ formatDate(row.updated_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="84" align="center" fixed="right">
        <template #default="{ row }">
          <el-tooltip content="移除素材" placement="top">
            <el-button text circle type="danger" :icon="Trash2" @click="removeSingleMember(row)" />
          </el-tooltip>
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
  </section>
</template>

<style scoped>
.member-editor { display: flex; flex-direction: column; gap: 14px; }
.member-editor__header,
.member-editor__add,
.member-editor__search,
.member-editor__batch,
.member-editor__pagination { display: flex; align-items: center; gap: 10px; }
.member-editor__header,
.member-editor__batch { justify-content: space-between; }
.member-editor__header h3 { margin: 0; color: #1f2933; font-size: 15px; font-weight: 700; }
.member-editor__header p { margin: 4px 0 0; color: #7b8794; font-size: 12px; }
.member-editor__add { align-items: stretch; }
.member-editor__add :deep(.remote-select) { flex: 1; }
.member-editor__search { flex-wrap: wrap; }
.member-editor__search .el-input { width: 260px; }
.member-editor__search .el-select { width: 150px; }
.member-editor__table { width: 100%; }
.member-editor__preview { width: 48px; height: 48px; border-radius: 6px; }
.member-editor__pagination { justify-content: flex-end; }
.member-editor__batch { min-height: 40px; padding: 8px 10px; border: 1px solid #dbe4f0; border-radius: 8px; background: #f8fafc; color: #52606d; font-size: 13px; }

@media (max-width: 768px) {
  .member-editor__header,
  .member-editor__add,
  .member-editor__search,
  .member-editor__batch { align-items: stretch; flex-direction: column; }
  .member-editor__search .el-input,
  .member-editor__search .el-select { width: 100%; }
  .member-editor__pagination { justify-content: flex-start; overflow-x: auto; }
}
</style>
