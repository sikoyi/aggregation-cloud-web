<script setup lang="ts">
import { KeyRound, Pencil, Plus, RefreshCw, Trash2, WalletCards } from 'lucide-vue-next'
import { ElMessageBox, ElNotification, type FormInstance, type FormRules } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'

import {
  registrationApi,
  type CredentialInput,
  type RegistrationCredential,
} from '@/api/registration'
import { formatDate } from '@/utils/format'

const emit = defineEmits<{ changed: [] }>()
const loading = ref(false)
const checkingId = ref('')
const rows = ref<RegistrationCredential[]>([])
const dialogVisible = ref(false)
const editingId = ref('')
const formRef = ref<FormInstance>()
const form = reactive<CredentialInput>({
  provider: 'hero_sms',
  name: '',
  api_key: '',
  priority: 100,
  status: 'enabled',
})
const rules: FormRules = {
  name: [{ required: true, message: '请输入 Key 名称', trigger: 'blur' }],
  api_key: [{
    validator: (_rule, value, callback) => {
      if (!editingId.value && !String(value || '').trim()) callback(new Error('请输入 API Key'))
      else callback()
    },
    trigger: 'blur',
  }],
}

async function loadRows() {
  loading.value = true
  try {
    rows.value = await registrationApi.listCredentials()
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = ''
  Object.assign(form, {
    provider: 'hero_sms',
    name: '',
    api_key: '',
    priority: 100,
    status: 'enabled',
  })
  dialogVisible.value = true
}

function openEdit(row: RegistrationCredential) {
  editingId.value = row.id
  Object.assign(form, {
    provider: row.provider,
    name: row.name,
    api_key: '',
    priority: row.priority,
    status: row.status,
  })
  dialogVisible.value = true
}

async function submit() {
  await formRef.value?.validate()
  const payload = {
    provider: form.provider,
    name: form.name.trim(),
    api_key: form.api_key?.trim() || undefined,
    priority: form.priority,
    status: form.status,
  }
  if (editingId.value) await registrationApi.updateCredential(editingId.value, payload)
  else await registrationApi.createCredential(payload)
  dialogVisible.value = false
  ElNotification.success({ title: '保存成功', message: '接码平台 Key 已更新' })
  await loadRows()
  emit('changed')
}

async function check(row: RegistrationCredential) {
  checkingId.value = row.id
  try {
    const updated = await registrationApi.checkCredential(row.id)
    ElNotification.success({
      title: '连接成功',
      message: `当前余额：${formatBalance(updated.last_balance)}`,
    })
    await loadRows()
  } finally {
    checkingId.value = ''
  }
}

async function remove(row: RegistrationCredential) {
  await ElMessageBox.confirm(
    `确认删除“${row.name}”吗？已经产生接码订单的 Key 只能禁用。`,
    '删除接码 Key',
    { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' },
  )
  await registrationApi.deleteCredential(row.id)
  ElNotification.success({ title: '删除成功', message: '接码平台 Key 已删除' })
  await loadRows()
  emit('changed')
}

function formatBalance(value: number | null) {
  if (value === null || value === undefined) return '未检测'
  return Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 4 })
}

function asCredential(row: unknown) {
  return row as RegistrationCredential
}

defineExpose({ loadRows, openCreate })
onMounted(loadRows)
</script>

<template>
  <div class="registration-panel">
    <div class="panel-toolbar">
      <div>
        <h2>接码平台 Key</h2>
        <p>同一优先级自动轮换；余额不足或请求失败时会尝试下一个可用 Key。</p>
      </div>
      <div class="toolbar-actions">
        <el-tooltip content="刷新" placement="bottom">
          <el-button circle :icon="RefreshCw" @click="loadRows" />
        </el-tooltip>
        <el-button type="primary" :icon="Plus" @click="openCreate">新增 Key</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="rows" border stripe class="data-table">
      <el-table-column prop="id" label="ID" width="64" align="center" />
      <el-table-column label="平台" width="108" align="center">
        <template #default>
          <el-tag type="primary" effect="light">Hero SMS</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="name" label="Key 名称" width="130" show-overflow-tooltip />
      <el-table-column label="余额" width="110" align="center">
        <template #default="{ row }">
          <span class="balance-value">{{ formatBalance(row.last_balance) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="priority" label="优先级" width="82" align="center" />
      <el-table-column label="状态" width="82" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === 'enabled' ? 'success' : 'info'" effect="light">
            {{ row.status === 'enabled' ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="最近检测" min-width="150">
        <template #default="{ row }">
          <div>{{ row.last_checked_at ? formatDate(row.last_checked_at) : '尚未检测' }}</div>
          <div v-if="row.last_error" class="error-text">{{ row.last_error }}</div>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="140" fixed="right" align="center">
        <template #default="{ row }">
          <div class="row-actions">
            <el-tooltip content="检测余额" placement="top">
              <el-button
                circle
                :icon="WalletCards"
                :loading="checkingId === row.id"
                @click="check(asCredential(row))"
              />
            </el-tooltip>
            <el-tooltip content="编辑" placement="top">
              <el-button circle :icon="Pencil" @click="openEdit(asCredential(row))" />
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
              <el-button circle type="danger" plain :icon="Trash2" @click="remove(asCredential(row))" />
            </el-tooltip>
          </div>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty description="还没有配置接码平台 Key" :image-size="72" />
      </template>
    </el-table>

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑接码 Key' : '新增接码 Key'"
      width="560px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <div class="form-grid">
          <el-form-item label="接码平台" prop="provider">
            <el-select v-model="form.provider" disabled>
              <el-option label="Hero SMS" value="hero_sms" />
            </el-select>
          </el-form-item>
          <el-form-item label="Key 名称" prop="name">
            <el-input v-model="form.name" placeholder="例如：Hero 主账号" maxlength="100" />
          </el-form-item>
          <el-form-item label="优先级" prop="priority">
            <el-input-number v-model="form.priority" :min="1" :max="9999" controls-position="right" />
          </el-form-item>
          <el-form-item label="启用状态" prop="status">
            <el-switch
              v-model="form.status"
              active-value="enabled"
              inactive-value="disabled"
              active-text="启用"
              inactive-text="禁用"
            />
          </el-form-item>
        </div>
        <el-form-item label="API Key" prop="api_key">
          <el-input
            v-model="form.api_key"
            type="password"
            show-password
            :placeholder="editingId ? '留空保持原 Key 不变' : '请输入 Hero SMS API Key'"
            autocomplete="new-password"
          />
        </el-form-item>
        <el-alert
          :closable="false"
          type="info"
          show-icon
          title="脚本不会接触第三方 API Key，微服务会自动挑选可用 Key。"
        />
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :icon="KeyRound" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.registration-panel { padding: 16px; border: 1px solid #dbe4ed; border-radius: 6px; background: #fff; }
.panel-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.panel-toolbar h2 { color: #26384a; font-size: 15px; font-weight: 700; }
.panel-toolbar p { margin-top: 4px; color: #718096; font-size: 12px; }
.toolbar-actions,
.row-actions { display: flex; align-items: center; justify-content: center; gap: 8px; }
.data-table { width: 100%; }
.balance-value { color: #1f668f; font-size: 14px; font-weight: 700; }
.error-text { margin-top: 3px; color: #d14343; font-size: 12px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
.form-grid :deep(.el-input-number),
.form-grid :deep(.el-select) { width: 100%; }
@media (max-width: 720px) {
  .panel-toolbar { align-items: flex-start; flex-direction: column; }
  .form-grid { grid-template-columns: 1fr; }
}
</style>
