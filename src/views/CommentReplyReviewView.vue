<script setup lang="ts">
import {
  Check,
  Eye,
  ListChecks,
  MessageSquareReply,
  RefreshCw,
  RotateCcw,
  Search,
  SkipForward,
  Trash2,
} from 'lucide-vue-next'
import { ElMessageBox, ElNotification } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import {
  approveCommentReply,
  batchApproveCommentReplies,
  batchDeleteCommentReplies,
  batchIgnoreCommentReplies,
  batchRetryCommentReplies,
  getCommentReply,
  ignoreCommentReply,
  listCommentReplies,
  regenerateCommentReply,
  retryCommentReply,
} from '@/api/commentReplies'
import RemoteSelect from '@/components/RemoteSelect.vue'
import ReplyJobAccount from '@/components/ReplyJobAccount.vue'
import ReplyJobPost from '@/components/ReplyJobPost.vue'
import TaskDetailDrawer from '@/components/TaskDetailDrawer.vue'
import { usePersistentFilters } from '@/composables/usePersistentFilters'
import { REALTIME_EVENT_NAME, type RealtimeEventPayload } from '@/composables/useRealtimeEvents'
import {
  buildCommentReplyQuery,
  createDefaultCommentReplyFilters,
  hasActiveCommentReplyFilters,
} from '@/config/commentReplyFilters'
import { businessPlatformLabel } from '@/config/options'
import { useScopedBusinessPlatformOptions } from '@/composables/useScopedBusinessPlatformOptions'
import { useAuthStore } from '@/stores/auth'
import type { AnyRecord } from '@/types/api'
import type { RemoteSelectConfig } from '@/types/crud'
import { formatDate } from '@/utils/format'
import { notifyError } from '@/utils/notify'

const auth = useAuthStore()
const route = useRoute()
const availableBusinessPlatformOptions = useScopedBusinessPlatformOptions()
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
const batchLoading = ref(false)
const rows = ref<AnyRecord[]>([])
const selectedRows = ref<AnyRecord[]>([])
const tableRef = ref<{ clearSelection: () => void } | null>(null)
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const dialogVisible = ref(false)
const activeJob = ref<AnyRecord | null>(null)
const editedContent = ref('')
const taskDetailVisible = ref(false)
const taskDetailId = ref<string | null>(null)
const { filters, resetFilters: resetCachedFilters } = usePersistentFilters(
  'list:comment-replies:v2',
  createDefaultCommentReplyFilters(),
)
let refreshTimer: number | undefined

const hasFilters = computed(() => hasActiveCommentReplyFilters(filters))
const canApprove = computed(() => activeJob.value?.status === 'pending_review' && auth.can('operations.review'))
const canManageReviews = computed(() => auth.can('operations.review'))
const canRetryReviews = computed(() => auth.can('operations.retry'))
const canBatchOperate = computed(() => canManageReviews.value || canRetryReviews.value)
const batchActionsDisabled = computed(() => batchLoading.value || selectedRows.value.length === 0)
const replyModeOptions = [
  { label: '自动回复', value: 'automatic' },
  { label: '人工审核', value: 'review' },
]
const accountSelectConfig = computed<RemoteSelectConfig>(() => ({
  endpoint: '/api/accounts',
  labelKeys: ['login_username', 'username', 'display_name', 'platform_account_id'],
  valueKey: 'id',
  detailPath: (value: string) => `/api/accounts/${encodeURIComponent(value)}`,
  secondaryFormatter: (option: AnyRecord) => [
    businessPlatformLabel(option.business_platform),
    option.country,
    `ID ${option.id}`,
  ].filter(Boolean).join(' · '),
  searchParam: 'keyword',
  pageSize: 50,
  params: {
    business_platform: filters.businessPlatform || undefined,
    tag_id: filters.accountTagId || undefined,
  },
}))
const accountTagSelectConfig: RemoteSelectConfig = {
  endpoint: '/api/account-tags',
  labelKey: 'name',
  valueKey: 'id',
  detailPath: (value: string) => `/api/account-tags/${encodeURIComponent(value)}`,
  searchParam: 'keyword',
  pageSize: 50,
}

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
      ...buildCommentReplyQuery(filters, page.value, pageSize.value),
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
  filters.status = ''
  searchRows()
}

function handleSelectionChange(selection: AnyRecord[]) {
  selectedRows.value = selection
}

function clearBatchSelection() {
  tableRef.value?.clearSelection()
  selectedRows.value = []
}

type BatchAction = 'approve' | 'ignore' | 'delete' | 'retry'

async function runBatchAction(action: BatchAction) {
  if (batchActionsDisabled.value) return
  if (action === 'retry' ? !canRetryReviews.value : !canManageReviews.value) return
  const count = selectedRows.value.length
  const jobIds = selectedRows.value.map((row) => String(row.id))
  const settings = {
    retry: {
      title: '批量重试',
      message: `确认重试已选择的 ${count} 条工单？仅处理失败或阻塞的工单，其他状态将跳过。已有回复文案的工单将重新下发，无文案的工单将重新生成。`,
      confirmButtonText: '确认重试',
      request: batchRetryCommentReplies,
      successLabel: '重试',
      type: 'warning' as const,
    },
    approve: {
      title: '批量审核通过',
      message: `确认审核通过已选择的 ${count} 条工单？系统会使用每条工单现有的回复文案下发任务。`,
      confirmButtonText: '确认审核',
      request: batchApproveCommentReplies,
      successLabel: '审核',
      type: 'warning' as const,
    },
    ignore: {
      title: '批量忽略',
      message: `确认忽略已选择的 ${count} 条工单？符合条件的评论将不再下发回复任务。`,
      confirmButtonText: '确认忽略',
      request: batchIgnoreCommentReplies,
      successLabel: '忽略',
      type: 'warning' as const,
    },
    delete: {
      title: '批量删除记录',
      message: `确认删除已选择的 ${count} 条记录？仅已结束工单会从列表隐藏，底层执行任务、审计和评论去重依据仍会保留。`,
      confirmButtonText: '确认删除',
      request: batchDeleteCommentReplies,
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
    const data = await settings.request(jobIds)
    const message = `已处理 ${data.processed_count} 条，跳过 ${data.skipped_count} 条，失败 ${data.failed_count} 条`
    if (data.skipped_count || data.failed_count) {
      ElNotification.warning({ title: `批量${settings.successLabel}已完成`, message })
    } else {
      ElNotification.success({ title: `批量${settings.successLabel}成功`, message })
    }
    clearBatchSelection()
    await loadRows()
  } catch (err) {
    notifyError(err, `批量${settings.successLabel}失败`, '请刷新后重新选择工单')
  } finally {
    batchLoading.value = false
  }
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

function openTaskDetail(row: AnyRecord | null) {
  if (!row) return
  const taskId = String(row.task_run_id || '').trim()
  if (!taskId) return
  dialogVisible.value = false
  taskDetailId.value = taskId
  taskDetailVisible.value = true
}

function canViewTaskDetail(row: AnyRecord | null) {
  if (!row?.task_run_id || !auth.can('tasks.view')) return false
  return auth.isSuperAdmin || String(row.reviewed_by || '') === String(auth.user?.id || '')
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

function applyReviewShortcut() {
  if (route.query.status !== 'pending_review') return false
  Object.assign(filters, createDefaultCommentReplyFilters(), { status: 'pending_review' })
  page.value = 1
  return true
}

watch(() => route.query.status, () => {
  if (applyReviewShortcut()) void loadRows()
})

onMounted(() => {
  applyReviewShortcut()
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
        <div class="reply-review__tools">
          <el-tooltip content="刷新" placement="bottom">
            <el-button circle :icon="RefreshCw" :loading="loading" @click="loadRows" />
          </el-tooltip>
        </div>
      </header>

      <div class="reply-review__body">
        <div class="reply-review__filters">
          <div class="filter-title">
            <Search :size="16" />
            <span>筛选条件</span>
          </div>
          <el-form inline label-position="right" label-suffix=":" class="compact-filter-form">
            <div class="filter-grid">
              <el-form-item label="业务平台">
                <el-select v-model="filters.businessPlatform" clearable placeholder="全部">
                  <el-option
                    v-for="item in availableBusinessPlatformOptions"
                    :key="String(item.value)"
                    :label="item.label"
                    :value="String(item.value)"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="监听账号">
                <RemoteSelect v-model="filters.accountId" :config="accountSelectConfig" compact placeholder="全部" />
              </el-form-item>
              <el-form-item label="账号标签">
                <RemoteSelect v-model="filters.accountTagId" :config="accountTagSelectConfig" compact placeholder="全部" />
              </el-form-item>
              <el-form-item label="回复模式">
                <el-select v-model="filters.replyMode" clearable placeholder="全部">
                  <el-option v-for="item in replyModeOptions" :key="item.value" :label="item.label" :value="item.value" />
                </el-select>
              </el-form-item>
              <el-form-item label="工单状态">
                <el-select v-model="filters.status" clearable placeholder="全部">
                  <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
                </el-select>
              </el-form-item>
              <el-form-item label="工单 ID">
                <el-input v-model="filters.jobId" clearable placeholder="输入完整工单 ID" @keyup.enter="searchRows" />
              </el-form-item>
              <el-form-item label="发现时间" class="filter-grid__item--wide">
                <el-date-picker
                  v-model="filters.createdRange"
                  type="datetimerange"
                  value-format="YYYY-MM-DDTHH:mm:ssZ"
                  range-separator="至"
                  start-placeholder="开始时间"
                  end-placeholder="结束时间"
                />
              </el-form-item>
              <el-form-item label="关键词">
                <el-input v-model="filters.keyword" clearable placeholder="评论作者 / 内容 / 回复文案" @keyup.enter="searchRows" />
              </el-form-item>
            </div>
            <div class="filter-actions">
              <el-button :icon="RotateCcw" :disabled="!hasFilters" @click="resetFilters">清空</el-button>
              <el-button type="primary" :icon="Search" @click="searchRows">查询</el-button>
            </div>
          </el-form>
        </div>

        <div class="reply-review__table">
          <div v-if="canBatchOperate" class="reply-review__batch-bar">
            <span>已选择 <strong>{{ selectedRows.length }}</strong> 条工单</span>
            <div class="reply-review__batch-actions">
              <el-button v-if="canManageReviews" :icon="Check" :loading="batchLoading" :disabled="batchActionsDisabled" @click="runBatchAction('approve')">
                批量审核通过
              </el-button>
              <el-button v-if="canRetryReviews" :icon="RefreshCw" :loading="batchLoading" :disabled="batchActionsDisabled" @click="runBatchAction('retry')">
                批量重试
              </el-button>
              <el-button v-if="canManageReviews" :icon="SkipForward" :loading="batchLoading" :disabled="batchActionsDisabled" @click="runBatchAction('ignore')">
                批量忽略
              </el-button>
              <el-button v-if="canManageReviews" type="danger" plain :icon="Trash2" :loading="batchLoading" :disabled="batchActionsDisabled" @click="runBatchAction('delete')">
                批量删除记录
              </el-button>
            </div>
          </div>
          <el-table
            ref="tableRef"
            v-loading="loading"
            :data="rows"
            row-key="id"
            border
            stripe
            empty-text="暂无新评论回复工单"
            @selection-change="handleSelectionChange"
          >
            <el-table-column v-if="canBatchOperate" type="selection" width="46" fixed="left" reserve-selection />
            <el-table-column prop="id" label="工单 ID" width="95" show-overflow-tooltip />
            <el-table-column label="发帖账号" min-width="150">
              <template #default="{ row }">
                <div class="account-copy">
                  <ReplyJobAccount :job="row" />
                  <el-tag size="small" effect="plain">{{ businessPlatformLabel(row.business_platform) }}</el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="原帖" min-width="240">
              <template #default="{ row }"><ReplyJobPost :job="row" /></template>
            </el-table-column>
            <el-table-column label="新一级评论" min-width="240">
              <template #default="{ row }">
                <div class="comment-copy">
                  <strong>@{{ row.source_comment_author || '访客' }}</strong>
                  <p>{{ row.source_comment_content }}</p>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="AI 回复" min-width="240">
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
            <el-table-column label="操作" width="250" align="center" fixed="right">
              <template #default="{ row }">
                <div class="reply-review__row-actions">
                <el-button text type="primary" :icon="Eye" @click="openJob(row)">{{ row.status === 'pending_review' ? '审核' : '查看' }}</el-button>
                <el-button v-if="canViewTaskDetail(row)" text :icon="ListChecks" @click="openTaskDetail(row)">执行详情</el-button>
                <el-button v-if="row.status === 'pending_review' && auth.can('operations.review')" text type="primary" :icon="RotateCcw" @click="regenerate(row)">重生成</el-button>
                <el-button v-if="['failed', 'blocked'].includes(row.status) && auth.can('operations.retry')" text type="danger" :icon="RefreshCw" @click="retry(row)">重试</el-button>
                </div>
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
          <div><small>发帖账号</small><ReplyJobAccount :job="activeJob" /></div>
          <div><small>处理方式</small><strong>{{ replyModeLabel(activeJob.reply_mode) }}</strong></div>
          <div><small>当前状态</small><el-tag :type="statusMeta(activeJob.status).type">{{ statusMeta(activeJob.status).label }}</el-tag></div>
        </div>
        <section class="review-block">
          <header><span>原帖</span></header>
          <ReplyJobPost :job="activeJob" />
        </section>
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
        <el-button v-if="canViewTaskDetail(activeJob)" :icon="ListChecks" @click="openTaskDetail(activeJob)">执行详情</el-button>
        <el-button v-if="canApprove" :icon="SkipForward" :loading="actionLoading" @click="ignoreActive">忽略</el-button>
        <el-button v-if="canApprove" :icon="RotateCcw" :loading="actionLoading" @click="regenerateActive">重新生成</el-button>
        <el-button v-if="canApprove" type="primary" :icon="Check" :loading="actionLoading" @click="approveActive">确认下发</el-button>
      </template>
    </el-dialog>

    <TaskDetailDrawer v-model="taskDetailVisible" :task-id="taskDetailId" />
  </section>
</template>

<style scoped>
.reply-review__row-actions { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 4px; }
.reply-review__row-actions :deep(.el-button) { margin: 0; padding: 8px 6px; }
.reply-review__tools { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.reply-review__workspace { border-color: var(--app-border, #d9e2ec); border-radius: 8px; }
.reply-review__workspace :deep(.el-card__body) { padding: 0; }
.reply-review__header,
.reply-review__heading,
.filter-title,
.filter-actions,
.reply-review__pagination,
.review-dialog__meta,
.review-block header { display: flex; align-items: center; }
.reply-review__header { justify-content: space-between; gap: 16px; padding: 13px 16px; border-bottom: 1px solid var(--app-border, #e6edf3); }
.reply-review__heading { gap: 10px; }
.reply-review__heading h1 { color: var(--app-text, #1f2933); font-size: 18px; font-weight: 700; }
.reply-review__heading p { margin-top: 3px; color: var(--app-text-muted, #66788a); font-size: 12px; }
.reply-review__icon { display: inline-flex; width: 34px; height: 34px; align-items: center; justify-content: center; border-radius: 7px; color: var(--app-blue, #1f668f); background: var(--app-surface-muted, #eef8ff); }
.reply-review__body { padding: 14px 16px 16px; background: var(--app-surface-muted, #f8fafc); }
.reply-review__filters,
.reply-review__table { border: 1px solid var(--app-border, #dbe4ed); border-radius: 6px; background: var(--app-surface, #fff); }
.reply-review__filters { margin-bottom: 12px; padding: 12px; }
.filter-title { gap: 6px; margin-bottom: 10px; color: var(--app-text, #26384a); font-size: 13px; font-weight: 700; }
.filter-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px 14px; }
.filter-grid :deep(.el-form-item) { margin-right: 0; margin-bottom: 0; }
.filter-grid :deep(.el-form-item__label) {
  min-width: 72px;
  justify-content: flex-end;
  color: var(--app-text, #52606d);
  font-size: 12px;
  font-weight: 600;
  text-align: right;
}
.filter-grid :deep(.el-select),
.filter-grid :deep(.el-input),
.filter-grid :deep(.el-date-editor) { width: 100%; }
.filter-grid :deep(.filter-grid__item--wide) { grid-column: span 2; }
.filter-actions { gap: 8px; margin-top: 12px; }
.reply-review__table { overflow: hidden; }
.reply-review__batch-bar,
.reply-review__batch-actions { display: flex; align-items: center; }
.reply-review__batch-bar { min-height: 54px; flex-wrap: wrap; justify-content: space-between; gap: 12px; padding: 9px 12px; border-bottom: 1px solid var(--app-border, #e5ebf1); background: var(--app-surface-muted, #f8fafc); }
.reply-review__batch-bar > span { color: var(--app-text-muted, #66788a); font-size: 13px; }
.reply-review__batch-bar strong { color: var(--app-blue, #1f668f); }
.reply-review__batch-actions { flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.reply-review__batch-actions :deep(.el-button + .el-button) { margin-left: 0; }
.reply-review__pagination { justify-content: flex-end; padding: 12px; border-top: 1px solid var(--app-border, #e5ebf1); }
.account-copy { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
.comment-copy strong { display: block; margin-bottom: 5px; color: var(--app-blue, #2f6f97); font-size: 12px; }
.comment-copy p,
.reply-copy { display: -webkit-box; overflow: hidden; margin: 0; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-height: 1.55; }
.reply-copy { color: var(--app-text, #34495e); }
.text-muted { color: var(--app-text-muted, #94a3b8); font-size: 12px; }
.review-dialog { display: grid; gap: 14px; }
.review-dialog__meta { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: stretch; gap: 10px; }
.review-dialog__meta div { min-height: 62px; padding: 10px 12px; border: 1px solid var(--app-border, #e0e7ef); border-radius: 6px; background: var(--app-surface-muted, #f8fafc); }
.review-dialog__meta small,
.review-dialog__meta strong { display: block; }
.review-dialog__meta small { margin-bottom: 5px; color: var(--app-text-muted, #7b8b9b); }
.review-block { padding: 13px; border: 1px solid var(--app-border, #dbe4ed); border-radius: 6px; }
.review-block--comment { border-left: 3px solid var(--app-text-muted, #4e88ad); background: var(--app-surface-muted, #f8fbfd); }
.review-block--translation { border-left: 3px solid var(--app-amber, #d49b36); background: var(--app-surface-muted, #fffbf2); }
.review-block header { justify-content: space-between; gap: 12px; margin-bottom: 9px; color: var(--app-text, #334155); }
.review-block header span { font-weight: 700; }
.review-block header small { color: var(--app-text-muted, #8a98a8); }
.review-block p { margin: 0; color: var(--app-text, #405266); line-height: 1.7; white-space: pre-wrap; }
@media (max-width: 768px) {
  .filter-grid { grid-template-columns: 1fr; }
  .filter-grid :deep(.filter-grid__item--wide) { grid-column: span 1; }
  .reply-review__batch-actions { width: 100%; justify-content: flex-start; }
  .review-dialog__meta { grid-template-columns: 1fr; }
}
</style>
