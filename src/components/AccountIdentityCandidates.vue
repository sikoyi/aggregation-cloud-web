<script setup lang="ts">
import { Check, RefreshCw, X } from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, ref } from 'vue'

import { http } from '@/api/http'
import StatusBadge from '@/components/StatusBadge.vue'
import { businessPlatformLabel } from '@/config/options'
import { useAuthStore } from '@/stores/auth'
import type { AnyRecord, PageResult } from '@/types/api'
import { formatDate } from '@/utils/format'
import { notifyError } from '@/utils/notify'

const auth = useAuthStore()
const loading = ref(false)
const decidingId = ref('')
const rows = ref<AnyRecord[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const status = ref('pending')

const credentialTypeLabels: Record<string, string> = {
  backup_code: '备用验证码',
  password: '密码',
  totp: '动态验证码',
}

async function loadRows() {
  loading.value = true
  try {
    const data = await http.get<PageResult<AnyRecord>>('/api/account-identities/candidates', {
      status: status.value,
      page: page.value,
      page_size: pageSize.value,
    })
    rows.value = data.items
    total.value = data.total
  } catch (error) {
    notifyError(error, '关联候选加载失败', '关联候选加载失败')
  } finally {
    loading.value = false
  }
}

function accountName(row: AnyRecord, side: 'left' | 'right') {
  return String(
    row[`${side}_display_name`]
    || row[`${side}_username`]
    || row[`${side}_login_username`]
    || `账号 #${row[`${side}_account_id`]}`,
  )
}

function evidenceTypes(row: AnyRecord, key: string) {
  const evidence = row.evidence && typeof row.evidence === 'object' ? row.evidence as AnyRecord : {}
  const values = evidence[key]
  return Array.isArray(values)
    ? values.map((value) => credentialTypeLabels[String(value)] || String(value))
    : []
}

async function decide(row: AnyRecord, decision: 'confirmed' | 'rejected') {
  const action = decision === 'confirmed' ? '确认关联' : '拒绝关联'
  const detail = decision === 'confirmed'
    ? '确认后两个平台账号会归入同一登录身份，平台业务数据不会合并或删除。'
    : '拒绝后该候选不会自动合并，账号仍保持相互独立。'
  try {
    await ElMessageBox.confirm(detail, action, {
      type: decision === 'confirmed' ? 'warning' : 'info',
      confirmButtonText: action,
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

  decidingId.value = String(row.id)
  try {
    await http.post(`/api/account-identities/candidates/${encodeURIComponent(String(row.id))}/decision`, {
      decision,
    })
    ElMessage.success(`候选已${decision === 'confirmed' ? '确认' : '拒绝'}`)
    if (rows.value.length === 1 && page.value > 1) page.value -= 1
    await loadRows()
  } catch (error) {
    notifyError(error, `${action}失败`, `${action}失败`)
  } finally {
    decidingId.value = ''
  }
}

function changeStatus() {
  page.value = 1
  loadRows()
}

defineExpose({ loadRows })
onMounted(loadRows)
</script>

<template>
  <section class="identity-candidates">
    <div class="identity-candidates__toolbar">
      <el-segmented
        v-model="status"
        :options="[
          { label: '待确认', value: 'pending' },
          { label: '已确认', value: 'confirmed' },
          { label: '已拒绝', value: 'rejected' },
        ]"
        @change="changeStatus"
      />
      <el-tooltip content="刷新" placement="top">
        <el-button :icon="RefreshCw" circle :loading="loading" @click="loadRows" />
      </el-tooltip>
    </div>

    <el-table v-loading="loading" :data="rows" border stripe empty-text="暂无身份关联候选">
      <el-table-column label="平台账号 A" min-width="210">
        <template #default="{ row }">
          <div class="candidate-account">
            <div><el-tag size="small" effect="plain">{{ businessPlatformLabel(row.left_business_platform) }}</el-tag><strong>{{ accountName(row, 'left') }}</strong></div>
            <small>{{ row.left_login_username || '-' }}</small>
            <small>账号 ID {{ row.left_account_id }}</small>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="平台账号 B" min-width="210">
        <template #default="{ row }">
          <div class="candidate-account">
            <div><el-tag size="small" effect="plain">{{ businessPlatformLabel(row.right_business_platform) }}</el-tag><strong>{{ accountName(row, 'right') }}</strong></div>
            <small>{{ row.right_login_username || '-' }}</small>
            <small>账号 ID {{ row.right_account_id }}</small>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="判断依据" min-width="260">
        <template #default="{ row }">
          <div class="candidate-evidence">
            <strong>{{ row.reason }}</strong>
            <span v-if="evidenceTypes(row, 'matching_credential_types').length">
              一致凭据：{{ evidenceTypes(row, 'matching_credential_types').join('、') }}
            </span>
            <span v-if="evidenceTypes(row, 'conflicting_credential_types').length" class="candidate-evidence__danger">
              冲突凭据：{{ evidenceTypes(row, 'conflicting_credential_types').join('、') }}
            </span>
            <span v-if="!evidenceTypes(row, 'matching_credential_types').length && !evidenceTypes(row, 'conflicting_credential_types').length">
              未发现可验证的共同凭据
            </span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="105" align="center">
        <template #default="{ row }"><StatusBadge :value="row.status" /></template>
      </el-table-column>
      <el-table-column label="创建时间" width="165" align="center">
        <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
      </el-table-column>
      <el-table-column v-if="auth.can('accounts.edit')" label="操作" width="120" align="center">
        <template #default="{ row }">
          <div v-if="row.status === 'pending'" class="candidate-actions">
            <el-tooltip content="确认关联" placement="top">
              <el-button text type="success" :icon="Check" :loading="decidingId === String(row.id)" @click="decide(row, 'confirmed')" />
            </el-tooltip>
            <el-tooltip content="拒绝关联" placement="top">
              <el-button text type="danger" :icon="X" :loading="decidingId === String(row.id)" @click="decide(row, 'rejected')" />
            </el-tooltip>
          </div>
          <span v-else class="identity-candidates__empty">已处理</span>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="total > 0" class="identity-candidates__pagination">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        background
        layout="total, sizes, prev, pager, next"
        :page-sizes="[20, 50, 100]"
        :total="total"
        @current-change="loadRows"
        @size-change="page = 1; loadRows()"
      />
    </div>
  </section>
</template>

<style scoped>
.identity-candidates__toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.candidate-account { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
.candidate-account > div { display: flex; min-width: 0; align-items: center; gap: 7px; }
.candidate-account strong { overflow: hidden; color: #334e68; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.candidate-account small { overflow: hidden; color: #8494a5; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.candidate-evidence { display: flex; flex-direction: column; gap: 4px; color: #6d7f91; font-size: 11px; }
.candidate-evidence strong { color: #40566c; font-size: 12px; }
.candidate-evidence__danger { color: #c24141; }
.candidate-actions { display: flex; align-items: center; justify-content: center; gap: 4px; }
.candidate-actions :deep(.el-button + .el-button) { margin-left: 0; }
.identity-candidates__empty { color: #9aa9b8; font-size: 11px; }
.identity-candidates__pagination { display: flex; justify-content: flex-end; padding-top: 12px; }
</style>
