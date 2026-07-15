<script setup lang="ts">
import { Eye, Search, Trash2, UserPlus } from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref, watch } from 'vue'

import { http } from '@/api/http'
import RemoteSelect from '@/components/RemoteSelect.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { loginStatusOptions } from '@/config/options'
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
const loginStatus = ref('')
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const members = ref<AnyRecord[]>([])
const selectedMembers = ref<AnyRecord[]>([])
const selectedAccountIds = ref<string[]>([])
const accountDetailVisible = ref(false)
const accountDetailLoading = ref(false)
const accountDetail = ref<AnyRecord | null>(null)

const groupId = computed(() => String(props.group?.id || ''))
const selectedMemberIds = computed(() => selectedMembers.value.map((item) => String(item.id)))

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
        login_status: loginStatus.value || undefined,
        page: page.value,
        page_size: pageSize.value,
      },
    )
    members.value = data.items
    total.value = data.total
    selectedMembers.value = []
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

async function openAccountDetail(account: AnyRecord) {
  accountDetailVisible.value = true
  accountDetailLoading.value = true
  accountDetail.value = account
  try {
    accountDetail.value = await http.get<AnyRecord>(`/api/accounts/${account.id}`)
  } catch (err) {
    notifyError(err, '加载账号详情失败', '加载账号详情失败')
  } finally {
    accountDetailLoading.value = false
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

async function removeSelectedMembers() {
  if (!selectedMemberIds.value.length) {
    ElMessage.warning('请选择要移除的账号')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确认从该分组移除已选 ${selectedMemberIds.value.length} 个账号？`,
      '批量移除账号',
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
  const accountIds = [...selectedMemberIds.value]
  const failed: string[] = []
  try {
    for (const accountId of accountIds) {
      try {
        await http.delete(`/api/account-groups/${groupId.value}/accounts/${accountId}`)
      } catch {
        failed.push(accountId)
      }
    }
    if (failed.length) {
      throw new Error(`有 ${failed.length} 个账号移除失败`)
    }
    ElMessage.success(`已移除 ${accountIds.length} 个账号`)
    selectedMembers.value = []
    if (members.value.length <= accountIds.length && page.value > 1) page.value -= 1
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

function resetSearch() {
  keyword.value = ''
  loginStatus.value = ''
  searchMembers()
}

watch(
  () => props.group?.id,
  () => {
    page.value = 1
    keyword.value = ''
    loginStatus.value = ''
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
        <p>当前分组内账号可在这里添加、搜索、查看详情和移除。</p>
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
      <el-select
        v-model="loginStatus"
        clearable
        class="member-editor__status-filter"
        placeholder="登录状态"
        @change="searchMembers"
        @clear="searchMembers"
      >
        <el-option
          v-for="option in loginStatusOptions"
          :key="String(option.value)"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
      <el-button :icon="Search" :loading="loading" @click="searchMembers">搜索</el-button>
      <el-button :disabled="!keyword && !loginStatus" @click="resetSearch">清空</el-button>
    </div>

    <div v-if="selectedMembers.length" class="member-editor__batch">
      <span>已选 {{ selectedMembers.length }} 个账号</span>
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
      v-loading="loading"
      :data="members"
      border
      stripe
      table-layout="auto"
      class="member-editor__table"
      empty-text="暂无组内成员"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="44" />
      <el-table-column prop="id" label="ID" min-width="90" align="center" header-align="center">
        <template #default="{ row }">
          <span class="font-mono text-xs">{{ truncateId(row.id) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="login_username" label="登录账号" min-width="180" />
      <el-table-column prop="username" label="公开用户名" min-width="160" />
      <el-table-column prop="country" label="国家" min-width="110" align="center" header-align="center" />
      <el-table-column prop="login_status" label="登录状态" min-width="170" align="center" header-align="center">
        <template #default="{ row }">
          <StatusBadge :value="row.login_status" />
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
              <el-button
                text
                circle
                :icon="Eye"
                :disabled="submitting"
                @click="openAccountDetail(row)"
              />
            </el-tooltip>
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
        @size-change="() => { page = 1; loadMembers() }"
      />
    </div>

    <el-dialog
      v-model="accountDetailVisible"
      title="账号详情"
      width="720px"
      append-to-body
      destroy-on-close
    >
      <div v-loading="accountDetailLoading">
        <el-descriptions v-if="accountDetail" :column="2" border>
          <el-descriptions-item label="账号 ID">
            <span class="font-mono text-xs">{{ text(accountDetail.id) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="登录状态">
            <StatusBadge :value="accountDetail.login_status" />
          </el-descriptions-item>
          <el-descriptions-item label="登录账号">{{ text(accountDetail.login_username) }}</el-descriptions-item>
          <el-descriptions-item label="公开用户名">{{ text(accountDetail.username) }}</el-descriptions-item>
          <el-descriptions-item label="国家">{{ text(accountDetail.country) }}</el-descriptions-item>
          <el-descriptions-item label="业务 App">{{ text(accountDetail.business_platform) }}</el-descriptions-item>
          <el-descriptions-item label="密码">{{ text(accountDetail.password_secret_ref) }}</el-descriptions-item>
          <el-descriptions-item label="2FA">{{ text(accountDetail.totp_secret_ref) }}</el-descriptions-item>
          <el-descriptions-item label="代理 ID">
            <span class="font-mono text-xs">{{ text(accountDetail.proxy_id) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="设备名称">{{ text(accountDetail.bound_slot_name) }}</el-descriptions-item>
          <el-descriptions-item label="设备 ID">
            <span class="font-mono text-xs">{{ text(accountDetail.bound_slot_provider_id) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="最近登录">{{ formatDate(accountDetail.last_login_at) }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{ formatDate(accountDetail.updated_at) }}</el-descriptions-item>
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

.member-editor__status-filter {
  width: 160px;
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
