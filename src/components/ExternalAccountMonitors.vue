<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Activity, Eye, Pause, Pencil, Play, Plus, RefreshCw, RotateCcw, Search, Trash2, UserRound } from 'lucide-vue-next'
import ExternalAccountDetail from '@/components/ExternalAccountDetail.vue'
import CompactFollowerCount from '@/components/CompactFollowerCount.vue'
import { ElMessageBox, ElNotification } from 'element-plus'
import { http } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { useScopedBusinessPlatformOptions } from '@/composables/useScopedBusinessPlatformOptions'
import { formatDate } from '@/utils/format'
import type { AnyRecord } from '@/types/api'

interface ExternalMonitor {
  id: string
  business_platform: string
  profile_url: string
  remark: string
  interval_minutes: number
  enabled: boolean
  status: string
  version: number
  profile: { display_name?: string; username?: string; avatar_url?: string; biography?: string; followers_count?: number; following_count?: number; posts_count?: number }
}
interface ExternalDetail { monitor: ExternalMonitor; posts: AnyRecord[]; total: number; snapshots: AnyRecord[] }

const auth = useAuthStore()
const platforms = useScopedBusinessPlatformOptions([{ label: 'Threads', value: 'threads' }, { label: 'X(Twitter)', value: 'x' }])
const canEdit = computed(() => auth.can('operations.edit'))
const labels: Record<string, string> = { pending: '等待采集', collecting: '采集中', active: '监听中', retrying: '等待重试', paused: '已暂停' }
const rows = ref<ExternalMonitor[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const error = ref('')
const filters = reactive({ platform: '', status: '', keyword: '' })
const appliedFilters = reactive({ ...filters })
const editing = ref<ExternalMonitor | null>(null)
const formVisible = ref(false)
const saving = ref(false)
const busy = ref('')
const deleting = ref('')
const form = reactive({ business_platform: 'threads', profile_url: '', remark: '', interval_minutes: 60, enabled: true })
const detailVisible = ref(false)
const detail = ref<ExternalDetail | null>(null)
const detailId = ref('')
const detailPage = ref(1)
const detailLoading = ref(false)
const detailError = ref('')
let sequence = 0
let detailSequence = 0
let disposed = false
let timer: ReturnType<typeof setInterval> | undefined
function message(e: unknown) { return e instanceof Error ? e.message : '操作失败，请重试' }
function safeUrl(value: unknown) {
  try { const url = new URL(String(value)); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : '' } catch { return '' }
}
function number(value: unknown) { return value == null ? '--' : Number(value).toLocaleString() }
function platformLabel(value: string) { return value === 'x' ? 'X(Twitter)' : 'Threads' }
async function load() {
  const id = ++sequence
  loading.value = true
  error.value = ''
  try {
    const result = await http.get<{ items: ExternalMonitor[]; total: number }>('/api/external-account-monitors', { ...appliedFilters, page: page.value, page_size: pageSize.value })
    if (disposed || id !== sequence) return
    rows.value = result.items
    total.value = result.total
  } catch (e) { if (!disposed && id === sequence) error.value = message(e) }
  finally { if (id === sequence) loading.value = false }
}
function search() { Object.assign(appliedFilters, filters); if (page.value === 1) void load(); else page.value = 1 }
function reset() { Object.assign(filters, { platform: '', status: '', keyword: '' }); search() }
function openForm(row?: ExternalMonitor) {
  editing.value = row || null
  Object.assign(form, row ? { business_platform: row.business_platform, profile_url: row.profile_url, remark: row.remark, interval_minutes: row.interval_minutes, enabled: row.enabled }
    : { business_platform: platforms.value[0]?.value || 'threads', profile_url: '', remark: '', interval_minutes: 60, enabled: true })
  formVisible.value = true
}
async function save() {
  if (saving.value || !canEdit.value) return
  if (!safeUrl(form.profile_url)) { ElNotification.warning({ title: '请填写有效账号主页链接' }); return }
  saving.value = true
  try {
    if (editing.value) {
      const updated = await http.put<ExternalMonitor>(`/api/external-account-monitors/${editing.value.id}`, { remark: form.remark, interval_minutes: form.interval_minutes, enabled: form.enabled, expected_version: editing.value.version })
      if (disposed) return
      editing.value = updated
    } else {
      await http.post('/api/external-account-monitors', { business_platform: form.business_platform, profile_url: form.profile_url.trim(), remark: form.remark, interval_minutes: form.interval_minutes })
      if (disposed) return
      form.profile_url = ''
      form.remark = ''
    }
    ElNotification.success({ title: editing.value ? '监听配置已保存' : '已添加，等待首次采集' })
    await load()
  } catch (e) { if (!disposed) ElNotification.error({ title: '保存失败', message: message(e) }) }
  finally { saving.value = false }
}
async function toggle(row: ExternalMonitor) {
  if (busy.value || deleting.value || !canEdit.value) return
  busy.value = row.id
  try {
    await http.put(`/api/external-account-monitors/${row.id}`, { remark: row.remark, interval_minutes: row.interval_minutes, enabled: !row.enabled, expected_version: row.version })
    if (!disposed) await load()
  } catch (e) { if (!disposed) ElNotification.error({ title: '操作失败', message: message(e) }) }
  finally { busy.value = '' }
}
async function remove(row: ExternalMonitor) {
  if (busy.value || deleting.value || !canEdit.value) return
  deleting.value = row.id
  const accountName = row.profile.display_name || row.profile.username || row.profile_url
  try {
    await ElMessageBox.confirm(
      `删除“${accountName}”后，监听配置、已采集帖子和历史指标快照都会永久删除。操作日志仍会保留。`,
      '删除外部账号监听',
      { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' },
    )
    await http.delete(`/api/external-account-monitors/${row.id}?expected_version=${encodeURIComponent(row.version)}`)
    if (disposed) return
    ElNotification.success({ title: '外部账号监听已删除' })
    if (rows.value.length === 1 && page.value > 1) page.value -= 1
    else await load()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close' && !disposed) {
      ElNotification.error({ title: '删除失败', message: message(e) })
    }
  } finally {
    deleting.value = ''
  }
}
async function loadDetail() {
  const request = ++detailSequence
  detailLoading.value = true
  detailError.value = ''
  try {
    const result = await http.get<ExternalDetail>(`/api/external-account-monitors/${detailId.value}`, { page: detailPage.value, page_size: 20 })
    if (!disposed && request === detailSequence) detail.value = result
  } catch (e) { if (!disposed && request === detailSequence) detailError.value = message(e) }
  finally { if (request === detailSequence) detailLoading.value = false }
}
function openDetail(row: ExternalMonitor) {
  detailId.value = row.id
  detailPage.value = 1
  detail.value = null
  detailVisible.value = true
  void loadDetail()
}
watch([page, pageSize], () => { void load() })
watch(detailVisible, (visible) => { if (!visible) ++detailSequence })
onMounted(() => { void load(); timer = setInterval(() => { if (!document.hidden && !loading.value && !saving.value && !busy.value && !deleting.value) void load() }, 30000) })
onBeforeUnmount(() => { disposed = true; ++sequence; ++detailSequence; clearInterval(timer) })
</script>

<template>
  <section class="external-monitors">
    <header class="external-monitors__header">
      <h2><Activity :size="20" />外部账号监听</h2>
      <div class="external-monitors__actions">
        <el-tooltip content="刷新"><el-button :icon="RefreshCw" circle aria-label="刷新外部账号监听" :loading="loading" @click="load" /></el-tooltip>
        <el-button v-if="canEdit" type="primary" :icon="Plus" :disabled="!platforms.length" @click="openForm()">添加外部账号</el-button>
      </div>
    </header>
    <div class="external-monitors__filters">
      <strong><Search :size="15" />筛选条件</strong>
      <el-form inline label-width="72px">
        <el-form-item label="业务 App"><el-select v-model="filters.platform" placeholder="全部" clearable><el-option v-for="option in platforms" :key="String(option.value)" :label="option.label" :value="option.value" /></el-select></el-form-item>
        <el-form-item label="监听状态"><el-select v-model="filters.status" placeholder="全部" clearable><el-option v-for="(label, value) in labels" :key="value" :label="label" :value="value" /></el-select></el-form-item>
        <el-form-item label="关键词"><el-input v-model="filters.keyword" placeholder="账号 / 主页 / 备注" clearable @keyup.enter="search" /></el-form-item>
      </el-form>
      <el-button :icon="RotateCcw" @click="reset">清空</el-button><el-button :icon="Search" type="primary" @click="search">查询</el-button>
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-table v-loading="loading" :data="rows" stripe border table-layout="fixed" empty-text="暂无外部账号">
      <el-table-column label="外部账号" min-width="250" fixed="left"><template #default="{ row }"><div class="external-monitors__identity"><el-avatar :size="36" :src="safeUrl(row.profile.avatar_url)"><UserRound :size="18" /></el-avatar><div><strong>{{ row.profile.display_name || row.profile.username || row.profile_url.split('/').pop() }}</strong><a :href="safeUrl(row.profile_url)" target="_blank" rel="noopener noreferrer">{{ row.profile_url }}</a></div></div></template></el-table-column>
      <el-table-column label="平台" width="110"><template #default="{ row }"><el-tag effect="plain">{{ platformLabel(row.business_platform) }}</el-tag></template></el-table-column>
      <el-table-column label="粉丝" width="110" align="right"><template #default="{ row }"><CompactFollowerCount :key="row.id" :value="row.profile.followers_count" /></template></el-table-column>
      <el-table-column label="关注" width="100" align="right"><template #default="{ row }">{{ number(row.profile.following_count) }}</template></el-table-column>
      <el-table-column label="帖子" width="100" align="right"><template #default="{ row }">{{ number(row.profile.posts_count) }}</template></el-table-column>
      <el-table-column label="监听状态" width="125" align="center"><template #default="{ row }"><el-tag :type="row.status === 'active' ? 'success' : row.status === 'retrying' ? 'warning' : 'info'">{{ labels[row.status] || row.status }}</el-tag></template></el-table-column>
      <el-table-column label="间隔" width="100"><template #default="{ row }">{{ row.interval_minutes }} 分钟</template></el-table-column>
      <el-table-column label="最近成功" width="170"><template #default="{ row }">{{ formatDate(row.last_success_at) }}</template></el-table-column>
      <el-table-column label="下次采集" width="170"><template #default="{ row }">{{ row.enabled ? formatDate(row.next_run_at) : '-' }}</template></el-table-column>
      <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
      <el-table-column prop="last_error" label="异常原因" min-width="200" show-overflow-tooltip />
      <el-table-column label="操作" :width="canEdit ? 160 : 64" fixed="right" align="center"><template #default="{ row }">
        <el-tooltip content="查看数据"><el-button link :icon="Eye" aria-label="查看外部账号数据" @click="openDetail(row as ExternalMonitor)" /></el-tooltip>
        <el-tooltip v-if="canEdit" content="监听设置"><el-button link :icon="Pencil" aria-label="编辑外部账号监听" @click="openForm(row as ExternalMonitor)" /></el-tooltip>
        <el-tooltip v-if="canEdit" :content="row.enabled ? '暂停监听' : '恢复监听'"><el-button link :icon="row.enabled ? Pause : Play" :aria-label="row.enabled ? '暂停监听' : '恢复监听'" :loading="busy === row.id" :disabled="!!busy || !!deleting" @click="toggle(row as ExternalMonitor)" /></el-tooltip>
        <el-tooltip v-if="canEdit" content="删除监听"><el-button link type="danger" :icon="Trash2" aria-label="删除外部账号监听" :loading="deleting === row.id" :disabled="!!busy || !!deleting" @click="remove(row as ExternalMonitor)" /></el-tooltip>
      </template></el-table-column>
    </el-table>
    <div class="external-monitors__pagination"><el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" :page-sizes="[20, 50, 100]" background layout="total, sizes, prev, pager, next" @size-change="page = 1" /></div>
    <el-dialog v-model="formVisible" :title="editing ? '外部账号监听设置' : '添加外部账号'" width="min(520px, 96vw)" align-center :close-on-click-modal="false">
      <el-form label-position="top" @submit.prevent="save">
        <el-form-item label="业务 App"><el-select v-model="form.business_platform" :disabled="!!editing || saving" class="external-monitors__full" @change="form.profile_url = ''"><el-option v-for="option in platforms" :key="String(option.value)" :label="option.label" :value="option.value" /></el-select></el-form-item>
        <el-form-item label="账号主页链接" required><el-input v-model="form.profile_url" :disabled="!!editing || saving" :placeholder="form.business_platform === 'x' ? 'https://x.com/username' : 'https://www.threads.com/@username'" /></el-form-item>
        <el-form-item label="监听间隔（分钟）"><el-input-number v-model="form.interval_minutes" :min="1" :max="1440" :disabled="saving" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" maxlength="200" :disabled="saving" /></el-form-item>
        <el-form-item v-if="editing" label="开启监听"><el-switch v-model="form.enabled" :disabled="saving" /></el-form-item>
      </el-form>
      <template #footer><el-button :disabled="saving" @click="formVisible = false">关闭</el-button><el-button type="primary" :loading="saving" @click="save">{{ editing ? '保存' : '添加并继续' }}</el-button></template>
    </el-dialog>
    <el-dialog v-model="detailVisible" title="外部账号数据" width="min(1240px, 96vw)" align-center class="external-monitor-detail" destroy-on-close>
      <div v-loading="detailLoading" class="external-monitors__detail">
        <el-alert v-if="detailError" :title="detailError" type="error" :closable="false" />
        <ExternalAccountDetail v-if="detail" :detail="detail" :page="detailPage" @update:page="detailPage = $event; loadDetail()" />
      </div>
      <template #footer><el-button :icon="RefreshCw" :loading="detailLoading" @click="loadDetail">刷新</el-button><el-button @click="detailVisible = false">关闭</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.external-monitors { background: var(--app-surface, #fff); padding: 16px; border: 1px solid var(--app-border, #dce5ed); }
.external-monitors__header, .external-monitors__actions, .external-monitors h2, .external-monitors__filters > strong { display: flex; align-items: center; gap: 10px; }
.external-monitors__header { justify-content: space-between; flex-wrap: wrap; margin-bottom: 16px; gap: 12px; }
.external-monitors h2 { font-size: 18px; margin: 0; }
.external-monitors__filters { padding: 14px; border: 1px solid var(--app-border, #dce5ed); margin-bottom: 16px; }
.external-monitors__filters > strong { font-size: 13px; margin-bottom: 12px; }
.external-monitors__filters :deep(.el-form-item) { margin-bottom: 12px; margin-right: 18px; }
.external-monitors__filters :deep(.el-select), .external-monitors__filters :deep(.el-input) { width: 190px; }
.external-monitors__identity { display: flex; align-items: center; gap: 10px; }
.external-monitors__identity > div { min-width: 0; }
.external-monitors__identity strong, .external-monitors__identity a { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.external-monitors__identity a { font-size: 12px; margin-top: 4px; }
.external-monitors :deep(.el-avatar) { flex-shrink: 0; background: var(--app-surface-muted, #eaf4fb); color: var(--app-blue, #316589); }
.external-monitors a { color: var(--app-blue, #286794); overflow-wrap: anywhere; }
.external-monitors__pagination { display: flex; justify-content: flex-end; padding-top: 16px; overflow-x: auto; }
.external-monitors__full { width: 100%; }
.external-monitors__detail { max-height: 72vh; overflow-y: auto; overflow-x: hidden; min-height: 180px; padding-right: 8px; }
@media (max-width: 600px) {
  .external-monitors { padding: 10px; }
  .external-monitors :deep(.el-table-fixed-column--left), .external-monitors :deep(.el-table-fixed-column--right) { position: static !important; }
  .external-monitors__filters :deep(.el-form-item) { display: flex; margin-right: 0; }
  .external-monitors__filters :deep(.el-form-item__content) { min-width: 0; }
  .external-monitors__filters :deep(.el-input), .external-monitors__filters :deep(.el-select) { width: 100%; }
}
</style>
