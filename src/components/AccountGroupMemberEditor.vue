<script setup lang="ts">
import { Search, Trash2, UserPlus } from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref, watch } from 'vue'

import { http } from '@/api/http'
import RemoteSelect from '@/components/RemoteSelect.vue'
import StatusBadge from '@/components/StatusBadge.vue'
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
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const members = ref<AnyRecord[]>([])
const selectedAccountIds = ref<string[]>([])

const groupId = computed(() => String(props.group?.id || ''))

const availableAccountSelect = computed<RemoteSelectConfig>(() => ({
  endpoint: '/api/accounts',
  labelKeys: ['login_username', 'username', 'display_name', 'platform_account_id'],
  valueKey: 'id',
  detailPath: (value: string) => `/api/accounts/${encodeURIComponent(value)}`,
  secondaryKeys: ['country', 'login_status'],
  searchParam: 'keyword',
  pageSize: 50,
  multiple: true,
  params: {
    business_platform: props.group?.business_platform,
    exclude_group_id: groupId.value,
  },
}))

async function loadMembers() {
  if (!groupId.value) return
  loading.value = true
  try {
    const data = await http.get<PageResult<AnyRecord>>(
      `/api/account-groups/${groupId.value}/accounts`,
      {
        keyword: keyword.value || undefined,
        page: page.value,
        page_size: pageSize.value,
      },
    )
    members.value = data.items
    total.value = data.total
  } catch (err) {
    notifyError(err, '加载组内成员失败', '加载组内成员失败')
  } finally {
    loading.value = false
  }
}

async function addMembers() {
  if (!selectedAccountIds.value.length) {
    ElMessage.warning('请选择要添加的账号')
    return
  }

  submitting.value = true
  try {
    const data = await http.post<AnyRecord>(`/api/account-groups/${groupId.value}/accounts`, {
      account_ids: selectedAccountIds.value,
    })
    selectedAccountIds.value = []
    ElMessage.success(`已添加 ${Number(data.added_count || 0)} 个账号`)
    page.value = 1
    await loadMembers()
    emit('changed')
  } catch (err) {
    notifyError(err, '添加成员失败', '添加成员失败')
  } finally {
    submitting.value = false
  }
}

async function removeMember(account: AnyRecord) {
  try {
    await ElMessageBox.confirm(
      `确认从该分组移除账号「${account.login_username || account.username || account.id}」？`,
      '移除账号',
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
    await http.delete(`/api/account-groups/${groupId.value}/accounts/${account.id}`)
    ElMessage.success('账号已移出分组')
    if (members.value.length === 1 && page.value > 1) page.value -= 1
    await loadMembers()
    emit('changed')
  } catch (err) {
    notifyError(err, '移除成员失败', '移除成员失败')
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
  searchMembers()
}

watch(
  () => props.group?.id,
  () => {
    page.value = 1
    keyword.value = ''
    selectedAccountIds.value = []
    loadMembers()
  },
)

onMounted(loadMembers)
</script>

<template>
  <section class="member-editor">
    <div class="member-editor__header">
      <div>
        <h3>组内成员</h3>
        <p>当前分组内账号可在这里添加、搜索和移除。</p>
      </div>
      <el-tag size="small" effect="plain">共 {{ total }} 个</el-tag>
    </div>

    <div class="member-editor__add">
      <RemoteSelect
        v-model="selectedAccountIds"
        :config="availableAccountSelect"
        :context="group"
        placeholder="搜索并选择要加入分组的账号"
      />
      <el-button type="primary" :icon="UserPlus" :loading="submitting" @click="addMembers">
        添加成员
      </el-button>
    </div>

    <div class="member-editor__search">
      <el-input
        v-model="keyword"
        clearable
        placeholder="搜索登录账号 / 公开用户名 / 昵称"
        @keydown.enter="searchMembers"
      />
      <el-button :icon="Search" :loading="loading" @click="searchMembers">搜索</el-button>
      <el-button :disabled="!keyword" @click="resetSearch">清空</el-button>
    </div>

    <el-table
      v-loading="loading"
      :data="members"
      border
      stripe
      table-layout="auto"
      class="member-editor__table"
      empty-text="暂无组内成员"
    >
      <el-table-column prop="id" label="ID" min-width="90" align="center" header-align="center">
        <template #default="{ row }">
          <span class="font-mono text-xs">{{ truncateId(row.id) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="login_username" label="登录账号" min-width="180" />
      <el-table-column prop="username" label="公开用户名" min-width="160" />
      <el-table-column prop="country" label="国家" min-width="110" align="center" header-align="center" />
      <el-table-column prop="login_status" label="登录状态" min-width="120" align="center" header-align="center">
        <template #default="{ row }">
          <StatusBadge :value="row.login_status" />
        </template>
      </el-table-column>
      <el-table-column prop="updated_at" label="更新时间" min-width="170" align="center" header-align="center">
        <template #default="{ row }">
          {{ formatDate(row.updated_at) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="88" fixed="right" align="center" header-align="center">
        <template #default="{ row }">
          <el-tooltip content="移除账号" placement="top">
            <el-button
              text
              circle
              type="danger"
              :icon="Trash2"
              :disabled="submitting"
              @click="removeMember(row)"
            />
          </el-tooltip>
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
        @size-change="() => { page = 1; loadMembers() }"
      />
    </div>
  </section>
</template>

<style scoped>
.member-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 16px;
  margin-top: 4px;
  border-top: 1px solid #e6edf3;
}

.member-editor__header,
.member-editor__add,
.member-editor__search,
.member-editor__pagination {
  display: flex;
  align-items: center;
  gap: 10px;
}

.member-editor__header {
  justify-content: space-between;
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
  .member-editor__search {
    align-items: stretch;
    flex-direction: column;
  }

  .member-editor__pagination {
    justify-content: flex-start;
    overflow-x: auto;
  }
}
</style>
