<script setup lang="ts">
import { Check, Eye, ExternalLink, ImagePlus, RefreshCw, RotateCcw, Search, SkipForward, Trash2, X } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, toRef, watch } from 'vue'
import { ElMessageBox, ElNotification } from 'element-plus'
import { useRoute } from 'vue-router'
import { http, resolveBackendUrl } from '@/api/http'
import { uploadMediaAssets } from '@/api/mediaAssets'
import {
  batchApproveBenchmarkPostReviews,
  batchDeleteBenchmarkPostReviews,
  batchIgnoreBenchmarkPostReviews,
} from '@/api/benchmarkPostReviews'
import { useAuthStore } from '@/stores/auth'
import { formatDate } from '@/utils/format'
import { notifyError } from '@/utils/notify'
import RemoteSelect from '@/components/RemoteSelect.vue'
import { usePersistentFilters } from '@/composables/usePersistentFilters'
import { useScopedBusinessPlatformOptions } from '@/composables/useScopedBusinessPlatformOptions'
import { buildPostReviewQuery, createDefaultPostReviewFilters } from '@/config/postReviewFilters'
import type { RemoteSelectConfig } from '@/types/crud'

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
  final_media_urls: string[]
  task_run_id: string | null
  created_at: string
  snapshot: { content_url?: string; text_content?: string; media_urls?: string[] }
}
const auth = useAuthStore()
const route = useRoute()
const rows = ref<Review[]>([])
const { filters, resetFilters: resetCachedFilters } = usePersistentFilters('list:post-reviews:v1', createDefaultPostReviewFilters())
const status = toRef(filters, 'status')
const platformOptions = useScopedBusinessPlatformOptions()
const hasFilters = computed(() => Object.values(filters).some(value => Array.isArray(value) ? value.length > 0 : Boolean(value)))
const accountSelectConfig = computed<RemoteSelectConfig>(() => ({
  endpoint: '/api/accounts', labelKeys: ['login_username', 'username', 'display_name', 'platform_account_id'], valueKey: 'id',
  detailPath: value => `/api/accounts/${encodeURIComponent(value)}`, searchParam: 'keyword', pageSize: 50,
  params: { business_platform: filters.businessPlatform || undefined, tag_id: filters.accountTagId || undefined },
}))
const accountTagSelectConfig: RemoteSelectConfig = { endpoint: '/api/account-tags', labelKey: 'name', valueKey: 'id',
  detailPath: value => `/api/account-tags/${encodeURIComponent(value)}`, searchParam: 'keyword', pageSize: 50 }
watch(() => [filters.businessPlatform, filters.accountTagId], () => { filters.accountId = '' })
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const saving = ref(false)
const batchLoading = ref(false)
const retryingId = ref('')
const deletingId = ref('')
const selectedRows = ref<Review[]>([])
const tableRef = ref<{ clearSelection: () => void } | null>(null)
const selected = ref<Review | null>(null)
const visible = ref(false)
const content = ref('')
const mediaUrls = ref<string[]>([])
const imageUrlInput = ref('')
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const draftDirty = computed(() => Boolean(selected.value) && (
  content.value !== selected.value?.final_content
  || JSON.stringify(mediaUrls.value) !== JSON.stringify(selected.value?.final_media_urls || [])
))
const originalMediaChanged = computed(() => JSON.stringify(mediaUrls.value)
  !== JSON.stringify(selected.value?.snapshot.media_urls || []))
const labels: Record<string, string> = {
  pending_review: '待审核', succeeded: '发布成功', failed: '发布失败', ignored: '已忽略',
  queued: '等待发布', waiting_slot: '等待设备', waiting_runtime: '等待执行端', running: '发布中',
  dispatching: '下发中', canceled: '已取消', expired: '已超时', lost: '结果丢失',
}
const editable = computed(() => (selected.value?.status === 'pending_review' && auth.can('operations.review'))
  || (selected.value?.status === 'failed' && auth.can('operations.retry')))
const retryable = computed(() => selected.value?.status === 'failed' && auth.can('operations.retry'))
const canManageReviews = computed(() => auth.can('operations.review'))
const batchActionsDisabled = computed(() => batchLoading.value || Boolean(deletingId.value) || selectedRows.value.length === 0)
const deletableStatuses = new Set(['succeeded', 'failed', 'canceled', 'expired', 'lost', 'ignored'])
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
    const result = await http.get<{ items: Review[]; total: number }>('/api/benchmark-trackers/reviews', buildPostReviewQuery(filters, page.value))
    if (id === request) { rows.value = result.items; total.value = result.total }
  } catch (error) { if (id === request) notifyError(error, '加载对标审核失败') }
  finally { if (id === request) loading.value = false }
}
function searchRows() {
  clearBatchSelection()
  page.value = 1
  void load()
}
function resetFilters() {
  resetCachedFilters()
  status.value = ''
  searchRows()
}
async function open(row: Record<string, unknown>) {
  try {
    selected.value = await http.get<Review>(`/api/benchmark-trackers/reviews/${encodeURIComponent(String(row.id))}`)
    content.value = selected.value.final_content
    mediaUrls.value = [...(selected.value.final_media_urls || [])]
    imageUrlInput.value = ''
    visible.value = true
  } catch (error) { notifyError(error, '加载工单失败') }
}
function addImageUrl() {
  const url = imageUrlInput.value.trim()
  if (!safeUrl(url) || new URL(url).username || new URL(url).password) {
    ElNotification.warning({ title: '图片链接无效', message: '请输入完整的 HTTP(S) 图片地址' })
    return
  }
  if (!mediaUrls.value.includes(url)) mediaUrls.value.push(url)
  imageUrlInput.value = ''
}
async function confirmClose(done: () => void) {
  if (saving.value || uploading.value) return
  if (draftDirty.value) {
    try {
      await ElMessageBox.confirm('当前修改尚未保存，确认关闭？', '未保存的修改', {
        type: 'warning', confirmButtonText: '关闭', cancelButtonText: '继续编辑',
      })
    } catch { return }
  }
  done()
}
function closeDialog() {
  void confirmClose(() => { visible.value = false })
}
async function uploadImages(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''
  if (!selected.value || !files.length) return
  if (files.some(file => !file.type.startsWith('image/'))) {
    ElNotification.warning({ title: '文件类型不支持', message: '只能上传图片文件' })
    return
  }
  if (mediaUrls.value.length + files.length > 50) {
    ElNotification.warning({ title: '图片过多', message: '每条工单最多保留 50 项媒体' })
    return
  }
  uploading.value = true
  try {
    const results = await uploadMediaAssets(files, {
      businessPlatform: selected.value.business_platform,
      status: 'enabled', tags: [], remark: '',
    })
    for (const result of results) {
      const url = resolveBackendUrl(result.data?.source_url)
      if (result.status === 'succeeded' && safeUrl(url) && !mediaUrls.value.includes(url)) mediaUrls.value.push(url)
    }
    const failed = results.filter(result => result.status === 'failed')
    if (failed.length) ElNotification.warning({ title: '部分图片上传失败', message: failed.map(item => `${item.file.name}: ${item.error}`).join('；') })
  } catch (error) { notifyError(error, '上传图片失败') }
  finally { uploading.value = false }
}
async function saveDraft() {
  if (!selected.value || saving.value || uploading.value) return false
  saving.value = true
  try {
    selected.value = await http.post<Review>(`/api/benchmark-trackers/reviews/${encodeURIComponent(selected.value.id)}/draft`, {
      revision: selected.value.revision, content: content.value, media_urls: mediaUrls.value,
    })
    content.value = selected.value.final_content
    mediaUrls.value = [...selected.value.final_media_urls]
    await load()
    return true
  } catch (error) { notifyError(error, '保存工单修改失败'); return false }
  finally { saving.value = false }
}
function handleSelectionChange(selection: Review[]) {
  selectedRows.value = selection
}
function clearBatchSelection() {
  tableRef.value?.clearSelection()
  selectedRows.value = []
}
type BatchAction = 'approve' | 'ignore' | 'delete'
async function removeReview(raw: unknown) {
  const row = raw as Review
  if (!canManageReviews.value || !deletableStatuses.has(row.status) || deletingId.value || batchLoading.value || retryingId.value) return
  deletingId.value = row.id
  try {
    try {
      await ElMessageBox.confirm('确认删除这条帖子审核记录？仅隐藏工单，发布任务、帖子映射和操作审计仍会保留。', '删除帖子审核记录', { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' })
    } catch { return }
    const result = await batchDeleteBenchmarkPostReviews([row.id])
    if (result.processed_count === 1) {
      ElNotification.success({ title: '删除成功', message: '帖子审核记录已删除' })
      if (selected.value?.id === row.id) { visible.value = false; selected.value = null }
      if (rows.value.length === 1 && page.value > 1) page.value--
    } else {
      ElNotification.warning({ title: '未删除记录', message: result.failures[0]?.message || '工单状态已变化或记录不可删除，请刷新后重试' })
    }
    clearBatchSelection()
    await load()
  } catch (error) { notifyError(error, '删除失败', '帖子审核记录未能删除') }
  finally { deletingId.value = '' }
}

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
  if (!selected.value || saving.value || uploading.value) return
  try {
    await ElMessageBox.confirm(action === 'approve' ? '确认发布这条对标帖子？' : '确认忽略这条对标帖子？', '对标帖子审核', { type: 'warning', confirmButtonText: '确定', cancelButtonText: '取消' })
  } catch { return }
  if (action === 'approve' && draftDirty.value && !await saveDraft()) return
  const job = selected.value
  if (!job) return
  saving.value = true
  try {
    selected.value = await http.post<Review>(`/api/benchmark-trackers/reviews/${encodeURIComponent(job.id)}/${action}`, { revision: job.revision, content: content.value })
    ElNotification({ title: '工单已更新', message: labels[selected.value.status] || '已批准，等待发布', type: selected.value.status === 'failed' ? 'error' : 'success' })
    await load()
  } catch (error) { notifyError(error, '审核未完成，请刷新工单确认状态') }
  finally { saving.value = false }
}
async function retry(row: { id?: unknown }) {
  if (retryingId.value || deletingId.value) return
  const reviewId = String(row.id || '')
  if (!reviewId) return
  try {
    await ElMessageBox.confirm('确认重新发布这条对标帖子？系统会创建新的发布任务，原失败任务仍会保留。', '重试帖子发布', { type: 'warning', confirmButtonText: '确认重试', cancelButtonText: '取消' })
  } catch { return }
  if (selected.value?.id === reviewId && draftDirty.value && !await saveDraft()) return
  retryingId.value = reviewId
  try {
    const result = await http.post<Review>(`/api/benchmark-trackers/reviews/${encodeURIComponent(reviewId)}/retry`, {})
    if (selected.value?.id === reviewId) selected.value = result
    ElNotification.success({ title: '已重新下发', message: '帖子发布已重新进入任务队列' })
    await load()
  } catch (error) { notifyError(error, '重试失败', '帖子暂时无法重新发布') }
  finally { retryingId.value = '' }
}
function applyReviewShortcut() {
  if (route.query.status !== 'pending_review') return false
  Object.assign(filters, createDefaultPostReviewFilters(), { status: 'pending_review' })
  page.value = 1
  return true
}
watch(() => route.query.status, () => { if (applyReviewShortcut()) void load() })
onMounted(() => { applyReviewShortcut(); void load(); timer = setInterval(() => { if (!loading.value && !visible.value) void load() }, 10000) })
onBeforeUnmount(() => { request++; if (timer) clearInterval(timer) })
</script>

<template>
  <section class="benchmark-reviews">
    <div class="review-filters">
      <div class="filter-title"><Search :size="14" /><span>筛选条件</span></div>
      <el-form inline label-position="right" label-suffix=":" class="compact-filter-form" @submit.prevent="searchRows">
        <div class="filter-grid">
          <el-form-item label="业务平台"><el-select v-model="filters.businessPlatform" clearable placeholder="全部"><el-option v-for="item in platformOptions" :key="String(item.value)" :label="item.label" :value="String(item.value)" /></el-select></el-form-item>
          <el-form-item label="发布账号"><RemoteSelect v-model="filters.accountId" :config="accountSelectConfig" compact placeholder="全部" /></el-form-item>
          <el-form-item label="账号标签"><RemoteSelect v-model="filters.accountTagId" :config="accountTagSelectConfig" compact placeholder="全部" /></el-form-item>
          <el-form-item label="工单状态">
            <el-select v-model="status" clearable placeholder="全部" @change="searchRows">
              <el-option v-for="(label, value) in labels" :key="value" :label="label" :value="value" />
            </el-select>
          </el-form-item>
          <el-form-item label="发现时间" class="filter-grid__item--wide"><el-date-picker v-model="filters.createdRange" type="datetimerange" value-format="YYYY-MM-DDTHH:mm:ssZ" range-separator="至" start-placeholder="开始时间" end-placeholder="结束时间" /></el-form-item>
          <el-form-item label="关键词"><el-input v-model="filters.keyword" clearable maxlength="200" placeholder="对标账号 / 原帖 / 发布文案" @keyup.enter="searchRows" /></el-form-item>
        </div>
        <div class="filter-actions">
          <el-button :icon="RotateCcw" :disabled="!hasFilters" @click="resetFilters">清空</el-button>
          <el-button type="primary" :icon="Search" :loading="loading" @click="searchRows">查询</el-button>
        </div>
      </el-form>
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
        <span v-if="row.final_media_urls?.length"> · {{ row.final_media_urls.length }} 项媒体</span>
      </template></el-table-column>
      <el-table-column label="状态" width="120"><template #default="{ row }"><el-tag :type="statusType(row.status)">{{ labels[row.status] || '等待发布' }}</el-tag></template></el-table-column>
      <el-table-column label="创建时间" width="175"><template #default="{ row }">{{ formatDate(row.created_at) }}</template></el-table-column>
      <el-table-column label="操作" width="148" fixed="right"><template #default="{ row }"><div class="review-row-actions">
        <el-tooltip content="查看审核工单"><el-button :icon="Eye" circle text aria-label="查看审核工单" @click="open(row)" /></el-tooltip>
        <el-tooltip v-if="row.status === 'failed' && auth.can('operations.retry')" content="重试发布"><el-button :icon="RefreshCw" circle text type="danger" :loading="retryingId === row.id" :disabled="Boolean(retryingId) || Boolean(deletingId)" @click="retry(row)" /></el-tooltip>
        <el-tooltip v-if="canManageReviews && deletableStatuses.has(row.status)" content="删除记录"><el-button :icon="Trash2" circle text type="danger" aria-label="删除记录" :loading="deletingId === row.id" :disabled="Boolean(deletingId) || batchLoading || Boolean(retryingId)" @click="removeReview(row)" /></el-tooltip>
      </div></template></el-table-column>
    </el-table>
    <el-pagination v-model:current-page="page" :total="total" :page-size="20" layout="total, prev, pager, next" @current-change="load" />
    <el-dialog v-model="visible" title="对标帖子审核" top="5vh" width="min(92vw, 760px)" destroy-on-close :close-on-click-modal="false" :before-close="confirmClose">
      <div v-if="selected" class="review-body">
        <dl><dt>来源账号</dt><dd>{{ selected.source_display_name || selected.source_username }} · {{ selected.source_business_platform }}</dd><dt>发布账号</dt><dd>{{ selected.target_display_name || selected.target_username }} · {{ selected.business_platform }}</dd><dt>状态</dt><dd><el-tag :type="statusType(selected.status)">{{ labels[selected.status] || '等待发布' }}</el-tag></dd></dl>
        <a v-if="safeUrl(selected.snapshot.content_url)" :href="safeUrl(selected.snapshot.content_url)" target="_blank" rel="noopener noreferrer" class="post-link"><ExternalLink :size="14" />打开原帖</a>
        <div class="review-media-heading"><strong>发布媒体</strong><span>{{ mediaUrls.length }} 项</span></div>
        <div class="review-media">
          <div v-for="(url, index) in mediaUrls" :key="`${url}-${index}`" class="review-media-item">
            <a :href="safeUrl(url)" target="_blank" rel="noopener noreferrer"><el-image :src="safeUrl(url)" fit="contain" loading="lazy"><template #error><span>查看媒体 {{ index + 1 }}</span></template></el-image></a>
            <el-tooltip v-if="editable" content="移除这项媒体"><el-button :icon="X" circle size="small" type="danger" class="review-media-remove" aria-label="移除媒体" :disabled="saving || uploading" @click="mediaUrls.splice(index, 1)" /></el-tooltip>
          </div>
        </div>
        <div v-if="editable" class="review-media-tools">
          <input ref="fileInput" type="file" accept="image/*" multiple class="review-file-input" @change="uploadImages" />
          <el-button :icon="ImagePlus" :loading="uploading" :disabled="saving || mediaUrls.length >= 50" @click="fileInput?.click()">上传图片</el-button>
          <el-input v-model="imageUrlInput" placeholder="粘贴图片链接" :disabled="saving || uploading" @keyup.enter="addImageUrl" />
          <el-button :disabled="!imageUrlInput.trim() || saving || uploading || mediaUrls.length >= 50" @click="addImageUrl">添加链接</el-button>
        </div>
        <div v-if="editable && originalMediaChanged && selected.snapshot.media_urls?.length" class="review-original-media">
          <strong>原帖媒体</strong>
          <div class="review-original-media-list">
            <div v-for="(url, index) in selected.snapshot.media_urls" :key="`${url}-${index}`" class="review-original-media-item">
              <el-image :src="safeUrl(url)" fit="contain" loading="lazy"><template #error><a :href="safeUrl(url)" target="_blank" rel="noopener noreferrer">媒体 {{ index + 1 }}</a></template></el-image>
              <el-button v-if="!mediaUrls.includes(url)" size="small" :disabled="saving || uploading || mediaUrls.length >= 50" @click="mediaUrls.push(url)">加回</el-button>
            </div>
          </div>
        </div>
        <div v-if="selected.snapshot.text_content && selected.final_content !== selected.snapshot.text_content" class="review-original">
          <strong>原帖正文</strong><p>{{ selected.snapshot.text_content }}</p>
        </div>
        <label for="benchmark-review-content">发布文案</label>
        <el-input id="benchmark-review-content" v-model="content" type="textarea" :rows="7" maxlength="10000" :readonly="!editable || saving" />
        <span v-if="selected.task_run_id">任务 ID：{{ selected.task_run_id }}</span>
      </div>
      <template #footer><el-button :disabled="saving || uploading || Boolean(retryingId)" @click="closeDialog">关闭</el-button><el-button v-if="editable" :disabled="!draftDirty || saving || uploading" :loading="saving" @click="saveDraft">保存修改</el-button><el-button v-if="selected?.status === 'pending_review' && editable" :icon="SkipForward" :disabled="saving || uploading" @click="decide('ignore')">忽略</el-button><el-button v-if="selected?.status === 'pending_review' && editable" type="primary" :icon="Check" :loading="saving" :disabled="uploading" @click="decide('approve')">批准发布</el-button><el-button v-if="retryable && selected" type="primary" :icon="RefreshCw" :loading="retryingId === selected.id" :disabled="Boolean(retryingId) && retryingId !== selected.id" @click="retry(selected)">重新发布</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.review-row-actions { display: flex; align-items: center; justify-content: center; gap: 4px; }
.review-row-actions :deep(.el-button) { margin: 0; flex-shrink: 0; }
.benchmark-reviews { padding: 14px 16px 16px; min-width: 0; background: var(--app-surface-muted, #f8fafc); }
.review-filters { margin-bottom: 12px; padding: 12px; border: 1px solid var(--app-border, #dbe4ed); border-radius: 6px; background: var(--app-surface, #fff); }
.filter-title { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; color: var(--app-text, #26384a); font-size: 13px; font-weight: 700; }
.filter-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px 14px; }
.filter-grid :deep(.el-form-item) { margin-right: 0; margin-bottom: 0; }
.filter-grid :deep(.el-form-item__label) { min-width: 72px; justify-content: flex-end; color: var(--app-text, #52606d); font-size: 12px; font-weight: 600; text-align: right; }
.filter-grid :deep(.el-select), .filter-grid :deep(.el-input), .filter-grid :deep(.el-date-editor) { width: 100%; min-width: 0; }
.filter-grid__item--wide { grid-column: span 2; }
.filter-grid :deep(.el-form-item__content) { min-width: 0; }
.filter-actions { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
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
.review-media-heading { display: flex; gap: 8px; align-items: center; }
.review-media-heading span { color: var(--app-text-muted, #66788a); font-size: 12px; }
.review-media-item { position: relative; width: 140px; height: 120px; }
.review-media-remove { position: absolute; top: 4px; right: 4px; }
.review-media-tools { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.review-media-tools .el-input { flex: 1 1 220px; }
.review-file-input { display: none; }
.review-original-media { display: flex; flex-direction: column; gap: 8px; padding-top: 10px; border-top: 1px solid var(--el-border-color); }
.review-original-media-list { display: flex; flex-wrap: wrap; gap: 8px; }
.review-original-media-item { display: flex; flex-direction: column; align-items: center; gap: 5px; width: 86px; }
.review-original-media-item .el-image { width: 86px; height: 72px; border: 1px solid var(--el-border-color); border-radius: 4px; }
.review-media .el-image { width: 140px; height: 120px; border: 1px solid var(--el-border-color); border-radius: 4px; }
.review-original { padding: 10px 0; border-top: 1px solid var(--el-border-color); }
.review-original p { margin: 6px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
@media (max-width: 768px) {
  .filter-grid { grid-template-columns: 1fr; }
  .filter-grid__item--wide { grid-column: span 1; }
  .review-batch-actions { width: 100%; justify-content: flex-start; }
}
</style>
