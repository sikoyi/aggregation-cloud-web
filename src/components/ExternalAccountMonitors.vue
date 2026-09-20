<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Activity, Clock3, Eye, Layers3, Pause, Pencil, Play, Plus, RefreshCw, RotateCcw, Search, Trash2, TriangleAlert, UserRound, Users } from 'lucide-vue-next'
import ExternalMonitorGroups from '@/components/ExternalMonitorGroups.vue'
import ExternalMonitorBatchBar from '@/components/ExternalMonitorBatchBar.vue'
import ExternalAccountDetail from '@/components/ExternalAccountDetail.vue'
import CompactFollowerCount from '@/components/CompactFollowerCount.vue'
import { ElMessageBox, ElNotification } from 'element-plus'
import { http } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { useScopedBusinessPlatformOptions } from '@/composables/useScopedBusinessPlatformOptions'
import { formatDate } from '@/utils/format'
import { externalMonitorProgress, externalMonitorStatus, type ExternalCollectionProgress } from '@/utils/externalMonitorProgress'
import type { AnyRecord } from '@/types/api'

interface ExternalMonitor {
  id: string
  business_platform: string
  profile_url: string
  remark: string
  interval_minutes: number
  enabled: boolean
  status: string
  activity_status?: string
  collection_progress?: ExternalCollectionProgress
  version: number
  group_id?: string | null
  profile: { display_name?: string; username?: string; avatar_url?: string; biography?: string; followers_count?: number; following_count?: number; posts_count?: number }
}
interface ExternalDetail { monitor: ExternalMonitor; posts: AnyRecord[]; total: number; snapshots: AnyRecord[] }

const auth = useAuthStore()
const platforms = useScopedBusinessPlatformOptions([{ label: 'Threads', value: 'threads' }, { label: 'X(Twitter)', value: 'x' }])
const canEdit = computed(() => auth.can('operations.edit'))
const labels: Record<string, string> = { pending: '等待采集', collecting: '采集中', active: '监听中', retrying: '等待重试', paused: '已暂停' }
const rows = ref<ExternalMonitor[]>([])
const total = ref(0)
const groups = ref<{ id: string; name: string; version: number }[]>([])
const selected = ref<ExternalMonitor[]>([])
const table = ref<{ clearSelection: () => void } | null>(null)
const batchBusy = ref(false)
const summary = ref<Record<string, number> | null>(null)
const summaryCards = [
  { key: 'total', label: '账号总数', status: '', icon: Users, tone: 'blue' },
  { key: 'active', label: '监听中', status: 'active', icon: Activity, tone: 'green' },
  { key: 'pending', label: '等待采集', status: 'pending', icon: Clock3, tone: 'blue' },
  { key: 'retrying', label: '等待重试', status: 'retrying', icon: TriangleAlert, tone: 'amber' },
  { key: 'paused', label: '已关闭', status: 'paused', icon: Pause, tone: 'muted' },
]
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const error = ref('')
const filters = reactive({ platform: '', status: '', keyword: '', sort_order: 'desc', group_id: '' })
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
  if (batchBusy.value) return
  const id = ++sequence
  selected.value = []
  table.value?.clearSelection()
  loading.value = true
  error.value = ''
  try {
    const [result, counts] = await Promise.all([
      http.get<{ items: ExternalMonitor[]; total: number }>('/api/external-account-monitors', { ...appliedFilters, page: page.value, page_size: pageSize.value }),
      http.get<Record<string, number>>('/api/external-account-monitors/summary', { platform: appliedFilters.platform, keyword: appliedFilters.keyword, group_id: appliedFilters.group_id }),
    ])
    if (disposed || id !== sequence) return
    rows.value = result.items
    total.value = result.total
    summary.value = counts
  } catch (e) { if (!disposed && id === sequence) error.value = message(e) }
  finally { if (id === sequence) loading.value = false }
}
function search() { Object.assign(appliedFilters, filters); if (page.value === 1) void load(); else page.value = 1 }
function reset() { Object.assign(filters, { platform: '', status: '', keyword: '', sort_order: 'desc', group_id: '' }); search() }
function filterStatus(status: string) { filters.status = status; search() }
function groupName(id?: string | null) { return groups.value.find(group => group.id === id)?.name || (id ? '分组已变更' : '未分组') }
async function loadGroups() {
  try {
    const result = await http.get<{ id: string; name: string; version: number }[]>('/api/external-account-monitors/groups')
    if (!disposed) groups.value = result
  } catch (e) { if (!disposed) ElNotification.error({ title: '加载分组失败', message: message(e) }) }
}
async function groupsChanged() {
  await loadGroups()
  if (filters.group_id && filters.group_id !== 'ungrouped' && !groups.value.some(group => group.id === filters.group_id)) filters.group_id = ''
  search()
}
function batchCompleted() {
  batchBusy.value = false
  selected.value = []
  table.value?.clearSelection()
  if (page.value !== 1) page.value = 1
  else void load()
}
function openForm(row?: ExternalMonitor) {
  editing.value = row || null
  Object.assign(form, row ? { business_platform: row.business_platform, profile_url: row.profile_url, remark: row.remark, interval_minutes: row.interval_minutes, enabled: row.enabled }
    : { business_platform: platforms.value[0]?.value || 'threads', profile_url: '', remark: '', interval_minutes: 60, enabled: true })
  formVisible.value = true
}
async function save() {
  if (saving.value || batchBusy.value || !canEdit.value) return
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
  if (busy.value || deleting.value || batchBusy.value || !canEdit.value) return
  busy.value = row.id
  try {
    await http.put(`/api/external-account-monitors/${row.id}`, { remark: row.remark, interval_minutes: row.interval_minutes, enabled: !row.enabled, expected_version: row.version })
    if (!disposed) await load()
  } catch (e) { if (!disposed) ElNotification.error({ title: '操作失败', message: message(e) }) }
  finally { busy.value = '' }
}
async function remove(row: ExternalMonitor) {
  if (busy.value || deleting.value || batchBusy.value || !canEdit.value) return
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
onMounted(() => { void load(); void loadGroups(); timer = setInterval(() => { if (!document.hidden && !loading.value && !saving.value && !busy.value && !deleting.value && !batchBusy.value && !selected.value.length) void load() }, 30000) })
onBeforeUnmount(() => { disposed = true; ++sequence; ++detailSequence; clearInterval(timer) })
</script>

<template>
  <section class="external-monitors">
    <header class="external-monitors__header">
      <h2><Activity :size="20" />外部账号监听</h2>
      <div class="external-monitors__actions">
        <ExternalMonitorGroups v-if="canEdit" :groups="groups" @changed="groupsChanged" />
        <el-tooltip content="刷新"><el-button :icon="RefreshCw" circle aria-label="刷新外部账号监听" :loading="loading" :disabled="batchBusy" @click="load" /></el-tooltip>
        <el-button v-if="canEdit" type="primary" :icon="Plus" :disabled="!platforms.length" @click="openForm()">添加外部账号</el-button>
      </div>
    </header>
    <div class="external-monitors__summary">
      <button v-for="card in summaryCards" :key="card.key" type="button" :class="['external-monitors__stat', `external-monitors__stat--${card.tone}`, { 'is-active': appliedFilters.status === card.status }]" :aria-pressed="appliedFilters.status === card.status" :disabled="batchBusy" @click="filterStatus(card.status)">
        <span class="external-monitors__stat-icon"><component :is="card.icon" :size="20" /></span>
        <span><span class="external-monitors__stat-label">{{ card.label }}</span><strong>{{ summary ? number(summary[card.key]) : '--' }}</strong></span>
      </button>
    </div>
    <div class="external-monitors__filters">
      <strong><Search :size="15" />筛选条件</strong>
      <el-form inline label-width="72px" :disabled="batchBusy">
        <el-form-item label="业务 App"><el-select v-model="filters.platform" placeholder="全部" clearable><el-option v-for="option in platforms" :key="String(option.value)" :label="option.label" :value="option.value" /></el-select></el-form-item>
        <el-form-item label="监听状态"><el-select v-model="filters.status" placeholder="全部" clearable><el-option v-for="(label, value) in labels" :key="value" :label="label" :value="value" /></el-select></el-form-item>
        <el-form-item label="账号分组"><el-select v-model="filters.group_id" placeholder="全部分组" clearable filterable><el-option label="未分组" value="ungrouped" /><el-option v-for="group in groups" :key="group.id" :label="group.name" :value="group.id" /></el-select></el-form-item>
        <el-form-item label="关键词"><el-input v-model="filters.keyword" placeholder="账号 / 主页 / 备注" clearable @keyup.enter="search" /></el-form-item>
        <el-form-item label="监听排序"><el-select v-model="filters.sort_order" @change="search"><el-option label="最新添加在前" value="desc" /><el-option label="最早添加在前" value="asc" /></el-select></el-form-item>
      </el-form>
      <el-button :icon="RotateCcw" :disabled="batchBusy" @click="reset">清空</el-button><el-button :icon="Search" type="primary" :disabled="batchBusy" @click="search">查询</el-button>
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <ExternalMonitorBatchBar v-if="canEdit" :selected="selected" :groups="groups" :disabled="loading || saving || !!busy || !!deleting" @busy="batchBusy = $event" @completed="batchCompleted" />
    <el-table ref="table" v-loading="loading" :data="rows" row-key="id" stripe border table-layout="fixed" empty-text="暂无外部账号" @selection-change="selected = $event">
      <el-table-column v-if="canEdit" type="selection" width="44" fixed="left" :selectable="() => !batchBusy" />
      <el-table-column label="外部账号" min-width="250" fixed="left"><template #default="{ row }"><div class="external-monitors__identity"><el-avatar :size="36" :src="safeUrl(row.profile.avatar_url)"><UserRound :size="18" /></el-avatar><div><strong>{{ row.profile.display_name || row.profile.username || row.profile_url.split('/').pop() }}</strong><a :href="safeUrl(row.profile_url)" target="_blank" rel="noopener noreferrer">{{ row.profile_url }}</a></div></div></template></el-table-column>
      <el-table-column label="平台" width="110"><template #default="{ row }"><el-tag effect="plain">{{ platformLabel(row.business_platform) }}</el-tag></template></el-table-column>
      <el-table-column label="账号分组" min-width="150" show-overflow-tooltip><template #default="{ row }"><el-tag :type="row.group_id ? 'primary' : 'info'" effect="plain"><span class="external-monitors__group"><Layers3 v-if="row.group_id" :size="13" />{{ groupName(row.group_id) }}</span></el-tag></template></el-table-column>
      <el-table-column label="粉丝" width="110" align="right"><template #default="{ row }"><CompactFollowerCount :key="row.id" :value="row.profile.followers_count" /></template></el-table-column>
      <el-table-column label="关注" width="100" align="right"><template #default="{ row }">{{ number(row.profile.following_count) }}</template></el-table-column>
      <el-table-column label="帖子" width="100" align="right"><template #default="{ row }">{{ number(row.profile.posts_count) }}</template></el-table-column>
      <el-table-column label="监听状态 / 进度" width="180" align="center"><template #default="{ row }">
        <el-tag :type="(row.activity_status || row.status) === 'active' ? 'success' : (row.activity_status || row.status) === 'retrying' ? 'warning' : 'info'">{{ externalMonitorStatus(row as ExternalMonitor) }}</el-tag>
        <div v-if="externalMonitorProgress(row.collection_progress)" class="external-collection-progress">{{ externalMonitorProgress(row.collection_progress) }}</div>
        <div v-if="row.collection_progress?.last_progress_at" class="external-collection-progress">进展 {{ formatDate(row.collection_progress.last_progress_at) }}</div>
      </template></el-table-column>
      <el-table-column label="间隔" width="100"><template #default="{ row }">{{ row.interval_minutes }} 分钟</template></el-table-column>
      <el-table-column label="最近整轮成功" width="170"><template #default="{ row }">{{ formatDate(row.last_success_at) }}</template></el-table-column>
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
    <div class="external-monitors__pagination"><el-pagination v-model:current-page="page" v-model:page-size="pageSize" :disabled="batchBusy" :total="total" :page-sizes="[20, 50, 100]" background layout="total, sizes, prev, pager, next" @size-change="page = 1" /></div>
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
.external-collection-progress { margin-top: 5px; font-size: 12px; line-height: 1.5; color: var(--app-text-muted, #718096); overflow-wrap: anywhere; }
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
.external-monitors__summary { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin-bottom: 16px; }
.external-monitors__stat { display: flex; align-items: center; gap: 10px; min-width: 0; min-height: 64px; padding: 12px; border: 1px solid var(--app-border, #dce5ed); border-radius: 6px; background: var(--app-surface, #fff); text-align: left; cursor: pointer; }
.external-monitors__stat.is-active { border-color: var(--app-blue, #316589); }
.external-monitors__stat:focus-visible { outline: 2px solid var(--app-blue, #316589); outline-offset: 2px; }
.external-monitors__stat-icon { display: grid; place-items: center; width: 32px; height: 32px; flex-shrink: 0; border-radius: 6px; background: var(--app-surface-muted, #eef8ff); color: var(--app-blue, #316589); }
.external-monitors__stat--green .external-monitors__stat-icon { color: var(--app-green, #238756); }
.external-monitors__stat--amber .external-monitors__stat-icon { color: var(--app-amber, #b67a16); }
.external-monitors__stat--muted .external-monitors__stat-icon { color: var(--app-text-muted, #66788a); }
.external-monitors__stat-label { display: block; color: var(--app-text-muted, #66788a); font-size: 12px; }
.external-monitors__stat strong { display: block; font-size: 20px; line-height: 1.3; color: var(--app-text, #1f2933); overflow-wrap: anywhere; }
.external-monitors__group { display: inline-flex; align-items: center; gap: 5px; max-width: 100%; }
@media (max-width: 1000px) { .external-monitors__summary { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 600px) {
  .external-monitors__summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .external-monitors { padding: 10px; }
  .external-monitors :deep(.el-table-fixed-column--left), .external-monitors :deep(.el-table-fixed-column--right) { position: static !important; }
  .external-monitors__filters :deep(.el-form-item) { display: flex; margin-right: 0; }
  .external-monitors__filters :deep(.el-form-item__content) { min-width: 0; }
  .external-monitors__filters :deep(.el-input), .external-monitors__filters :deep(.el-select) { width: 100%; }
}
</style>
