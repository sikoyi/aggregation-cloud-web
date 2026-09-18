<script setup lang="ts">
import { Check, Eye, ExternalLink, RefreshCw, SkipForward, Trash2 } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessageBox, ElNotification } from 'element-plus'
import { http } from '@/api/http'
import {
  batchApproveBenchmarkPostReviews,
  batchDeleteBenchmarkPostReviews,
  batchIgnoreBenchmarkPostReviews,
} from '@/api/benchmarkPostReviews'
import { useAuthStore } from '@/stores/auth'
import { formatDate } from '@/utils/format'
import { notifyError } from '@/utils/notify'

interface Review {
  id: string
  revision: string
  status: string
  source_display_name: string | null
  source_username: string | null
  source_business_platform: string
  target_display_name: string | null
  target_username: string | null
  business_platform: string
  final_content: string
  task_run_id: string | null
  created_at: string
  snapshot: { content_url?: string; text_content?: string; media_urls?: string[] }
}
const auth = useAuthStore()
const rows = ref<Review[]>([])
const status = ref('')
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const saving = ref(false)
const batchLoading = ref(false)
const retryingId = ref('')
const selectedRows = ref<Review[]>([])
const tableRef = ref<{ clearSelection: () => void } | null>(null)
const selected = ref<Review | null>(null)
const visible = ref(false)
const content = ref('')
const labels: Record<string, string> = {
  pending_review: '待审核', succeeded: '发布成功', failed: '发布失败', ignored: '已忽略',
  queued: '等待发布', waiting_slot: '等待设备', waiting_runtime: '等待执行端', running: '发布中',
  dispatching: '下发中', canceled: '已取消', expired: '已超时', lost: '结果丢失',
}
const editable = computed(() => selected.value?.status === 'pending_review' && auth.can('operations.review'))
const retryable = computed(() => selected.value?.status === 'failed' && auth.can('operations.retry'))
const canManageReviews = computed(() => auth.can('operations.review'))
const batchActionsDisabled = computed(() => batchLoading.value || selectedRows.value.length === 0)
let request = 0
let timer: ReturnType<typeof setInterval> | undefined
function safeUrl(value?: string) {
  try { const url = new URL(value || ''); return ['https:', 'http:'].includes(url.protocol) ? url.href : '' } catch { return '' }
}
function statusType(value: string) {
  return value === 'succeeded' ? 'success' : ['failed', 'expired', 'lost'].includes(value) ? 'danger' : value === 'pending_review' ? 'warning' : 'info'
}
async function load() {
  const id = ++request
  loading.value = true
  try {
    const result = await http.get<{ items: Review[]; total: number }>('/api/benchmark-trackers/reviews', { status: status.value || undefined, page: page.value, page_size: 20 })
    if (id === request) { rows.value = result.items; total.value = result.total }
  } catch (error) { if (id === request) notifyError(error, '加载对标审核失败') }
  finally { if (id === request) loading.value = false }
}
async function open(row: Record<string, unknown>) {
  try {
    selected.value = await http.get<Review>(`/api/benchmark-trackers/reviews/${encodeURIComponent(String(row.id))}`)
    content.value = selected.value.final_content
    visible.value = true
  } catch (error) { notifyError(error, '加载工单失败') }
}
function handleSelectionChange(selection: Review[]) {
  selectedRows.value = selection
}
function clearBatchSelection() {
  tableRef.value?.clearSelection()
  selectedRows.value = []
}
type BatchAction = 'approve' | 'ignore' | 'delete'
async function runBatchAction(action: BatchAction) {
  if (batchActionsDisabled.value) return
  const count = selectedRows.value.length
  const settings = {
    approve: {
      title: '批量批准发布',
      message: `确认批准发布已选择的 ${count} 条工单？系统会使用每条工单当前保存的发布文案创建任务。`,
      confirmButtonText: '确认批准',
      request: batchApproveBenchmarkPostReviews,
      successLabel: '批准',
      type: 'warning' as const,
    },
    ignore: {
      title: '批量忽略',
      message: `确认忽略已选择的 ${count} 条工单？符合条件的帖子将不再创建发布任务。`,
      confirmButtonText: '确认忽略',
      request: batchIgnoreBenchmarkPostReviews,
      successLabel: '忽略',
      type: 'warning' as const,
    },
    delete: {
      title: '批量删除记录',
      message: `确认删除已选择的 ${count} 条记录？仅已结束工单会从列表隐藏，发布任务、帖子映射和操作审计仍会保留。`,
      confirmButtonText: '确认删除',
      request: batchDeleteBenchmarkPostReviews,
      successLabel: '删除',
      type: 'error' as const,
    },
  }[action]
  try {
    await ElMessageBox.confirm(settings.message, settings.title, {
      type: settings.type,
      confirmButtonText: settings.confirmButtonText,
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  batchLoading.value = true
  try {
    const data = await settings.request(selectedRows.value.map((row) => row.id))
    const message = `已处理 ${data.processed_count} 条，跳过 ${data.skipped_count} 条，失败 ${data.failed_count} 条`
    if (data.skipped_count || data.failed_count) {
      ElNotification.warning({ title: `批量${settings.successLabel}已完成`, message })
    } else {
      ElNotification.success({ title: `批量${settings.successLabel}成功`, message })
    }
    clearBatchSelection()
    await load()
  } catch (error) {
    notifyError(error, `批量${settings.successLabel}失败`, '请刷新后重新选择工单')
  } finally {
    batchLoading.value = false
  }
}
async function decide(action: 'approve' | 'ignore') {
  if (!selected.value || saving.value) return
  const job = selected.value
  saving.value = true
  try {
    await ElMessageBox.confirm(action === 'approve' ? '确认发布这条对标帖子？' : '确认忽略这条对标帖子？', '对标帖子审核', { type: 'warning', confirmButtonText: '确定', cancelButtonText: '取消' })
  } catch { saving.value = false; return }
  try {
    selected.value = await http.post<Review>(`/api/benchmark-trackers/reviews/${encodeURIComponent(job.id)}/${action}`, { revision: job.revision, content: content.value })
    ElNotification({ title: '工单已更新', message: labels[selected.value.status] || '已批准，等待发布', type: selected.value.status === 'failed' ? 'error' : 'success' })
    await load()
  } catch (error) { notifyError(error, '审核未完成，请刷新工单确认状态') }
  finally { saving.value = false }
}
async function retry(row: { id?: unknown }) {
  if (retryingId.value) return
  const reviewId = String(row.id || '')
  if (!reviewId) return
  try {
    await ElMessageBox.confirm('确认重新发布这条对标帖子？系统会创建新的发布任务，原失败任务仍会保留。', '重试帖子发布', { type: 'warning', confirmButtonText: '确认重试', cancelButtonText: '取消' })
  } catch { return }
  retryingId.value = reviewId
  try {
    const result = await http.post<Review>(`/api/benchmark-trackers/reviews/${encodeURIComponent(reviewId)}/retry`, {})
    if (selected.value?.id === reviewId) selected.value = result
    ElNotification.success({ title: '已重新下发', message: '帖子发布已重新进入任务队列' })
    await load()
  } catch (error) { notifyError(error, '重试失败', '帖子暂时无法重新发布') }
  finally { retryingId.value = '' }
}
onMounted(() => { void load(); timer = setInterval(() => { if (!loading.value && !visible.value) void load() }, 10000) })
onBeforeUnmount(() => { request++; if (timer) clearInterval(timer) })
</script>

<template>
  <section class="benchmark-reviews">
    <div class="review-toolbar">
      <span>工单状态</span>
      <el-select v-model="status" clearable placeholder="全部" @change="page = 1; load()">
        <el-option v-for="value in ['pending_review', 'succeeded', 'failed', 'ignored']" :key="value" :label="labels[value]" :value="value" />
      </el-select>
      <el-tooltip content="刷新"><el-button :icon="RefreshCw" circle :loading="loading" @click="load" /></el-tooltip>
    </div>
    <div v-if="canManageReviews" class="review-batch-bar">
      <span>已选择 <strong>{{ selectedRows.length }}</strong> 条工单</span>
      <div class="review-batch-actions">
        <el-button :icon="Check" :loading="batchLoading" :disabled="batchActionsDisabled" @click="runBatchAction('approve')">批量批准发布</el-button>
        <el-button :icon="SkipForward" :loading="batchLoading" :disabled="batchActionsDisabled" @click="runBatchAction('ignore')">批量忽略</el-button>
        <el-button type="danger" plain :icon="Trash2" :loading="batchLoading" :disabled="batchActionsDisabled" @click="runBatchAction('delete')">批量删除记录</el-button>
      </div>
    </div>
    <el-table ref="tableRef" v-loading="loading" :data="rows" row-key="id" border empty-text="暂无对标帖子工单" @selection-change="handleSelectionChange">
      <el-table-column v-if="canManageReviews" type="selection" width="46" fixed="left" reserve-selection />
      <el-table-column label="来源账号" min-width="160"><template #default="{ row }"><strong>{{ row.source_display_name || row.source_username }}</strong><div>{{ row.source_business_platform === 'x' ? 'X(Twitter)' : 'Threads' }}</div></template></el-table-column>
      <el-table-column label="发布账号" min-width="160"><template #default="{ row }"><strong>{{ row.target_display_name || row.target_username }}</strong><div>{{ row.business_platform === 'x' ? 'X(Twitter)' : 'Threads' }}</div></template></el-table-column>
      <el-table-column label="帖子内容" min-width="300"><template #default="{ row }">
        <p class="post-summary">{{ row.final_content || '媒体帖子' }}</p>
        <a v-if="safeUrl(row.snapshot.content_url)" :href="safeUrl(row.snapshot.content_url)" target="_blank" rel="noopener noreferrer" class="post-link"><ExternalLink :size="14" />打开原帖</a>
        <span v-if="row.snapshot.media_urls?.length"> · {{ row.snapshot.media_urls.length }} 项媒体</span>
      </template></el-table-column>
      <el-table-column label="状态" width="120"><template #default="{ row }"><el-tag :type="statusType(row.status)">{{ labels[row.status] || '等待发布' }}</el-tag></template></el-table-column>
      <el-table-column label="创建时间" width="175"><template #default="{ row }">{{ formatDate(row.created_at) }}</template></el-table-column>
      <el-table-column label="操作" width="120" fixed="right"><template #default="{ row }"><el-tooltip content="查看审核工单"><el-button :icon="Eye" circle text @click="open(row)" /></el-tooltip><el-tooltip v-if="row.status === 'failed' && auth.can('operations.retry')" content="重试发布"><el-button :icon="RefreshCw" circle text type="danger" :loading="retryingId === row.id" :disabled="Boolean(retryingId)" @click="retry(row)" /></el-tooltip></template></el-table-column>
    </el-table>
    <el-pagination v-model:current-page="page" :total="total" :page-size="20" layout="total, prev, pager, next" @current-change="load" />
    <el-dialog v-model="visible" title="对标帖子审核" top="5vh" width="min(92vw, 760px)" destroy-on-close :close-on-click-modal="false" :before-close="(done: () => void) => { if (!saving) done() }">
      <div v-if="selected" class="review-body">
        <dl><dt>来源账号</dt><dd>{{ selected.source_display_name || selected.source_username }} · {{ selected.source_business_platform }}</dd><dt>发布账号</dt><dd>{{ selected.target_display_name || selected.target_username }} · {{ selected.business_platform }}</dd><dt>状态</dt><dd><el-tag :type="statusType(selected.status)">{{ labels[selected.status] || '等待发布' }}</el-tag></dd></dl>
        <a v-if="safeUrl(selected.snapshot.content_url)" :href="safeUrl(selected.snapshot.content_url)" target="_blank" rel="noopener noreferrer" class="post-link"><ExternalLink :size="14" />打开原帖</a>
        <div class="review-media"><a v-for="(url, index) in selected.snapshot.media_urls || []" :key="url" :href="safeUrl(url)" target="_blank" rel="noopener noreferrer"><el-image :src="safeUrl(url)" fit="contain" loading="lazy"><template #error><span>查看媒体 {{ index + 1 }}</span></template></el-image></a></div>
        <label for="benchmark-review-content">发布文案</label>
        <el-input id="benchmark-review-content" v-model="content" type="textarea" :rows="7" maxlength="10000" :readonly="!editable || saving" />
        <span v-if="selected.task_run_id">任务 ID：{{ selected.task_run_id }}</span>
      </div>
      <template #footer><el-button :disabled="saving || Boolean(retryingId)" @click="visible = false">关闭</el-button><el-button v-if="editable" :icon="SkipForward" :disabled="saving" @click="decide('ignore')">忽略</el-button><el-button v-if="editable" type="primary" :icon="Check" :loading="saving" @click="decide('approve')">批准发布</el-button><el-button v-if="retryable && selected" type="primary" :icon="RefreshCw" :loading="retryingId === selected.id" :disabled="Boolean(retryingId) && retryingId !== selected.id" @click="retry(selected)">重新发布</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.benchmark-reviews { padding: 16px; min-width: 0; }
.review-toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.review-toolbar .el-select { width: 180px; }
.review-batch-bar,
.review-batch-actions { display: flex; align-items: center; }
.review-batch-bar { min-height: 54px; flex-wrap: wrap; justify-content: space-between; gap: 12px; padding: 9px 12px; border: 1px solid var(--app-border, #e5ebf1); border-bottom: 0; background: var(--app-surface-muted, #f8fafc); }
.review-batch-bar > span { color: var(--app-text-muted, #66788a); font-size: 13px; }
.review-batch-bar strong { color: var(--app-blue, #1f668f); }
.review-batch-actions { flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.review-batch-actions :deep(.el-button + .el-button) { margin-left: 0; }
.post-summary { margin: 0 0 6px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; white-space: pre-wrap; }
.post-link { display: inline-flex; align-items: center; gap: 5px; color: var(--el-color-primary); }
.el-pagination { margin-top: 16px; justify-content: flex-end; }
.review-body { display: flex; flex-direction: column; gap: 12px; max-height: calc(85dvh - 120px); overflow-y: auto; }
.review-body dl { display: grid; grid-template-columns: 80px minmax(0, 1fr); gap: 8px; margin: 0; }
.review-body dd { margin: 0; overflow-wrap: anywhere; }
.review-media { display: flex; flex-wrap: wrap; gap: 8px; }
.review-media .el-image { width: 140px; height: 120px; border: 1px solid var(--el-border-color); border-radius: 4px; }
@media (max-width: 768px) {
  .review-batch-actions { width: 100%; justify-content: flex-start; }
}
</style>
