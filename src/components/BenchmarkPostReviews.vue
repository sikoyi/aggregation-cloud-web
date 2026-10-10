<script setup lang="ts">
import { Check, Copy, Eye, ExternalLink, ImagePlus, RefreshCw, RotateCcw, Search, SkipForward, Sparkles, Trash2, UserRound, X } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, toRef, watch } from 'vue'
import { ElMessageBox, ElNotification } from 'element-plus'
import { useRoute } from 'vue-router'
import { http, resolveBackendUrl } from '@/api/http'
import { uploadMediaAssets } from '@/api/mediaAssets'
import { prepareSelectedReviews, retryFailedPreparations, type PreparationAction, type PreparationResult } from '@/api/benchmarkReviewPreparation'
import { findNextReview } from '@/utils/nextReview'
import TaskDetailDrawer from '@/components/TaskDetailDrawer.vue'
import BenchmarkExecutionHistory from '@/components/BenchmarkExecutionHistory.vue'
import {
  batchApproveBenchmarkPostReviews,
  batchDeleteBenchmarkPostReviews,
  batchIgnoreBenchmarkPostReviews,
} from '@/api/benchmarkPostReviews'
import { useAuthStore } from '@/stores/auth'
import { formatDate } from '@/utils/format'
import { notifyError } from '@/utils/notify'
import RemoteSelect from '@/components/RemoteSelect.vue'
import ReviewMediaPreview from '@/components/ReviewMediaPreview.vue'
import { usePersistentFilters } from '@/composables/usePersistentFilters'
import { useScopedBusinessPlatformOptions } from '@/composables/useScopedBusinessPlatformOptions'
import { buildPostReviewQuery, createDefaultPostReviewFilters } from '@/config/postReviewFilters'
import type { RemoteSelectConfig } from '@/types/crud'
import { postProcessingLabels, type PostProcessing } from '@/utils/benchmarkPostProcessing'
import { externalAvatarUrl } from '@/utils/externalAvatar'

interface Review {
  id: string
  revision: string
  status: string
  source_display_name: string | null
  source_username: string | null
  source_avatar_url?: string | null
  source_business_platform: string
  target_display_name: string | null
  target_username: string | null
  target_avatar_url?: string | null
  target_profile_url?: string | null
  business_platform: string
  final_content: string
  final_media_urls: string[]
  review_reason?: string | null
  system_processing?: PostProcessing
  operator_modified?: boolean
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
const refreshing = ref(false)
const saving = ref(false)
const regenerating = ref(false)
const regenerationError = ref('')
const regenerationElapsed = ref(0)
let regenerationTimer: ReturnType<typeof setInterval> | undefined
const batchLoading = ref(false)
const preparationVisible = ref(false)
const preparationResults = ref<PreparationResult[]>([])
const preparationTotal = ref(0)
const preparationTitle = ref('')
const preparationAction = ref<PreparationAction>('shorten')
const preparationJobs = ref<{ id: string; revision: string }[]>([])
const preparationFilter = ref('all')
const filteredPreparationResults = computed(() => preparationResults.value.filter(item => preparationFilter.value === 'all' || item.status === preparationFilter.value))
const failedPreparations = computed(() => preparationResults.value.filter(item => item.status === 'failed').length)
const continueReview = ref(true)
const taskDetailVisible = ref(false)
const preparationLabels = { processed: '成功', skipped: '跳过', failed: '失败' }
const preparationSummary = computed(() => ['processed', 'skipped', 'failed'].map(status =>
  `${preparationLabels[status as keyof typeof preparationLabels]} ${preparationResults.value.filter(item => item.status === status).length}`,
).join(' · '))
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
const processingLabels = computed(() => selected.value ? postProcessingLabels(selected.value) : [])
const labels: Record<string, string> = {
  pending_review: '待审核', succeeded: '发布成功', failed: '发布失败', ignored: '已忽略',
  queued: '等待发布', waiting_slot: '等待设备', waiting_runtime: '等待执行端', running: '发布中',
  dispatching: '下发中', canceled: '已取消', expired: '已超时', lost: '结果丢失',
}
const editable = computed(() => (selected.value?.status === 'pending_review' && auth.can('operations.review'))
  || (selected.value?.status === 'failed' && auth.can('operations.retry')))
const retryable = computed(() => selected.value?.status === 'failed' && auth.can('operations.retry'))
const canRegenerate = computed(() => editable.value && selected.value?.business_platform === 'x'
  && Boolean(selected.value.snapshot.text_content?.trim()))
const canManageReviews = computed(() => auth.can('operations.review'))
const canRetranslate = computed(() => canManageReviews.value && selected.value?.status === 'pending_review'
  && Boolean(selected.value.snapshot.text_content?.trim()) && Boolean(selected.value.system_processing?.translation_language))
const batchActionsDisabled = computed(() => batchLoading.value || Boolean(deletingId.value) || selectedRows.value.length === 0)
const deletableStatuses = new Set(['succeeded', 'failed', 'canceled', 'expired', 'lost', 'ignored'])
let request = 0
let disposed = false
let timer: ReturnType<typeof setInterval> | undefined
function safeUrl(value?: string | null) {
  try { const url = new URL(value || ''); return ['https:', 'http:'].includes(url.protocol) ? url.href : '' } catch { return '' }
}
function statusType(value: string) {
  return value === 'succeeded' ? 'success' : ['failed', 'expired', 'lost'].includes(value) ? 'danger' : value === 'pending_review' ? 'warning' : 'info'
}
async function copyReviewId() {
  if (!selected.value) return
  try {
    if (!navigator.clipboard?.writeText) throw new Error('浏览器不支持复制，请手动选择工单 ID')
    await navigator.clipboard.writeText(selected.value.id)
    ElNotification.success({ title: '已复制工单 ID', message: selected.value.id })
  } catch (error) { notifyError(error, '复制失败，请手动选择工单 ID') }
}
function processingFor(row: unknown) {
  return postProcessingLabels(row as Review)
}
function pollingPaused() {
  return disposed || document.hidden || visible.value || preparationVisible.value || batchLoading.value
    || saving.value || uploading.value || regenerating.value || Boolean(deletingId.value)
    || Boolean(retryingId.value) || selectedRows.value.length > 0
}
async function load(quiet = false) {
  if (quiet && (refreshing.value || pollingPaused())) return
  const id = ++request
  refreshing.value = true
  if (!quiet) loading.value = true
  try {
    const result = await http.get<{ items: Review[]; total: number }>('/api/benchmark-trackers/reviews', buildPostReviewQuery(filters, page.value))
    if (id === request && (!quiet || !pollingPaused())) {
      if (JSON.stringify(rows.value) !== JSON.stringify(result.items)) rows.value = result.items
      total.value = result.total
    }
  } catch (error) { if (id === request && !quiet) notifyError(error, '加载对标审核失败') }
  finally { if (id === request) { loading.value = false; refreshing.value = false } }
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
    regenerationError.value = ''
    visible.value = true
  } catch (error) { notifyError(error, '加载工单失败') }
}
async function continueAfterReview(job: Review, previousRows: Review[], scope: string) {
  if (!continueReview.value || !visible.value) return
  try {
    const next = await findNextReview({ rows: previousRows, currentId: job.id, page: page.value, pageSize: 20,
      list: nextPage => http.get<{ items: Review[]; total: number }>('/api/benchmark-trackers/reviews', buildPostReviewQuery(filters, nextPage)),
      detail: id => http.get<Review>(`/api/benchmark-trackers/reviews/${encodeURIComponent(id)}`),
      active: () => !disposed && visible.value && scope === JSON.stringify(filters) && selected.value?.id === job.id,
    })
    if (disposed || !visible.value || scope !== JSON.stringify(filters) || selected.value?.id !== job.id) return
    if (next) {
      page.value = next.page
      rows.value = next.items
      total.value = next.total
      selected.value = next.job
      content.value = next.job.final_content
      mediaUrls.value = [...next.job.final_media_urls]
      imageUrlInput.value = ''
      regenerationError.value = ''
    } else {
      visible.value = false
      ElNotification.info({ title: '本轮审核完成', message: '当前筛选范围内没有后续待审核工单' })
    }
  } catch (error) { notifyError(error, '本条已处理，读取下一条失败，请从列表继续') }
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
  if (saving.value || uploading.value || regenerating.value) return
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
async function regenerateContent(mode: 'shorten' | 'translate' = 'shorten') {
  if (!selected.value || !(mode === 'translate' ? canRetranslate.value : canRegenerate.value) || saving.value || uploading.value || regenerating.value) return
  const job = selected.value
  const label = mode === 'translate' ? '重新翻译' : '重新缩写'
  regenerating.value = true
  try {
    try {
      await ElMessageBox.confirm(mode === 'translate'
        ? '按原始完整正文及工单目标语言重新翻译并优化话题，X 正文超长时继续缩写。全部成功后替换发布文案，图片不变，仍待审核。'
        : '按原始完整正文重新生成并保存发布文案，替换当前文案。图片选择保持不变，不会自动批准或发布。', `AI ${label}`, {
        type: 'warning', confirmButtonText: '重新生成', cancelButtonText: '取消',
      })
    } catch { return }
    saving.value = true
    regenerationError.value = ''
    regenerationElapsed.value = 0
    const startedAt = Date.now()
    regenerationTimer = setInterval(() => { regenerationElapsed.value = Math.floor((Date.now() - startedAt) / 1000) }, 1000)
    const result = await http.post<Review>(`/api/benchmark-trackers/reviews/${encodeURIComponent(job.id)}/${mode === 'translate' ? 'retranslate' : 'regenerate'}`, { revision: job.revision })
    if (selected.value?.id !== job.id) return
    selected.value = result
    content.value = result.final_content
    // Keep unsaved operator image selections; regeneration only changes the text.
    ElNotification.success({ title: `已${label}`, message: '发布文案已保存，尚未发布' })
    await load()
  } catch (error) {
    if (selected.value?.id === job.id) regenerationError.value = error instanceof Error ? error.message : `${label}失败，原稿未变更`
    notifyError(error, `${label}失败，原稿未变更`)
  } finally {
    if (regenerationTimer) clearInterval(regenerationTimer)
    regenerationTimer = undefined
    saving.value = false
    regenerating.value = false
  }
}
function handleSelectionChange(selection: Review[]) {
  selectedRows.value = selection
}
function clearBatchSelection() {
  tableRef.value?.clearSelection()
  selectedRows.value = []
}
type BatchAction = 'approve' | 'ignore' | 'delete'
async function runPreparation(action: PreparationAction) {
  if (batchActionsDisabled.value || !canManageReviews.value) return
  const jobs = selectedRows.value.map(({ id, revision }) => ({ id, revision }))
  const title = { shorten: '批量 AI 缩写', images: '批量精简图片', translate: '批量 AI 重新翻译' }[action]
  batchLoading.value = true
  try {
    try {
      await ElMessageBox.confirm(action === 'translate'
        ? `按原帖重新翻译所选 ${jobs.length} 条待审核工单，优化话题，X 正文超长时继续缩写。未配置翻译语言的跳过；图片不变，不自动发布。`
        : action === 'shorten'
        ? `处理所选 ${jobs.length} 条工单：超长正文按原始完整正文重新缩写，符合长度的跳过。成功后保存文案，仍待审核，不自动发布。`
        : `处理所选 ${jobs.length} 条工单：X 发布图片超过 4 张时保留前 2 张，其余跳过。不改正文和原始媒体，仍待审核。`, title,
      { type: 'warning', confirmButtonText: '开始处理', cancelButtonText: '取消' })
    } catch { return }
    preparationTitle.value = title
    preparationAction.value = action
    preparationJobs.value = jobs
    preparationFilter.value = 'all'
    preparationResults.value = []
    preparationTotal.value = jobs.length
    preparationVisible.value = true
    await prepareSelectedReviews(jobs, action, result => { preparationResults.value.push(result) }, () => !disposed)
    if (disposed) return
    clearBatchSelection()
    await load()
  } finally { batchLoading.value = false }
}
async function retryPreparationFailures() {
  if (batchLoading.value || !canManageReviews.value || !failedPreparations.value) return
  try {
    await ElMessageBox.confirm(`仅重试 ${failedPreparations.value} 条失败工单，成功和跳过项不重复处理。`, '重试失败项', { type: 'warning' })
  } catch { return }
  batchLoading.value = true
  try {
    await retryFailedPreparations(preparationJobs.value, [...preparationResults.value], preparationAction.value, result => {
      const index = preparationResults.value.findIndex(item => item.id === result.id)
      if (index >= 0) preparationResults.value[index] = result
    }, () => !disposed)
    if (!disposed) await load()
  } finally { batchLoading.value = false }
}
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
  const previousRows = [...rows.value]
  const scope = JSON.stringify(filters)
  saving.value = true
  try {
    selected.value = await http.post<Review>(`/api/benchmark-trackers/reviews/${encodeURIComponent(job.id)}/${action}`, { revision: job.revision, content: content.value })
    ElNotification({ title: '工单已更新', message: labels[selected.value.status] || '已批准，等待发布', type: selected.value.status === 'failed' ? 'error' : 'success' })
    await load()
    if (selected.value.status !== 'failed' && selected.value.status !== 'pending_review') await continueAfterReview(job, previousRows, scope)
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
watch(() => route.query.review_id, id => {
  if (typeof id === 'string' && id.trim()) void open({ id: id.trim() })
}, { immediate: true })
onMounted(() => { applyReviewShortcut(); void load(); timer = setInterval(() => { void load(true) }, 10000) })
onBeforeUnmount(() => { disposed = true; request++; if (timer) clearInterval(timer); if (regenerationTimer) clearInterval(regenerationTimer) })
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
          <el-form-item label="关键词"><el-input v-model="filters.keyword" clearable maxlength="200" placeholder="工单 ID / 对标账号 / 原帖 / 发布文案" @keyup.enter="searchRows" /></el-form-item>
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
        <el-button type="primary" plain :icon="Sparkles" :disabled="batchActionsDisabled" @click="runPreparation('shorten')">批量 AI 缩写</el-button>
        <el-button type="primary" plain :icon="RefreshCw" :disabled="batchActionsDisabled" @click="runPreparation('translate')">批量 AI 重新翻译</el-button>
        <el-button :icon="ImagePlus" :disabled="batchActionsDisabled" @click="runPreparation('images')">批量精简图片</el-button>
        <el-button :icon="Check" :loading="batchLoading" :disabled="batchActionsDisabled" @click="runBatchAction('approve')">批量批准发布</el-button>
        <el-button :icon="SkipForward" :loading="batchLoading" :disabled="batchActionsDisabled" @click="runBatchAction('ignore')">批量忽略</el-button>
        <el-button type="danger" plain :icon="Trash2" :loading="batchLoading" :disabled="batchActionsDisabled" @click="runBatchAction('delete')">批量删除记录</el-button>
      </div>
    </div>
    <el-table ref="tableRef" v-loading="loading" :data="rows" row-key="id" border empty-text="暂无对标帖子工单" @selection-change="handleSelectionChange">
      <el-table-column v-if="canManageReviews" type="selection" width="46" fixed="left" reserve-selection />
      <el-table-column label="来源账号" min-width="220"><template #default="{ row }">
        <div class="review-account">
          <el-avatar :size="40" :src="externalAvatarUrl(row.source_avatar_url)"><UserRound :size="20" /></el-avatar>
          <div class="review-account__text">
            <strong :title="row.source_display_name || row.source_username">{{ row.source_display_name || row.source_username || '未知账号' }}</strong>
            <span v-if="row.source_username" :title="row.source_username">@{{ row.source_username.replace(/^@/, '') }}</span>
            <span>{{ row.source_business_platform === 'x' ? 'X(Twitter)' : row.source_business_platform === 'instagram' ? 'Instagram' : row.source_business_platform === 'threads' ? 'Threads' : row.source_business_platform }}</span>
          </div>
        </div>
      </template></el-table-column>
      <el-table-column label="发布账号" min-width="220"><template #default="{ row }">
        <component :is="safeUrl(row.target_profile_url) ? 'a' : 'div'" class="review-account review-account--target"
          :href="safeUrl(row.target_profile_url) || undefined" :target="safeUrl(row.target_profile_url) ? '_blank' : undefined" rel="noopener noreferrer"
          :title="safeUrl(row.target_profile_url) ? '打开发布账号主页' : undefined">
          <el-avatar :size="40" :src="externalAvatarUrl(row.target_avatar_url)"><UserRound :size="20" /></el-avatar>
          <div class="review-account__text">
            <strong :title="row.target_display_name || row.target_username">{{ row.target_display_name || row.target_username || '未知账号' }}</strong>
            <span v-if="row.target_username" :title="row.target_username">@{{ row.target_username.replace(/^@/, '') }}</span>
            <span>{{ row.business_platform === 'x' ? 'X(Twitter)' : row.business_platform === 'instagram' ? 'Instagram' : row.business_platform === 'threads' ? 'Threads' : row.business_platform }}</span>
          </div>
        </component>
      </template></el-table-column>
      <el-table-column label="帖子内容" min-width="300"><template #default="{ row }">
        <div v-if="processingFor(row).length" class="review-processing"><el-tag v-for="item in processingFor(row)" :key="item.label" :type="item.type" size="small">{{ item.label }}</el-tag></div>
        <p class="post-summary">{{ row.final_content || '媒体帖子' }}</p>
        <a v-if="safeUrl(row.snapshot.content_url)" :href="safeUrl(row.snapshot.content_url)" target="_blank" rel="noopener noreferrer" class="post-link"><ExternalLink :size="14" />打开原帖</a>
        <span v-if="row.final_media_urls?.length"> · {{ row.final_media_urls.length }} 项媒体</span>
        <el-tooltip v-if="row.status === 'pending_review' && row.review_reason" :content="row.review_reason"><div class="review-reason">{{ row.review_reason }}</div></el-tooltip>
      </template></el-table-column>
      <el-table-column label="状态" width="120"><template #default="{ row }"><el-tag :type="statusType(row.status)">{{ labels[row.status] || '等待发布' }}</el-tag></template></el-table-column>
      <el-table-column label="创建时间" width="175"><template #default="{ row }">{{ formatDate(row.created_at) }}</template></el-table-column>
      <el-table-column label="操作" width="148" fixed="right"><template #default="{ row }"><div class="review-row-actions">
        <el-tooltip content="查看审核工单"><el-button :icon="Eye" circle text aria-label="查看审核工单" @click="open(row)" /></el-tooltip>
        <el-tooltip v-if="row.status === 'failed' && auth.can('operations.retry')" content="重试发布"><el-button :icon="RefreshCw" circle text type="danger" :loading="retryingId === row.id" :disabled="Boolean(retryingId) || Boolean(deletingId)" @click="retry(row)" /></el-tooltip>
        <el-tooltip v-if="canManageReviews && deletableStatuses.has(row.status)" content="删除记录"><el-button :icon="Trash2" circle text type="danger" aria-label="删除记录" :loading="deletingId === row.id" :disabled="Boolean(deletingId) || batchLoading || Boolean(retryingId)" @click="removeReview(row)" /></el-tooltip>
      </div></template></el-table-column>
    </el-table>
    <el-pagination v-model:current-page="page" :total="total" :page-size="20" layout="total, prev, pager, next" @current-change="load()" />
    <el-dialog v-model="visible" title="对标帖子审核" class="benchmark-review-dialog" width="min(92vw, 1120px)" align-center destroy-on-close :close-on-click-modal="false" :before-close="confirmClose">
      <div v-if="selected" class="review-body">
        <div class="review-id"><strong>工单 ID</strong><code>{{ selected.id }}</code><el-tooltip content="复制工单 ID"><el-button :icon="Copy" text circle aria-label="复制工单 ID" @click="copyReviewId" /></el-tooltip></div>
        <dl><dt>来源账号</dt><dd>{{ selected.source_display_name || selected.source_username }} · {{ selected.source_business_platform }}</dd><dt>发布账号</dt><dd>
          <component :is="safeUrl(selected.target_profile_url) ? 'a' : 'span'" :href="safeUrl(selected.target_profile_url) || undefined" target="_blank" rel="noopener noreferrer" class="review-target-link">
            {{ selected.target_display_name || selected.target_username }} · {{ selected.business_platform }}<ExternalLink v-if="safeUrl(selected.target_profile_url)" :size="14" />
          </component>
        </dd><dt>状态</dt><dd><el-tag :type="statusType(selected.status)">{{ labels[selected.status] || '等待发布' }}</el-tag></dd></dl>
        <a v-if="safeUrl(selected.snapshot.content_url)" :href="safeUrl(selected.snapshot.content_url)" target="_blank" rel="noopener noreferrer" class="post-link"><ExternalLink :size="14" />打开原帖</a>
        <div v-if="selected.review_reason">
          <el-alert :title="selected.review_reason" :type="selected.status === 'failed' ? 'error' : 'warning'" show-icon :closable="false" />
          <div class="review-draft-actions">
            <el-button v-if="canRetranslate && selected.system_processing?.translation_check === 'failed'" :icon="RefreshCw" :disabled="saving || regenerating || uploading" @click="regenerateContent('translate')">重新翻译</el-button>
            <el-button v-if="canRegenerate && selected.system_processing?.ai_shortening === 'failed'" :icon="Sparkles" :disabled="saving || regenerating || uploading" @click="regenerateContent('shorten')">重新缩写</el-button>
            <el-button v-if="selected.task_run_id && auth.can('tasks.view')" :icon="Eye" @click="taskDetailVisible = true">查看执行详情</el-button>
          </div>
        </div>
        <div v-if="processingLabels.length" class="review-processing"><el-tag v-for="item in processingLabels" :key="item.label" :type="item.type">{{ item.label }}</el-tag></div>
        <div class="review-comparison">
          <section class="review-comparison__original" aria-label="原帖内容">
            <h3>原帖内容</h3>
            <label for="benchmark-original-content">原帖正文</label>
            <el-input id="benchmark-original-content" :model-value="selected.snapshot.text_content || ''" type="textarea" :rows="7" readonly placeholder="无正文，仅媒体" />
            <div class="review-media-heading"><strong>原帖媒体</strong><span>{{ selected.snapshot.media_urls?.length || 0 }} 项</span></div>
            <div class="review-original-media-list">
              <div v-for="(url, index) in selected.snapshot.media_urls" :key="`${url}-${index}`" class="review-original-media-item">
                <ReviewMediaPreview :url="url" class="review-original-preview" />
                <el-button v-if="editable && !mediaUrls.includes(url)" size="small" :disabled="saving || uploading || mediaUrls.length >= 50" @click="mediaUrls.push(url)">加回</el-button>
              </div>
            </div>
          </section>
          <section class="review-comparison__draft" aria-label="发布稿">
            <div class="review-draft-heading">
              <h3>发布稿</h3>
              <div class="review-draft-actions">
                <el-button v-if="canRetranslate" type="primary" plain :icon="RefreshCw" :loading="regenerating" :disabled="saving || uploading || regenerating" @click="regenerateContent('translate')">AI 重新翻译</el-button>
                <el-button v-if="canRegenerate" class="review-regenerate-button" type="primary" plain size="default" :icon="Sparkles" :loading="regenerating" :disabled="saving || uploading || regenerating" @click="regenerateContent('shorten')">AI 重新缩写</el-button>
              </div>
            </div>
            <el-alert v-if="regenerationError" :title="regenerationError" type="error" show-icon :closable="false" />
            <p v-if="regenerating && saving" role="status" aria-live="polite">AI 处理中 · 已等待 {{ regenerationElapsed }} 秒</p>
            <label for="benchmark-review-content">发布文案</label>
            <el-input id="benchmark-review-content" v-model="content" type="textarea" :rows="7" maxlength="10000" :readonly="!editable || saving" />
            <div class="review-media-heading"><strong>发布媒体</strong><span>{{ mediaUrls.length }} 项</span></div>
            <div class="review-media">
              <div v-for="(url, index) in mediaUrls" :key="`${url}-${index}`" class="review-media-item">
                <ReviewMediaPreview :url="url" />
                <el-tooltip v-if="editable" content="移除这项媒体"><el-button :icon="X" circle size="small" type="danger" class="review-media-remove" aria-label="移除媒体" :disabled="saving || uploading" @click="mediaUrls.splice(index, 1)" /></el-tooltip>
              </div>
            </div>
            <div v-if="editable" class="review-media-tools">
              <input ref="fileInput" type="file" accept="image/*" multiple class="review-file-input" @change="uploadImages" />
              <el-button :icon="ImagePlus" :loading="uploading" :disabled="saving || mediaUrls.length >= 50" @click="fileInput?.click()">上传图片</el-button>
              <el-input v-model="imageUrlInput" placeholder="粘贴图片链接" :disabled="saving || uploading" @keyup.enter="addImageUrl" />
              <el-button :disabled="!imageUrlInput.trim() || saving || uploading || mediaUrls.length >= 50" @click="addImageUrl">添加链接</el-button>
            </div>
          </section>
        </div>
        <span v-if="selected.task_run_id">最新任务 ID：{{ selected.task_run_id }}</span>
        <BenchmarkExecutionHistory :review-id="selected.id" :task-id="selected.task_run_id" />
        <el-checkbox v-if="selected.status === 'pending_review' && editable" v-model="continueReview" :disabled="saving">审核后查看下一条</el-checkbox>
      </div>
      <template #footer><el-button :disabled="saving || uploading || regenerating || Boolean(retryingId)" @click="closeDialog">关闭</el-button><el-button v-if="editable" :disabled="!draftDirty || saving || uploading || regenerating" :loading="saving && !regenerating" @click="saveDraft">保存修改</el-button><el-button v-if="selected?.status === 'pending_review' && editable" :icon="SkipForward" :disabled="saving || uploading || regenerating" @click="decide('ignore')">忽略</el-button><el-button v-if="selected?.status === 'pending_review' && editable" type="primary" :icon="Check" :loading="saving && !regenerating" :disabled="saving || uploading || regenerating" @click="decide('approve')">批准发布</el-button><el-button v-if="retryable && selected" type="primary" :icon="RefreshCw" :loading="retryingId === selected.id" :disabled="saving || uploading || regenerating || (Boolean(retryingId) && retryingId !== selected.id)" @click="retry(selected)">重新发布</el-button></template>
    </el-dialog>
  </section>
  <el-dialog v-model="preparationVisible" :title="preparationTitle" width="min(720px, 94vw)" :close-on-click-modal="false" :close-on-press-escape="!batchLoading" :show-close="!batchLoading">
    <p>{{ preparationResults.length }} / {{ preparationTotal }} · {{ preparationSummary }}</p>
    <el-progress :percentage="preparationTotal ? Math.round(preparationResults.length / preparationTotal * 100) : 0" />
    <el-radio-group v-model="preparationFilter" size="small" aria-label="处理结果筛选">
      <el-radio-button value="all">全部</el-radio-button>
      <el-radio-button v-for="(label, value) in preparationLabels" :key="value" :value="value">{{ label }}</el-radio-button>
    </el-radio-group>
    <el-table :data="filteredPreparationResults" max-height="420">
      <el-table-column prop="id" label="工单 ID" min-width="160" />
      <el-table-column label="结果" width="80"><template #default="{ row }"><el-tag :type="row.status === 'processed' ? 'success' : row.status === 'failed' ? 'danger' : 'info'">{{ preparationLabels[row.status as keyof typeof preparationLabels] }}</el-tag></template></el-table-column>
      <el-table-column prop="message" label="详情" min-width="260" />
      <el-table-column label="操作" width="90"><template #default="{ row }"><el-button text :icon="Eye" :disabled="batchLoading" @click="open(row)">查看</el-button></template></el-table-column>
    </el-table>
    <template #footer><el-button :icon="RefreshCw" :loading="batchLoading" :disabled="!failedPreparations || batchLoading || !canManageReviews" @click="retryPreparationFailures">仅重试失败项（{{ failedPreparations }}）</el-button><el-button :disabled="batchLoading" @click="preparationVisible = false">关闭</el-button></template>
  </el-dialog>
  <TaskDetailDrawer v-model="taskDetailVisible" :task-id="selected?.task_run_id || null" />
</template>

<style scoped>
.review-id { display: flex; align-items: center; gap: 8px; min-width: 0; }
.review-id code { overflow-wrap: anywhere; user-select: all; min-width: 0; }
.review-id strong, .review-id .el-button { flex-shrink: 0; }
.review-original-preview { height: 180px; }
.review-draft-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; min-height: 32px; }
.review-draft-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.review-draft-actions :deep(.el-button + .el-button) { margin-left: 0; }
.review-regenerate-button { font-weight: 600; }
.review-account { display: flex; align-items: center; gap: 10px; min-width: 0; }
.review-account :deep(.el-avatar) { flex-shrink: 0; background: var(--app-surface-muted, #eaf4fb); color: var(--app-blue, #316589); }
.review-account--target { color: inherit; text-decoration: none; }
a.review-account--target:hover strong { color: var(--el-color-primary); text-decoration: underline; }
.review-target-link { display: inline-flex; align-items: center; gap: 6px; color: inherit; }
a.review-target-link { color: var(--el-color-primary); }
.review-account__text { display: flex; flex-direction: column; min-width: 0; gap: 2px; }
.review-account__text > * { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.review-account__text > span { font-size: 12px; color: var(--app-text-muted, #66788a); }
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
.review-reason { margin-top: 6px; color: var(--el-color-warning); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.el-pagination { margin-top: 16px; justify-content: flex-end; }
.review-body { display: flex; flex-direction: column; gap: 12px; }
:global(.benchmark-review-dialog) { display: flex; flex-direction: column; max-height: calc(100dvh - 32px); }
:global(.benchmark-review-dialog .el-dialog__body) { min-height: 0; overflow-y: auto; }
:global(.benchmark-review-dialog .el-dialog__header), :global(.benchmark-review-dialog .el-dialog__footer) { flex-shrink: 0; }
.review-processing { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
.review-comparison { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; }
.review-comparison > section { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.review-comparison h3 { margin: 0; font-size: 15px; font-weight: 600; }
.review-comparison__draft { border-left: 1px solid var(--el-border-color); padding-left: 24px; }
.review-body dl { display: grid; grid-template-columns: 80px minmax(0, 1fr); gap: 8px; margin: 0; }
.review-body dd { margin: 0; overflow-wrap: anywhere; }
.review-body :deep(.el-alert__title) { overflow-wrap: anywhere; }
.review-media { display: flex; flex-wrap: wrap; gap: 8px; }
.review-media-heading { display: flex; gap: 8px; align-items: center; }
.review-media-heading span { color: var(--app-text-muted, #66788a); font-size: 12px; }
.review-media-item { position: relative; width: min(180px, 100%); height: 180px; }
.review-media-remove { position: absolute; top: 4px; right: 4px; }
.review-media-tools { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.review-media-tools .el-input { flex: 1 1 220px; }
.review-file-input { display: none; }
.review-original-media-list { display: flex; flex-wrap: wrap; gap: 8px; }
.review-original-media-item { display: flex; flex-direction: column; align-items: center; gap: 5px; width: min(180px, 100%); }
.review-original-media-item:has(.is-video), .review-media-item:has(.is-video) { width: 100%; }
.review-original-media-item:has(.is-video) .review-original-preview,
.review-media-item:has(.is-video) { height: clamp(240px, 42dvh, 380px); }
@media (max-width: 768px) {
  .review-comparison { grid-template-columns: minmax(0, 1fr); }
  .review-comparison__draft { border-left: 0; border-top: 1px solid var(--el-border-color); padding: 16px 0 0; }
  .filter-grid { grid-template-columns: 1fr; }
  .filter-grid__item--wide { grid-column: span 1; }
  .review-batch-actions { width: 100%; justify-content: flex-start; }
}
</style>
