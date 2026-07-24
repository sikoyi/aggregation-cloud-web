<script setup lang="ts">
import { RefreshCw, Search } from 'lucide-vue-next'
import { onMounted, reactive, ref } from 'vue'

import {
  registrationApi,
  type ActivationStatus,
  type RegistrationActivation,
} from '@/api/registration'
import { formatDate } from '@/utils/format'

const loading = ref(false)
const rows = ref<RegistrationActivation[]>([])
const total = ref(0)
const filters = reactive({
  provider: '',
  business_app: '',
  status: '',
  keyword: '',
  page: 1,
  page_size: 20,
})

type TagType = 'success' | 'warning' | 'danger' | 'info' | 'primary'

const statusMeta: Record<ActivationStatus, { label: string; type: TagType }> = {
  waiting: { label: '等待验证码', type: 'warning' },
  code_received: { label: '已收到验证码', type: 'success' },
  completed: { label: '已完成', type: 'success' },
  cancelled: { label: '已取消', type: 'info' },
  expired: { label: '已过期', type: 'info' },
  failed: { label: '失败', type: 'danger' },
}
const appLabels = { threads: 'Threads', x: 'X', instagram: 'Instagram' }

async function loadRows() {
  loading.value = true
  try {
    const page = await registrationApi.listActivations(filters)
    rows.value = page.items
    total.value = page.total
  } finally {
    loading.value = false
  }
}

function search() {
  filters.page = 1
  void loadRows()
}

function reset() {
  Object.assign(filters, {
    provider: '',
    business_app: '',
    status: '',
    keyword: '',
    page: 1,
  })
  void loadRows()
}

function statusLabel(status: ActivationStatus) {
  return statusMeta[status]?.label || status
}

function statusType(status: ActivationStatus): TagType {
  return statusMeta[status]?.type || 'info'
}

function formatCost(row: RegistrationActivation) {
  if (row.cost === null || row.cost === undefined) return '-'
  return `${Number(row.cost).toLocaleString('zh-CN', { maximumFractionDigits: 4 })} ${row.currency}`.trim()
}

function appLabel(row: unknown) {
  const item = row as RegistrationActivation
  return appLabels[item.business_app] || item.business_app
}

function asActivation(row: unknown) {
  return row as RegistrationActivation
}

defineExpose({ loadRows })
onMounted(loadRows)
</script>

<template>
  <div class="registration-panel">
    <div class="panel-toolbar">
      <div>
        <h2>接码订单</h2>
        <p>查看脚本申请的号码、验证码状态、实际使用 Key 和订单成本。</p>
      </div>
      <el-tooltip content="刷新" placement="bottom">
        <el-button circle :icon="RefreshCw" @click="loadRows" />
      </el-tooltip>
    </div>

    <el-form inline class="filter-bar" @submit.prevent="search">
      <el-form-item label="接码平台">
        <el-select v-model="filters.provider" clearable placeholder="全部" style="width: 150px">
          <el-option label="Hero SMS" value="hero_sms" />
        </el-select>
      </el-form-item>
      <el-form-item label="业务 App">
        <el-select v-model="filters.business_app" clearable placeholder="全部" style="width: 150px">
          <el-option label="Threads" value="threads" />
          <el-option label="X" value="x" />
          <el-option label="Instagram" value="instagram" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="filters.status" clearable placeholder="全部" style="width: 160px">
          <el-option
            v-for="(meta, key) in statusMeta"
            :key="key"
            :label="meta.label"
            :value="key"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="关键词">
        <el-input
          v-model="filters.keyword"
          clearable
          placeholder="手机号 / 平台订单号"
          style="width: 230px"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :icon="Search" native-type="submit">查询</el-button>
        <el-button @click="reset">清空</el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="rows" border stripe class="data-table">
      <el-table-column prop="id" label="订单 ID" width="90" align="center" />
      <el-table-column label="接码平台" width="120" align="center">
        <template #default><el-tag effect="plain">Hero SMS</el-tag></template>
      </el-table-column>
      <el-table-column prop="credential_name" label="Key 名称" min-width="150" />
      <el-table-column label="业务 App" width="120" align="center">
        <template #default="{ row }">{{ appLabel(row) }}</template>
      </el-table-column>
      <el-table-column prop="country" label="国家代码" width="100" align="center" />
      <el-table-column label="手机号" min-width="180">
        <template #default="{ row }">
          <span class="phone-value">{{ row.phone_number }}</span>
        </template>
      </el-table-column>
      <el-table-column label="验证码" width="130" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.sms_code" type="success" effect="light" class="sms-code">
            {{ row.sms_code }}
          </el-tag>
          <span v-else class="muted">-</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="130" align="center">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)" effect="light">{{ statusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="成本" width="130" align="center">
        <template #default="{ row }">{{ formatCost(asActivation(row)) }}</template>
      </el-table-column>
      <el-table-column label="创建时间" min-width="170">
        <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
      </el-table-column>
      <template #empty>
        <el-empty description="还没有接码订单" :image-size="72" />
      </template>
    </el-table>
    <div class="pagination-row">
      <span>共 {{ total }} 条</span>
      <el-pagination
        v-model:current-page="filters.page"
        v-model:page-size="filters.page_size"
        layout="sizes, prev, pager, next"
        :page-sizes="[20, 50, 100]"
        :total="total"
        @change="loadRows"
      />
    </div>
  </div>
</template>

<style scoped>
.registration-panel { padding: 16px; border: 1px solid #dbe4ed; border-radius: 6px; background: #fff; }
.panel-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.panel-toolbar h2 { color: #26384a; font-size: 15px; font-weight: 700; }
.panel-toolbar p { margin-top: 4px; color: #718096; font-size: 12px; }
.filter-bar { padding: 12px 14px 0; border: 1px solid #e1e8ef; border-radius: 6px; background: #f8fafc; }
.data-table { width: 100%; margin-top: 14px; }
.phone-value { color: #173f5f; font-size: 14px; font-weight: 700; }
.sms-code { font-size: 14px; font-weight: 700; letter-spacing: 0; }
.muted { color: #9aa5b1; }
.pagination-row { display: flex; align-items: center; justify-content: flex-end; gap: 16px; padding-top: 14px; color: #66788a; font-size: 13px; }
@media (max-width: 720px) {
  .panel-toolbar { align-items: flex-start; flex-direction: column; }
}
</style>
