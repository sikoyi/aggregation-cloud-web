<script setup lang="ts">
import { Download, Eye, RefreshCw, Trash2 } from 'lucide-vue-next'
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { http } from '@/api/http'
import { saveDownload } from '@/utils/download'
import { businessPlatformLabel } from '@/config/options'
import { accountExportStateLabel } from '@/api/accountExport'
import { ACCOUNT_EXPORT_PERMISSION } from '@/config/accountExport'
import { useAuthStore } from '@/stores/auth'

interface ExportRecord {
  id: string
  filename: string
  row_count: number
  created_at: string
  expires_at: string
  expired: boolean
  pending?: boolean
  state?: 'ready' | 'confirming' | 'expired' | 'needs_attention'
  download_available?: boolean
  recovery_overdue?: boolean
}
interface SnapshotRow { account: string; password: string; twofa: string; profile_url: string; business_platform?: string }
interface Page<T> { items: T[]; total: number }

const rows = ref<ExportRecord[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const error = ref('')
const selected = ref<ExportRecord | null>(null)
const previewRows = ref<SnapshotRow[]>([])
const previewTotal = ref(0)
const previewPage = ref(1)
const previewLoading = ref(false)
const previewError = ref('')
const downloading = ref('')
const deleting = ref('')
const auth = useAuthStore()
const allowed = computed(() => auth.can(ACCOUNT_EXPORT_PERMISSION))
const overdue = computed(() => rows.value.some(row => row.recovery_overdue))
let listRequest = 0
let previewRequest = 0
let refreshTimer: ReturnType<typeof setTimeout> | undefined
let disposed = false

const date = (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false })

async function loadRows() {
  clearTimeout(refreshTimer)
  if (!allowed.value || disposed) return
  const request = ++listRequest
  loading.value = true
  error.value = ''
  try {
    const result = await http.get<Page<ExportRecord>>('/api/accounts/export-records', { page: page.value, page_size: 20 })
    if (request !== listRequest) return
    rows.value = result.items
    total.value = result.total
  } catch (e) {
    if (request === listRequest) error.value = e instanceof Error ? e.message : '导出记录加载失败'
  } finally {
    if (request === listRequest) loading.value = false
    if (request === listRequest && !disposed && allowed.value && rows.value.some(row => row.pending && !row.expired)) {
      refreshTimer = setTimeout(() => void loadRows(), 5000)
    }
  }
}

const unavailable = (record: ExportRecord) => !allowed.value || record.expired || record.pending
  || record.download_available === false || record.state === 'needs_attention'

async function loadPreview() {
  const record = selected.value
  if (!record || unavailable(record)) return
  const request = ++previewRequest
  previewRows.value = []
  previewLoading.value = true
  previewError.value = ''
  try {
    const result = await http.get<Page<SnapshotRow>>(`/api/accounts/export-records/${record.id}/data`, { page: previewPage.value, page_size: 20 })
    if (request !== previewRequest) return
    previewRows.value = result.items
    previewTotal.value = result.total
  } catch (e) {
    if (request === previewRequest) previewError.value = e instanceof Error ? e.message : '导出快照加载失败'
  } finally {
    if (request === previewRequest) previewLoading.value = false
  }
}

function preview(record: ExportRecord) {
  if (unavailable(record)) return
  selected.value = record
  previewPage.value = 1
  previewTotal.value = 0
  void loadPreview()
}

function clearPreview() {
  ++previewRequest
  selected.value = null
  previewRows.value = []
  previewError.value = ''
}

async function download(record: ExportRecord) {
  if (downloading.value || unavailable(record)) return
  downloading.value = record.id
  try {
    const file = await http.getFile(`/api/accounts/export-records/${record.id}/download`)
    if (!disposed && allowed.value) saveDownload(file.blob, file.filename)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '下载失败')
  } finally {
    downloading.value = ''
  }
}

async function removeRecord(record: ExportRecord) {
  if (!allowed.value || deleting.value) return
  deleting.value = record.id
  try {
    await ElMessageBox.confirm('删除后该记录将不再展示，也无法查看或下载。账号仍保持已导出，文件按原保留期清理。确认删除？', '删除导出记录', {
      type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消',
    })
    if (disposed || !allowed.value) return
    await http.delete(`/api/accounts/export-records/${record.id}`)
    if (disposed) return
    if (selected.value?.id === record.id) clearPreview()
    ElMessage.success('导出记录已删除')
    if (rows.value.length === 1 && page.value > 1) page.value -= 1
    await loadRows()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error(e instanceof Error ? e.message : '删除导出记录失败')
  } finally { deleting.value = '' }
}

onMounted(loadRows)
watch(allowed, value => {
  if (value) void loadRows()
  else { ++listRequest; clearTimeout(refreshTimer); rows.value = []; loading.value = false; clearPreview() }
})
onBeforeUnmount(() => { disposed = true; ++listRequest; clearTimeout(refreshTimer); clearPreview() })
defineExpose({ loadRows })
</script>

<template>
  <div class="export-records">
    <div class="export-records__toolbar">
      <el-tooltip content="刷新导出记录"><el-button :icon="RefreshCw" aria-label="刷新导出记录" :disabled="!allowed || loading" @click="loadRows" /></el-tooltip>
    </div>
    <el-alert v-if="!allowed" title="当前账号没有导出权限" type="error" :closable="false" />
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-alert v-if="overdue" title="部分邮箱确认已超过 10 分钟，请联系管理员核对原批次；账号导出锁保留，请勿重复导出。" type="warning" :closable="false" />
    <el-table v-loading="loading" :data="rows" border stripe table-layout="fixed" empty-text="暂无导出记录">
      <el-table-column prop="id" label="记录 ID" min-width="240" show-overflow-tooltip />
      <el-table-column prop="filename" label="导出文件" min-width="240" show-overflow-tooltip />
      <el-table-column prop="row_count" label="账号数量" width="100" align="center" />
      <el-table-column label="导出时间" min-width="180" align="center"><template #default="{ row }">{{ date(row.created_at) }}</template></el-table-column>
      <el-table-column label="保留至" min-width="180" align="center"><template #default="{ row }">{{ date(row.expires_at) }}</template></el-table-column>
      <el-table-column label="状态" width="120" align="center"><template #default="{ row }"><el-tag :type="row.expired ? 'info' : unavailable(row as ExportRecord) ? 'warning' : 'success'">{{ accountExportStateLabel(row) }}</el-tag></template></el-table-column>
      <el-table-column label="操作" width="150" align="center" fixed="right">
        <template #default="{ row }">
          <div class="export-records__actions">
            <el-tooltip content="删除导出记录"><el-button link type="danger" :icon="Trash2" aria-label="删除导出记录" :disabled="!allowed || !!deleting || !!downloading" :loading="deleting === row.id" @click="removeRecord(row as ExportRecord)" /></el-tooltip>
            <el-tooltip content="查看导出数据"><el-button link :icon="Eye" aria-label="查看导出数据" :disabled="unavailable(row as ExportRecord)" @click="preview(row as ExportRecord)" /></el-tooltip>
            <el-tooltip content="下载原文件"><el-button link type="primary" :icon="Download" aria-label="下载原文件" :disabled="unavailable(row as ExportRecord) || !!downloading" :loading="downloading === row.id" @click="download(row as ExportRecord)" /></el-tooltip>
          </div>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination v-model:current-page="page" :page-size="20" :total="total" layout="total, prev, pager, next" @current-change="loadRows" />
    <el-dialog :model-value="!!selected" title="导出数据快照" width="min(1100px, 94vw)" destroy-on-close @update:model-value="value => { if (!value) clearPreview() }">
      <el-alert v-if="previewError" :title="previewError" type="error" :closable="false" />
      <el-table v-loading="previewLoading" :data="previewRows" border max-height="520" table-layout="fixed">
        <el-table-column prop="account" label="账号" min-width="220" show-overflow-tooltip />
        <el-table-column label="账号平台" width="120" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.business_platform" size="small" effect="plain">{{ businessPlatformLabel(row.business_platform) }}</el-tag>
            <span v-else>未记录</span>
          </template>
        </el-table-column>
        <el-table-column prop="password" label="密码" min-width="180" show-overflow-tooltip />
        <el-table-column prop="twofa" label="2FA" min-width="220" show-overflow-tooltip />
        <el-table-column prop="profile_url" label="主页链接" min-width="230" show-overflow-tooltip />
        <template v-if="selected?.filename.endsWith('.xlsx')">
          <el-table-column prop="email_address" label="邮箱地址" min-width="220" show-overflow-tooltip />
          <el-table-column prop="email_password" label="邮箱密码" min-width="180" show-overflow-tooltip />
          <el-table-column prop="refresh_token" label="邮箱 refresh_token" min-width="260" show-overflow-tooltip />
          <el-table-column prop="client_id" label="邮箱 client_id" min-width="240" show-overflow-tooltip />
        </template>
      </el-table>
      <el-pagination v-model:current-page="previewPage" :page-size="20" :total="previewTotal" layout="total, prev, pager, next" @current-change="loadPreview" />
    </el-dialog>
  </div>
</template>

<style scoped>
.export-records { padding: 0 16px 16px; min-width: 0; }
.export-records__toolbar { display: flex; justify-content: flex-end; margin-bottom: 12px; }
.export-records__actions { display: flex; justify-content: center; align-items: center; gap: 12px; }
.export-records__actions .el-button { margin: 0; }
.el-pagination { justify-content: flex-end; margin-top: 16px; }
.el-alert { margin-bottom: 12px; }
</style>
