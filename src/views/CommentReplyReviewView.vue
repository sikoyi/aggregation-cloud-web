<script setup lang="ts">
import {
  Check,
  Eye,
  MessageSquareReply,
  RefreshCw,
  RotateCcw,
  Search,
  SkipForward,
} from 'lucide-vue-next'
import { ElMessageBox, ElNotification } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import {
  approveCommentReply,
  getCommentReply,
  ignoreCommentReply,
  listCommentReplies,
  regenerateCommentReply,
  retryCommentReply,
} from '@/api/commentReplies'
import { usePersistentFilters } from '@/composables/usePersistentFilters'
import { REALTIME_EVENT_NAME, type RealtimeEventPayload } from '@/composables/useRealtimeEvents'
import { useAuthStore } from '@/stores/auth'
import type { AnyRecord } from '@/types/api'
import { formatDate } from '@/utils/format'
import { notifyError } from '@/utils/notify'

const auth = useAuthStore()
const statusOptions = [
  { label: '生成中', value: 'generating', type: 'primary' },
  { label: '待审核', value: 'pending_review', type: 'warning' },
  { label: '排队中', value: 'queued', type: 'primary' },
  { label: '等待设备', value: 'waiting_slot', type: 'warning' },
  { label: '等待 Runtime', value: 'waiting_runtime', type: 'warning' },
  { label: '下发中', value: 'dispatching', type: 'primary' },
  { label: '执行中', value: 'running', type: 'primary' },
  { label: '等待重试', value: 'retry_wait', type: 'warning' },
  { label: '调度限流', value: 'rate_limited', type: 'warning' },
  { label: '已成功', value: 'succeeded', type: 'success' },
  { label: '失败', value: 'failed', type: 'danger' },
  { label: '待处理', value: 'blocked', type: 'danger' },
  { label: '已忽略', value: 'ignored', type: 'info' },
  { label: '已取消', value: 'canceled', type: 'info' },
] as const

const loading = ref(false)
const actionLoading = ref(false)
const rows = ref<AnyRecord[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const dialogVisible = ref(false)
const activeJob = ref<AnyRecord | null>(null)
const editedContent = ref('')
const { filters, resetFilters: resetCachedFilters } = usePersistentFilters(
  'list:comment-replies',
  { status: '', keyword: '' },
)
let refreshTimer: number | undefined

const hasFilters = computed(() => Boolean(filters.status || filters.keyword))
const canApprove = computed(() => activeJob.value?.status === 'pending_review' && auth.can('operations.review'))

function statusMeta(value: unknown) {
  return statusOptions.find((item) => item.value === value) || { label: String(value || '-'), type: 'info' }
}

function replyModeLabel(value: unknown) {
  if (value === 'automatic') return '自动回复'
  if (value === 'review') return '人工审核'
  return '未开启'
}

async function loadRows() {
  loading.value = true
  try {
    const data = await listCommentReplies({
      status: filters.status || undefined,
      keyword: filters.keyword.trim() || undefined,
      page: page.value,
      page_size: pageSize.value,
    })
    rows.value = data.items
    total.value = data.total
  } catch (err) {
    notifyError(err, '加载失败', '无法加载评论回复工单')
  } finally {
    loading.value = false
  }
}

function searchRows() {
  page.value = 1
  void loadRows()
}

function resetFilters() {
  resetCachedFilters()
  searchRows()
}

async function openJob(row: AnyRecord) {
  try {
    const job = await getCommentReply(String(row.id))
    activeJob.value = job
    editedContent.value = String(job.final_content || job.generated_content || '')
    dialogVisible.value = true
  } catch (err) {
    notifyError(err, '读取失败', '无法读取回复工单详情')
  }
}

async function approveActive() {
  if (!activeJob.value || !editedContent.value.trim()) {
    ElNotification.warning({ title: '回复内容不能为空', message: '请填写确认下发的回复文案' })
    return
  }
  actionLoading.value = true
  try {
    await approveCommentReply(String(activeJob.value.id), editedContent.value)
    dialogVisible.value = false
    ElNotification.success({ title: '已确认下发', message: '回复任务已经进入设备任务队列' })
    await loadRows()
  } catch (err) {
    notifyError(err, '下发失败', '回复任务未能进入队列')
  } finally {
    actionLoading.value = false
  }
}

async function regenerate(row: AnyRecord) {
  actionLoading.value = true
  try {
    await regenerateCommentReply(String(row.id))
    dialogVisible.value = false
    ElNotification.success({ title: '已重新生成', message: '后台正在生成新的回复文案' })
    await loadRows()
  } catch (err) {
    notifyError(err, '操作失败', '无法重新生成回复文案')
  } finally {
    actionLoading.value = false
  }
}

async function ignore(row: AnyRecord) {
  try {
    await ElMessageBox.confirm('忽略后不会为这条评论下发回复任务。', '确认忽略', {
      type: 'warning',
      confirmButtonText: '确认忽略',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  actionLoading.value = true
  try {
    await ignoreCommentReply(String(row.id))
    dialogVisible.value = false
    ElNotification.success({ title: '已忽略', message: '这条新评论不会再自动回复' })
    await loadRows()
  } catch (err) {
    notifyError(err, '操作失败', '无法忽略回复工单')
  } finally {
    actionLoading.value = false
  }
}

async function retry(row: AnyRecord) {
  actionLoading.value = true
  try {
    await retryCommentReply(String(row.id))
    ElNotification.success({ title: '已重试', message: '后台将重新处理该回复工单' })
    await loadRows()
  } catch (err) {
    notifyError(err, '重试失败', '回复工单暂时无法重试')
  } finally {
    actionLoading.value = false
  }
}

function ignoreActive() {
  if (activeJob.value) void ignore(activeJob.value)
}

function regenerateActive() {
  if (activeJob.value) void regenerate(activeJob.value)
}

function handleRealtimeEvent(event: Event) {
  const payload = (event as CustomEvent<RealtimeEventPayload>).detail
  if (payload?.topic !== 'comment_reply') return
  if (refreshTimer) window.clearTimeout(refreshTimer)
  refreshTimer = window.setTimeout(loadRows, 350)
}

onMounted(() => {
  void loadRows()
  window.addEventListener(REALTIME_EVENT_NAME, handleRealtimeEvent)
})

onBeforeUnmount(() => {
  window.removeEventListener(REALTIME_EVENT_NAME, handleRealtimeEvent)
  if (refreshTimer) window.clearTimeout(refreshTimer)
})
</script>

<template>
  <section class="reply-review">
    <el-card shadow="never" class="reply-review__workspace">
      <header class="reply-review__header">
        <div class="reply-review__heading">
          <span class="reply-review__icon"><MessageSquareReply :size="20" /></span>
          <div>
            <h1>回复审核</h1>
            <p>集中处理监听到的新一级评论，确认 AI 文案后再交给设备执行。</p>
          </div>
        </div>
        <el-tooltip content="刷新" placement="bottom">
          <el-button circle :icon="RefreshCw" :loading="loading" @click="loadRows" />
        </el-tooltip>
      </header>

      <div class="reply-review__body">
        <div class="reply-review__filters">
          <div class="filter-row">
            <el-select v-model="filters.status" clearable placeholder="工单状态" class="filter-status">
              <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
            <el-input v-model="filters.keyword" clearable placeholder="评论作者 / 评论内容 / 回复文案" @keyup.enter="searchRows" />
            <el-button type="primary" :icon="Search" @click="searchRows">查询</el-button>
            <el-button :disabled="!hasFilters" @click="resetFilters">清空</el-button>
          </div>
        </div>

        <div class="reply-review__table">
          <el-table v-loading="loading" :data="rows" border stripe empty-text="暂无新评论回复工单">
            <el-table-column label="发帖账号" min-width="150">
              <template #default="{ row }">
                <div class="account-copy">
                  <strong>{{ row.operator_account_name || row.operator_account_id }}</strong>
                  <el-tag size="small" effect="plain">{{ row.business_platform }}</el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="新一级评论" min-width="280">
              <template #default="{ row }">
                <div class="comment-copy">
                  <strong>@{{ row.source_comment_author || '访客' }}</strong>
                  <p>{{ row.source_comment_content }}</p>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="AI 回复" min-width="300">
              <template #default="{ row }">
                <p v-if="row.final_content || row.generated_content" class="reply-copy">{{ row.final_content || row.generated_content }}</p>
                <span v-else class="text-muted">文案尚未生成</span>
              </template>
            </el-table-column>
            <el-table-column label="处理方式" width="110" align="center">
              <template #default="{ row }"><el-tag effect="plain">{{ replyModeLabel(row.reply_mode) }}</el-tag></template>
            </el-table-column>
            <el-table-column label="状态" width="105" align="center">
              <template #default="{ row }"><el-tag :type="statusMeta(row.status).type">{{ statusMeta(row.status).label }}</el-tag></template>
            </el-table-column>
            <el-table-column label="发现时间" width="165" align="center">
              <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="220" align="center" fixed="right">
              <template #default="{ row }">
                <el-button text type="primary" :icon="Eye" @click="openJob(row)">{{ row.status === 'pending_review' ? '审核' : '查看' }}</el-button>
                <el-button v-if="row.status === 'pending_review' && auth.can('operations.review')" text type="primary" :icon="RotateCcw" @click="regenerate(row)">重生成</el-button>
                <el-button v-if="['failed', 'blocked'].includes(row.status) && auth.can('operations.retry')" text type="danger" :icon="RefreshCw" @click="retry(row)">重试</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="reply-review__pagination">
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
        </div>
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" title="新评论回复" width="min(92vw, 760px)" destroy-on-close :close-on-click-modal="false">
      <div v-if="activeJob" class="review-dialog">
        <div class="review-dialog__meta">
          <div><small>发帖账号</small><strong>{{ activeJob.operator_account_name }}</strong></div>
          <div><small>处理方式</small><strong>{{ replyModeLabel(activeJob.reply_mode) }}</strong></div>
          <div><small>当前状态</small><el-tag :type="statusMeta(activeJob.status).type">{{ statusMeta(activeJob.status).label }}</el-tag></div>
        </div>
        <section class="review-block review-block--comment">
          <header><span>新一级评论</span><strong>@{{ activeJob.source_comment_author || '访客' }}</strong></header>
          <p>{{ activeJob.source_comment_content }}</p>
        </section>
        <section class="review-block">
          <header><span>{{ canApprove ? '确认回复文案' : '回复文案' }}</span><small>{{ editedContent.length }} 字</small></header>
          <el-input
            v-model="editedContent"
            type="textarea"
            :rows="5"
            maxlength="2000"
            :readonly="!canApprove"
            placeholder="AI 文案生成后可在这里修改"
          />
        </section>
        <section v-if="activeJob.generated_translation" class="review-block review-block--translation">
          <header><span>中文意思</span><small>仅供运营审核，不会下发给脚本</small></header>
          <p>{{ activeJob.generated_translation }}</p>
        </section>
        <el-alert v-if="activeJob.error_message || activeJob.generation_error" :title="String(activeJob.error_message || activeJob.generation_error)" type="error" :closable="false" show-icon />
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false">关闭</el-button>
        <el-button v-if="canApprove" :icon="SkipForward" :loading="actionLoading" @click="ignoreActive">忽略</el-button>
        <el-button v-if="canApprove" :icon="RotateCcw" :loading="actionLoading" @click="regenerateActive">重新生成</el-button>
        <el-button v-if="canApprove" type="primary" :icon="Check" :loading="actionLoading" @click="approveActive">确认下发</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.reply-review__workspace { border-color: #d9e2ec; border-radius: 8px; }
.reply-review__workspace :deep(.el-card__body) { padding: 0; }
.reply-review__header,
.reply-review__heading,
.filter-row,
.reply-review__pagination,
.review-dialog__meta,
.review-block header { display: flex; align-items: center; }
.reply-review__header { justify-content: space-between; gap: 16px; padding: 13px 16px; border-bottom: 1px solid #e6edf3; }
.reply-review__heading { gap: 10px; }
.reply-review__heading h1 { color: #1f2933; font-size: 18px; font-weight: 700; }
.reply-review__heading p { margin-top: 3px; color: #66788a; font-size: 12px; }
.reply-review__icon { display: inline-flex; width: 34px; height: 34px; align-items: center; justify-content: center; border-radius: 7px; color: #1f668f; background: #eef8ff; }
.reply-review__body { padding: 14px 16px 16px; background: #f8fafc; }
.reply-review__filters,
.reply-review__table { border: 1px solid #dbe4ed; border-radius: 6px; background: #fff; }
.reply-review__filters { margin-bottom: 12px; padding: 12px; }
.filter-row { gap: 10px; }
.filter-row .el-input { max-width: 420px; }
.filter-status { width: 160px; }
.reply-review__table { overflow: hidden; }
.reply-review__pagination { justify-content: flex-end; padding: 12px; border-top: 1px solid #e5ebf1; }
.account-copy strong { display: block; margin-bottom: 6px; color: #243548; }
.comment-copy strong { display: block; margin-bottom: 5px; color: #2f6f97; font-size: 12px; }
.comment-copy p,
.reply-copy { display: -webkit-box; overflow: hidden; margin: 0; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-height: 1.55; }
.reply-copy { color: #34495e; }
.text-muted { color: #94a3b8; font-size: 12px; }
.review-dialog { display: grid; gap: 14px; }
.review-dialog__meta { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.review-dialog__meta div { min-height: 62px; padding: 10px 12px; border: 1px solid #e0e7ef; border-radius: 6px; background: #f8fafc; }
.review-dialog__meta small,
.review-dialog__meta strong { display: block; }
.review-dialog__meta small { margin-bottom: 5px; color: #7b8b9b; }
.review-block { padding: 13px; border: 1px solid #dbe4ed; border-radius: 6px; }
.review-block--comment { border-left: 3px solid #4e88ad; background: #f8fbfd; }
.review-block--translation { border-left: 3px solid #d49b36; background: #fffbf2; }
.review-block header { justify-content: space-between; gap: 12px; margin-bottom: 9px; color: #334155; }
.review-block header span { font-weight: 700; }
.review-block header small { color: #8a98a8; }
.review-block p { margin: 0; color: #405266; line-height: 1.7; white-space: pre-wrap; }
@media (max-width: 720px) {
  .filter-row { align-items: stretch; flex-direction: column; }
  .filter-row .el-input,
  .filter-status { width: 100%; max-width: none; }
  .review-dialog__meta { grid-template-columns: 1fr; }
}
</style>
