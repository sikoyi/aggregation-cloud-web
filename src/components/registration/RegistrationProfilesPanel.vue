<script setup lang="ts">
import { Pencil, Plus, RefreshCw, Search, Trash2, Upload } from 'lucide-vue-next'
import {
  ElMessageBox,
  ElNotification,
  type FormInstance,
  type FormRules,
  type UploadUserFile,
} from 'element-plus'
import { onMounted, reactive, ref } from 'vue'

import { http } from '@/api/http'
import {
  registrationApi,
  type ProfileInput,
  type RegistrationProfile,
} from '@/api/registration'
import { accountCountryOptions } from '@/config/options'
import { formatDate } from '@/utils/format'

const loading = ref(false)
const rows = ref<RegistrationProfile[]>([])
const total = ref(0)
const filters = reactive({ country_region: '', keyword: '', page: 1, page_size: 20 })
const dialogVisible = ref(false)
const importVisible = ref(false)
const editingId = ref('')
const formRef = ref<FormInstance>()
const avatarFiles = ref<UploadUserFile[]>([])
const csvFiles = ref<UploadUserFile[]>([])
const batchAvatarFiles = ref<UploadUserFile[]>([])
const importing = ref(false)
const form = reactive<ProfileInput>({
  nickname: '',
  birthday: '',
  country_region: '',
})
const rules: FormRules = {
  nickname: [{ required: true, message: '请输入昵称', trigger: 'blur' }],
  birthday: [{ required: true, message: '请选择生日', trigger: 'change' }],
  country_region: [{ required: true, message: '请选择国家或地区', trigger: 'change' }],
}

async function loadRows() {
  loading.value = true
  try {
    const page = await registrationApi.listProfiles(filters)
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
  Object.assign(filters, { country_region: '', keyword: '', page: 1 })
  void loadRows()
}

function openCreate() {
  editingId.value = ''
  Object.assign(form, { nickname: '', birthday: '', country_region: '' })
  avatarFiles.value = []
  dialogVisible.value = true
}

function openEdit(row: RegistrationProfile) {
  editingId.value = row.id
  Object.assign(form, {
    nickname: row.nickname,
    birthday: row.birthday,
    country_region: row.country_region,
  })
  avatarFiles.value = []
  dialogVisible.value = true
}

async function submit() {
  await formRef.value?.validate()
  const avatar = avatarFiles.value[0]?.raw
  if (!editingId.value && !avatar) {
    ElNotification.warning({ title: '请上传头像', message: '完整个人资料必须包含头像' })
    return
  }
  const payload = { ...form, avatar }
  if (editingId.value) await registrationApi.updateProfile(editingId.value, payload)
  else await registrationApi.createProfile(payload)
  dialogVisible.value = false
  ElNotification.success({ title: '保存成功', message: '个人资料已更新' })
  await loadRows()
}

async function remove(row: RegistrationProfile) {
  await ElMessageBox.confirm(
    `确认删除“${row.nickname}”的完整个人资料吗？`,
    '删除个人资料',
    { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' },
  )
  await registrationApi.deleteProfile(row.id)
  ElNotification.success({ title: '删除成功', message: '个人资料已删除' })
  await loadRows()
}

function openImport() {
  csvFiles.value = []
  batchAvatarFiles.value = []
  importVisible.value = true
}

async function submitImport() {
  const csv = csvFiles.value[0]?.raw
  const avatars: File[] = batchAvatarFiles.value.flatMap((item) =>
    item.raw ? [item.raw as File] : [],
  )
  if (!csv || !avatars.length) {
    ElNotification.warning({ title: '文件不完整', message: '请上传 CSV 和对应头像文件' })
    return
  }
  importing.value = true
  try {
    const result = await registrationApi.importProfiles(csv, avatars)
    const failed = result.failed_count
      ? `，失败 ${result.failed_count} 条${result.errors[0] ? `：${result.errors[0].message}` : ''}`
      : ''
    ElNotification({
      title: '批量导入完成',
      message: `成功 ${result.success_count} 条${failed}`,
      type: result.failed_count ? 'warning' : 'success',
      duration: result.failed_count ? 8000 : 4500,
    })
    importVisible.value = false
    await loadRows()
  } finally {
    importing.value = false
  }
}

function avatarUrl(value: string) {
  return http.resolveBackendUrl(value)
}

function asProfile(row: unknown) {
  return row as RegistrationProfile
}

defineExpose({ loadRows, openCreate, openImport })
onMounted(loadRows)
</script>

<template>
  <div class="registration-panel">
    <div class="panel-toolbar">
      <div>
        <h2>个人资料池</h2>
        <p>头像、昵称、生日和国家或地区作为一份完整资料统一领取。</p>
      </div>
      <div class="toolbar-actions">
        <el-tooltip content="刷新" placement="bottom">
          <el-button circle :icon="RefreshCw" @click="loadRows" />
        </el-tooltip>
        <el-button :icon="Upload" @click="openImport">批量导入</el-button>
        <el-button type="primary" :icon="Plus" @click="openCreate">新增资料</el-button>
      </div>
    </div>

    <el-form inline class="filter-bar" @submit.prevent="search">
      <el-form-item label="国家/地区">
        <el-select
          v-model="filters.country_region"
          filterable
          clearable
          placeholder="全部"
          style="width: 180px"
        >
          <el-option
            v-for="item in accountCountryOptions"
            :key="String(item.value)"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="昵称">
        <el-input v-model="filters.keyword" clearable placeholder="搜索昵称" style="width: 220px" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :icon="Search" native-type="submit">查询</el-button>
        <el-button @click="reset">清空</el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="rows" border stripe class="data-table">
      <el-table-column prop="id" label="ID" width="72" align="center" />
      <el-table-column label="头像" width="88" align="center">
        <template #default="{ row }">
          <el-avatar :size="42" :src="avatarUrl(row.avatar_url)">{{ row.nickname.slice(0, 1) }}</el-avatar>
        </template>
      </el-table-column>
      <el-table-column prop="nickname" label="昵称" min-width="180" />
      <el-table-column prop="birthday" label="生日" width="130" align="center" />
      <el-table-column label="国家/地区" width="150" align="center">
        <template #default="{ row }">
          <el-tag effect="plain">{{ row.country_region }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="使用次数" width="110" align="center">
        <template #default="{ row }">
          <span class="usage-count">{{ row.usage_count }}</span>
        </template>
      </el-table-column>
      <el-table-column label="最近领取" min-width="170">
        <template #default="{ row }">
          {{ row.last_used_at ? formatDate(row.last_used_at) : '尚未领取' }}
        </template>
      </el-table-column>
      <el-table-column label="更新时间" min-width="170">
        <template #default="{ row }">{{ formatDate(row.updated_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="112" fixed="right" align="center">
        <template #default="{ row }">
          <div class="row-actions">
            <el-tooltip content="编辑" placement="top">
              <el-button circle :icon="Pencil" @click="openEdit(asProfile(row))" />
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
              <el-button circle type="danger" plain :icon="Trash2" @click="remove(asProfile(row))" />
            </el-tooltip>
          </div>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty description="还没有个人资料" :image-size="72" />
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

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑个人资料' : '新增个人资料'"
      width="600px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <div class="form-grid">
          <el-form-item label="昵称" prop="nickname">
            <el-input v-model="form.nickname" maxlength="200" placeholder="请输入昵称" />
          </el-form-item>
          <el-form-item label="生日" prop="birthday">
            <el-date-picker
              v-model="form.birthday"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="选择生日"
              style="width: 100%"
            />
          </el-form-item>
        </div>
        <el-form-item label="国家/地区" prop="country_region">
          <el-select v-model="form.country_region" filterable placeholder="请选择">
            <el-option
              v-for="item in accountCountryOptions"
              :key="String(item.value)"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="editingId ? '替换头像（可选）' : '头像'">
          <el-upload
            v-model:file-list="avatarFiles"
            action="#"
            accept="image/*"
            :auto-upload="false"
            :limit="1"
            list-type="picture-card"
          >
            <Plus class="h-5 w-5" />
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="importVisible" title="批量导入个人资料" width="680px" destroy-on-close>
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="CSV 列：nickname、birthday、country_region、avatar_filename"
        description="生日格式为 YYYY-MM-DD；avatar_filename 必须与本次上传的头像文件名完全一致。"
      />
      <div class="import-block">
        <div class="import-label">1. 上传 CSV</div>
        <el-upload
          v-model:file-list="csvFiles"
          action="#"
          accept=".csv,text/csv"
          :auto-upload="false"
          :limit="1"
        >
          <el-button :icon="Upload">选择 CSV</el-button>
        </el-upload>
      </div>
      <div class="import-block">
        <div class="import-label">2. 上传头像文件</div>
        <el-upload
          v-model:file-list="batchAvatarFiles"
          action="#"
          accept="image/*"
          multiple
          :auto-upload="false"
        >
          <el-button :icon="Upload">选择多个头像</el-button>
        </el-upload>
      </div>
      <template #footer>
        <el-button @click="importVisible = false">取消</el-button>
        <el-button type="primary" :loading="importing" @click="submitImport">开始导入</el-button>
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
.filter-bar { padding: 12px 14px 0; border: 1px solid #e1e8ef; border-radius: 6px; background: #f8fafc; }
.data-table { width: 100%; margin-top: 14px; }
.usage-count { color: #1f668f; font-size: 15px; font-weight: 700; }
.pagination-row { display: flex; align-items: center; justify-content: flex-end; gap: 16px; padding-top: 14px; color: #66788a; font-size: 13px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
.import-block { margin-top: 18px; }
.import-label { margin-bottom: 9px; color: #334e68; font-size: 13px; font-weight: 700; }
@media (max-width: 720px) {
  .panel-toolbar { align-items: flex-start; flex-direction: column; }
  .form-grid { grid-template-columns: 1fr; }
}
</style>
