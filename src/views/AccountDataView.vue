<script setup lang="ts">
import {
  Activity,
  AlertTriangle,
  CircleOff,
  Clock,
  Eye,
  Play,
  RefreshCw,
  Search,
  Users,
} from 'lucide-vue-next'
import { ElMessageBox, ElNotification } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import { getAllPages, http } from '@/api/http'
import { getEnabledAiProviderOptions, resolveEnabledAiProvider, type EnabledAiProviderOption } from '@/api/interactionAi'
import { getSystemDefaults } from '@/api/systemSettings'
import AccountMetricsPanel from '@/components/AccountMetricsPanel.vue'
import AccountPublishedContentPanel from '@/components/AccountPublishedContentPanel.vue'
import AccountTreeSelect from '@/components/AccountTreeSelect.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { REALTIME_EVENT_NAME, type RealtimeEventPayload } from '@/composables/useRealtimeEvents'
import { businessPlatformOptions, loginStatusOptions } from '@/config/options'
import type { AnyRecord } from '@/types/api'
import { formatDate } from '@/utils/format'
import { notifyError } from '@/utils/notify'

interface AccountDataPage {
  items: AnyRecord[]
  total: number
  page: number
  page_size: number
  summary: {
    total_accounts: number
    monitoring_accounts: number
    paused_accounts: number
    abnormal_accounts: number
    unmonitored_accounts: number
  }
}

const monitorStateOptions = [
  { label: '未开启', value: 'not_configured' },
  { label: '监听中', value: 'monitoring' },
  { label: '已关闭', value: 'paused' },
  { label: '监听异常', value: 'abnormal' },
]

const loading = ref(false)
const submitting = ref(false)
const disablingAccountId = ref('')
const rows = ref<AnyRecord[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const groups = ref<AnyRecord[]>([])
const aiProviderOptions = ref<EnabledAiProviderOption[]>([])
const summary = reactive({
  total_accounts: 0,
  monitoring_accounts: 0,
  paused_accounts: 0,
  abnormal_accounts: 0,
  unmonitored_accounts: 0,
})
const filters = reactive({
  business_platform: '',
  login_status: '',
  group_id: '',
  monitor_state: '',
  keyword: '',
})
const monitorVisible = ref(false)
const monitorAccountLocked = ref(false)
const monitorTargetAccount = ref<AnyRecord | null>(null)
const detailVisible = ref(false)
const detailTab = ref('overview')
const detailAccount = ref<AnyRecord | null>(null)
const monitorForm = reactive({
  business_platform: 'threads',
  account_id: '',
  profile_url: '',
  monitor_mode: 'system',
  interval_minutes: 60,
  comment_reply_mode: 'disabled',
  ai_provider: '',
  ai_language: 'auto',
  ai_tone: 'natural',
  ai_max_length: 120,
})
let realtimeRefreshTimer: number | undefined
let accountProfileRequest = 0

const hasFilters = computed(() => Object.values(filters).some(Boolean))
const monitorAccountFilters = computed(() => ({
  business_platform: monitorForm.business_platform,
}))
const monitorDialogTitle = computed(() => {
  if (!monitorAccountLocked.value) return '开启账号监听'
  return monitorTargetAccount.value?.monitor_setting_id ? '配置账号监听' : '开启账号监听'
})
const monitorSubmitLabel = computed(() => (
  monitorTargetAccount.value?.monitor_state === 'paused'
    ? '重新开启'
    : monitorTargetAccount.value?.monitor_setting_id ? '保存配置' : '确认开启'
))

function optionLabel(options: Array<{ label: string; value: unknown }>, value: unknown) {
  return options.find((item) => String(item.value) === String(value || ''))?.label || String(value || '-')
}

function formatNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return '--'
  const number = Number(value)
  return Number.isFinite(number) ? new Intl.NumberFormat('zh-CN').format(number) : String(value)
}

function monitorStateLabel(value: unknown) {
  return optionLabel(monitorStateOptions, value)
}

function monitorStateType(value: unknown) {
  if (value === 'monitoring') return 'success'
  if (value === 'abnormal') return 'danger'
  if (value === 'paused') return 'warning'
  return 'info'
}

async function loadGroups() {
  try {
    groups.value = await getAllPages<AnyRecord>('/api/account-groups')
  } catch (err) {
    notifyError(err, '加载失败', '加载账号分组失败')
  }
}

async function loadReplyOptions() {
  try {
    const [defaults, options] = await Promise.all([
      getSystemDefaults(),
      getEnabledAiProviderOptions(),
    ])
    aiProviderOptions.value = options
    monitorForm.ai_provider = resolveEnabledAiProvider(defaults.default_ai_provider, options)
  } catch (err) {
    notifyError(err, '加载失败', '无法加载可用的互动 AI 供应商')
  }
}

async function loadRows() {
  loading.value = true
  try {
    const data = await http.get<AccountDataPage>('/api/accounts/data-overview', {
      ...filters,
      page: page.value,
      page_size: pageSize.value,
    })
    rows.value = data.items
    total.value = data.total
    Object.assign(summary, data.summary)
  } catch (err) {
    notifyError(err, '加载失败', '加载账号数据失败')
  } finally {
    loading.value = false
  }
}

function searchRows() {
  page.value = 1
  loadRows()
}

function resetFilters() {
  Object.assign(filters, {
    business_platform: '',
    login_status: '',
    group_id: '',
    monitor_state: '',
    keyword: '',
  })
  searchRows()
}

function useMonitorFilter(value: string) {
  filters.monitor_state = filters.monitor_state === value ? '' : value
  searchRows()
}

function handleSizeChange(size: number) {
  pageSize.value = size
  page.value = 1
  loadRows()
}

function openMonitor(account?: AnyRecord) {
  monitorAccountLocked.value = Boolean(account)
  monitorTargetAccount.value = account || null
  const aiConfig = (account?.comment_reply_ai_config || {}) as AnyRecord
  Object.assign(monitorForm, {
    business_platform: String(account?.business_platform || 'threads'),
    account_id: String(account?.account_id || ''),
    profile_url: String(account?.profile_url || ''),
    monitor_mode: String(account?.monitor_mode || 'system'),
    interval_minutes: Number(account?.monitor_interval_minutes || 60),
    comment_reply_mode: String(account?.comment_reply_mode || 'disabled'),
    ai_provider: String(aiConfig.provider || monitorForm.ai_provider || ''),
    ai_language: String(aiConfig.language || 'auto'),
    ai_tone: String(aiConfig.tone || 'natural'),
    ai_max_length: Number(aiConfig.max_length || 120),
  })
  monitorVisible.value = true
}

async function saveMonitor() {
  if (!monitorForm.account_id) {
    ElNotification.warning({ title: '请选择账号', message: '请选择需要开启监听的账号' })
    return
  }
  if (!monitorForm.profile_url.trim()) {
    ElNotification.warning({ title: '请填写主页链接', message: '主页链接用于服务端发现该账号的全部内容' })
    return
  }
  if (monitorForm.comment_reply_mode !== 'disabled' && !monitorForm.ai_provider) {
    ElNotification.warning({ title: '暂无可用 AI', message: '请先在系统配置中启用至少一个互动 AI 供应商' })
    return
  }
  submitting.value = true
  try {
    const data = await http.post<AnyRecord>('/api/interaction-center/content-monitor/accounts', {
      business_platform: monitorForm.business_platform,
      account_id: monitorForm.account_id,
      profile_url: monitorForm.profile_url.trim(),
      monitor_mode: monitorForm.monitor_mode,
      interval_minutes: monitorForm.monitor_mode === 'custom' ? monitorForm.interval_minutes : null,
      comment_reply_mode: monitorForm.comment_reply_mode,
      comment_reply_ai_config: {
        provider: monitorForm.ai_provider || 'gemini',
        language: monitorForm.ai_language,
        tone: monitorForm.ai_tone,
        max_length: monitorForm.ai_max_length,
      },
    })
    monitorVisible.value = false
    ElNotification.success({
      title: '账号监听已开启',
      message: `首次同步已经启动，执行记录 ID：${String((data.monitor_run as AnyRecord | undefined)?.id || '-')}`,
    })
    await loadRows()
  } catch (err) {
    notifyError(err, '开启失败', '账号监听保存失败')
  } finally {
    submitting.value = false
  }
}

async function disableMonitor(account: AnyRecord) {
  try {
    await ElMessageBox.confirm(
      `关闭后将停止采集“${String(account.account_name || account.login_username || account.account_id)}”的新数据，历史数据和监听配置会保留。`,
      '确认关闭监听',
      {
        confirmButtonText: '确认关闭',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
  } catch {
    return
  }

  disablingAccountId.value = String(account.account_id)
  try {
    await http.post(`/api/interaction-center/content-monitor/accounts/${encodeURIComponent(String(account.account_id))}/disable`)
    monitorVisible.value = false
    ElNotification.success({ title: '监听已关闭', message: '历史数据和监听配置已保留' })
    await loadRows()
  } catch (err) {
    notifyError(err, '关闭失败', '账号监听关闭失败')
  } finally {
    disablingAccountId.value = ''
  }
}

function openDetail(account: AnyRecord) {
  detailAccount.value = account
  detailTab.value = 'overview'
  detailVisible.value = true
}

function accountPanelRecord(account: AnyRecord) {
  return {
    ...account,
    id: account.account_id,
  }
}

function handleRealtimeEvent(event: Event) {
  const payload = (event as CustomEvent<RealtimeEventPayload>).detail
  if (!payload || payload.topic !== 'content_monitor') return
  if (realtimeRefreshTimer) window.clearTimeout(realtimeRefreshTimer)
  realtimeRefreshTimer = window.setTimeout(loadRows, 500)
}

watch(
  () => monitorForm.account_id,
  async (accountId, previousAccountId) => {
    if (monitorAccountLocked.value || !monitorVisible.value || !accountId || accountId === previousAccountId) return
    monitorForm.profile_url = ''
    const requestId = ++accountProfileRequest
    try {
      const account = await http.get<AnyRecord>(`/api/accounts/${encodeURIComponent(accountId)}`)
      if (requestId === accountProfileRequest && monitorForm.account_id === accountId) {
        monitorForm.profile_url = String(account.profile_url || '')
        monitorForm.business_platform = String(account.business_platform || monitorForm.business_platform)
      }
    } catch (err) {
      notifyError(err, '账号读取失败', '无法读取账号主页信息')
    }
  },
)

onMounted(() => {
  loadGroups()
  loadReplyOptions()
  loadRows()
  window.addEventListener(REALTIME_EVENT_NAME, handleRealtimeEvent)
})

onBeforeUnmount(() => {
  window.removeEventListener(REALTIME_EVENT_NAME, handleRealtimeEvent)
  if (realtimeRefreshTimer) window.clearTimeout(realtimeRefreshTimer)
})
</script>

<template>
  <section class="account-data">
    <el-card shadow="never" class="account-data__workspace">
      <div class="account-data__header">
        <div class="account-data__title">
          <div class="account-data__icon"><Activity :size="20" /></div>
          <div>
            <h1>账号数据</h1>
            <p>集中查看账号监听、增长指标和采集记录。</p>
          </div>
        </div>
        <div class="account-data__actions">
          <el-tooltip content="刷新" placement="bottom">
            <el-button circle :icon="RefreshCw" :loading="loading" @click="loadRows" />
          </el-tooltip>
          <el-button type="primary" :icon="Play" @click="openMonitor()">开启账号监听</el-button>
        </div>
      </div>

      <div class="account-data__body">
        <div class="account-data__summary">
          <button type="button" class="summary-item summary-item--total" @click="filters.monitor_state = ''; searchRows()">
            <span class="summary-item__icon"><Users :size="17" /></span>
            <span><small>账号总数</small><strong>{{ formatNumber(summary.total_accounts) }}</strong></span>
          </button>
          <button type="button" class="summary-item summary-item--active" :class="{ 'is-active': filters.monitor_state === 'monitoring' }" @click="useMonitorFilter('monitoring')">
            <span class="summary-item__icon"><Activity :size="17" /></span>
            <span><small>监听中</small><strong>{{ formatNumber(summary.monitoring_accounts) }}</strong></span>
          </button>
          <button type="button" class="summary-item summary-item--paused" :class="{ 'is-active': filters.monitor_state === 'paused' }" @click="useMonitorFilter('paused')">
            <span class="summary-item__icon"><Clock :size="17" /></span>
            <span><small>已关闭</small><strong>{{ formatNumber(summary.paused_accounts) }}</strong></span>
          </button>
          <button type="button" class="summary-item summary-item--danger" :class="{ 'is-active': filters.monitor_state === 'abnormal' }" @click="useMonitorFilter('abnormal')">
            <span class="summary-item__icon"><AlertTriangle :size="17" /></span>
            <span><small>监听异常</small><strong>{{ formatNumber(summary.abnormal_accounts) }}</strong></span>
          </button>
          <button type="button" class="summary-item summary-item--muted" :class="{ 'is-active': filters.monitor_state === 'not_configured' }" @click="useMonitorFilter('not_configured')">
            <span class="summary-item__icon"><CircleOff :size="17" /></span>
            <span><small>未开启</small><strong>{{ formatNumber(summary.unmonitored_accounts) }}</strong></span>
          </button>
        </div>

        <div class="account-data__filters">
          <div class="filter-title"><Search :size="16" />筛选条件</div>
          <div class="filter-grid">
            <el-select v-model="filters.business_platform" clearable placeholder="业务 App">
              <el-option v-for="option in businessPlatformOptions" :key="String(option.value)" :label="option.label" :value="String(option.value)" />
            </el-select>
            <el-select v-model="filters.group_id" clearable filterable placeholder="所属分组">
              <el-option v-for="group in groups" :key="String(group.id)" :label="String(group.name || group.id)" :value="String(group.id)" />
            </el-select>
            <el-select v-model="filters.login_status" clearable placeholder="登录状态">
              <el-option v-for="option in loginStatusOptions" :key="String(option.value)" :label="option.label" :value="String(option.value)" />
            </el-select>
            <el-select v-model="filters.monitor_state" clearable placeholder="监听状态">
              <el-option v-for="option in monitorStateOptions" :key="option.value" :label="option.label" :value="option.value" />
            </el-select>
            <el-input v-model="filters.keyword" clearable placeholder="账号 / 昵称 / 主页链接" @keyup.enter="searchRows" />
          </div>
          <div class="filter-actions">
            <el-button :disabled="!hasFilters" @click="resetFilters">清空</el-button>
            <el-button type="primary" :icon="Search" @click="searchRows">查询</el-button>
          </div>
        </div>

        <div class="account-data__table">
          <el-table v-loading="loading" :data="rows" border stripe empty-text="暂无账号数据">
            <el-table-column label="账号" min-width="230">
              <template #default="{ row }">
                <div class="account-cell">
                  <el-avatar :size="34" :src="row.avatar_url || undefined">{{ String(row.account_name || '-').slice(0, 1) }}</el-avatar>
                  <div class="account-cell__copy">
                    <strong>{{ row.account_name }}</strong>
                    <div class="account-cell__meta">
                      <el-tag size="small" effect="plain">{{ optionLabel(businessPlatformOptions, row.business_platform) }}</el-tag>
                      <StatusBadge :value="row.login_status" />
                    </div>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="所属分组" min-width="120" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.group_name" type="primary" effect="plain">{{ row.group_name }}</el-tag>
                <span v-else class="text-muted">未分组</span>
              </template>
            </el-table-column>
            <el-table-column label="监听状态" min-width="140" align="center">
              <template #default="{ row }">
                <div class="monitor-cell">
                  <el-tag :type="monitorStateType(row.monitor_state)" effect="light">{{ monitorStateLabel(row.monitor_state) }}</el-tag>
                  <small v-if="row.monitor_interval_minutes">每 {{ row.monitor_interval_minutes }} 分钟</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="账号指标" min-width="330">
              <template #default="{ row }">
                <div class="metric-grid">
                  <span><small>粉丝</small><strong>{{ formatNumber(row.followers_count) }}</strong></span>
                  <span><small>关注</small><strong>{{ formatNumber(row.following_count) }}</strong></span>
                  <span><small>帖子</small><strong>{{ formatNumber(row.posts_count) }}</strong></span>
                  <span><small>采集次数</small><strong>{{ formatNumber(row.collection_count) }}</strong></span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="最近采集" min-width="165" align="center">
              <template #default="{ row }">{{ formatDate(row.metrics_captured_at || row.last_success_at) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="164" align="center" fixed="right">
              <template #default="{ row }">
                <div class="table-actions">
                  <el-button text type="primary" :icon="Eye" @click="openDetail(row)">详情</el-button>
                  <el-button text type="primary" :icon="Activity" @click="openMonitor(row)">监听</el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div class="account-data__pagination">
            <el-pagination
              v-model:current-page="page"
              v-model:page-size="pageSize"
              background
              layout="total, sizes, prev, pager, next"
              :page-sizes="[20, 50, 100]"
              :total="total"
              @current-change="loadRows"
              @size-change="handleSizeChange"
            />
          </div>
        </div>
      </div>
    </el-card>

    <el-dialog
      v-model="monitorVisible"
      :title="monitorDialogTitle"
      :width="monitorAccountLocked ? 'min(92vw, 680px)' : 'min(92vw, 860px)'"
      destroy-on-close
      :close-on-click-modal="false"
    >
      <div class="monitor-dialog-grid" :class="{ 'monitor-dialog-grid--locked': monitorAccountLocked }">
        <div v-if="!monitorAccountLocked" class="monitor-dialog-account">
          <div class="dialog-section-title">选择账号</div>
          <AccountTreeSelect
            v-model="monitorForm.account_id"
            :filters="monitorAccountFilters"
            :multiple="false"
            association-only
          />
        </div>
        <el-form label-position="top" class="monitor-dialog-form">
          <div class="dialog-section-title">监听配置</div>
          <div v-if="monitorAccountLocked && monitorTargetAccount" class="monitor-target-account">
            <span class="monitor-target-account__icon"><el-icon><Users /></el-icon></span>
            <span class="monitor-target-account__content">
              <strong>{{ monitorTargetAccount.account_name || monitorTargetAccount.login_username || '-' }}</strong>
              <small>
                {{ optionLabel(businessPlatformOptions, monitorTargetAccount.business_platform) }}
                · {{ monitorTargetAccount.group_name || '未分组' }}
              </small>
            </span>
            <StatusBadge :value="monitorTargetAccount.login_status" />
          </div>
          <el-form-item v-if="!monitorAccountLocked" label="业务 App">
            <el-select v-model="monitorForm.business_platform" disabled class="w-full">
              <el-option v-for="option in businessPlatformOptions" :key="String(option.value)" :label="option.label" :value="String(option.value)" />
            </el-select>
          </el-form-item>
          <el-form-item label="账号主页链接" required>
            <el-input v-model="monitorForm.profile_url" placeholder="例如：https://www.threads.net/@username" />
          </el-form-item>
          <div class="monitor-form-row">
            <el-form-item label="监听规则">
              <el-select v-model="monitorForm.monitor_mode" class="w-full">
                <el-option label="系统默认（每 60 分钟）" value="system" />
                <el-option label="自定义间隔" value="custom" />
              </el-select>
            </el-form-item>
            <el-form-item label="监听间隔（分钟）">
              <el-input-number v-model="monitorForm.interval_minutes" :min="1" :max="1440" :disabled="monitorForm.monitor_mode !== 'custom'" controls-position="right" class="w-full" />
            </el-form-item>
          </div>
          <div class="reply-config">
            <div class="dialog-section-title">新评论回复</div>
            <el-form-item label="回复方式">
              <el-segmented
                v-model="monitorForm.comment_reply_mode"
                :options="[
                  { label: '不自动回复', value: 'disabled' },
                  { label: '自动回复', value: 'automatic' },
                  { label: '审核后回复', value: 'review' },
                ]"
                class="w-full"
              />
            </el-form-item>
            <template v-if="monitorForm.comment_reply_mode !== 'disabled'">
              <el-alert
                :title="monitorForm.comment_reply_mode === 'automatic'
                  ? '仅对监听开启后发现的新一级评论生成文案并自动下发。'
                  : '仅对监听开启后发现的新一级评论生成文案，运营确认或修改后再下发。'"
                type="info"
                :closable="false"
                show-icon
              />
              <div class="monitor-form-row reply-config__fields">
                <el-form-item label="AI 供应商" required>
                  <el-select v-model="monitorForm.ai_provider" class="w-full" placeholder="请选择已启用模型">
                    <el-option
                      v-for="option in aiProviderOptions"
                      :key="option.value"
                      :label="option.label"
                      :value="option.value"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item label="回复语言">
                  <el-select v-model="monitorForm.ai_language" class="w-full">
                    <el-option label="跟随帖子与评论" value="auto" />
                    <el-option label="英文" value="en" />
                    <el-option label="韩文" value="ko" />
                  </el-select>
                </el-form-item>
                <el-form-item label="回复语气">
                  <el-select v-model="monitorForm.ai_tone" class="w-full">
                    <el-option label="自然交流" value="natural" />
                    <el-option label="友好" value="friendly" />
                    <el-option label="好奇" value="curious" />
                    <el-option label="支持认同" value="supportive" />
                    <el-option label="讨论式" value="discussion" />
                  </el-select>
                </el-form-item>
                <el-form-item label="最大长度">
                  <el-input-number v-model="monitorForm.ai_max_length" :min="20" :max="500" controls-position="right" class="w-full" />
                </el-form-item>
              </div>
            </template>
          </div>
          <el-alert title="保存后服务端会立即同步一次，后续按监听规则自动采集账号资料、内容、指标和评论。" type="info" :closable="false" show-icon />
        </el-form>
      </div>
      <template #footer>
        <div class="monitor-dialog-footer">
          <el-button
            v-if="monitorAccountLocked && monitorTargetAccount?.monitor_enabled"
            type="danger"
            plain
            :icon="CircleOff"
            :loading="disablingAccountId === String(monitorTargetAccount.account_id)"
            @click="disableMonitor(monitorTargetAccount)"
          >关闭监听</el-button>
          <div class="monitor-dialog-footer__actions">
            <el-button @click="monitorVisible = false">取消</el-button>
            <el-button type="primary" :icon="Play" :loading="submitting" @click="saveMonitor">{{ monitorSubmitLabel }}</el-button>
          </div>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="detailVisible"
      :title="`账号数据详情：${detailAccount?.account_name || '-'}`"
      width="min(94vw, 1180px)"
      destroy-on-close
    >
      <el-tabs v-if="detailAccount" v-model="detailTab" class="account-detail-tabs">
        <el-tab-pane label="数据概览" name="overview">
          <el-descriptions :column="3" border>
            <el-descriptions-item label="账号">{{ detailAccount.account_name }}</el-descriptions-item>
            <el-descriptions-item label="业务 App">{{ optionLabel(businessPlatformOptions, detailAccount.business_platform) }}</el-descriptions-item>
            <el-descriptions-item label="所属分组">{{ detailAccount.group_name || '未分组' }}</el-descriptions-item>
            <el-descriptions-item label="登录状态"><StatusBadge :value="detailAccount.login_status" /></el-descriptions-item>
            <el-descriptions-item label="监听状态"><el-tag :type="monitorStateType(detailAccount.monitor_state)">{{ monitorStateLabel(detailAccount.monitor_state) }}</el-tag></el-descriptions-item>
            <el-descriptions-item label="监听间隔">{{ detailAccount.monitor_interval_minutes ? `${detailAccount.monitor_interval_minutes} 分钟` : '-' }}</el-descriptions-item>
            <el-descriptions-item label="新评论回复">
              {{ detailAccount.comment_reply_mode === 'automatic' ? '自动回复' : detailAccount.comment_reply_mode === 'review' ? '审核后回复' : '未开启' }}
            </el-descriptions-item>
            <el-descriptions-item label="粉丝">{{ formatNumber(detailAccount.followers_count) }}</el-descriptions-item>
            <el-descriptions-item label="关注">{{ formatNumber(detailAccount.following_count) }}</el-descriptions-item>
            <el-descriptions-item label="帖子">{{ formatNumber(detailAccount.posts_count) }}</el-descriptions-item>
            <el-descriptions-item label="总点赞">{{ formatNumber(detailAccount.total_likes_count) }}</el-descriptions-item>
            <el-descriptions-item label="总回复">{{ formatNumber(detailAccount.total_replies_count) }}</el-descriptions-item>
            <el-descriptions-item label="采集次数">{{ formatNumber(detailAccount.collection_count) }}</el-descriptions-item>
            <el-descriptions-item label="主页链接" :span="3">{{ detailAccount.profile_url || '-' }}</el-descriptions-item>
            <el-descriptions-item label="最近成功" :span="1">{{ formatDate(detailAccount.last_success_at) }}</el-descriptions-item>
            <el-descriptions-item label="下次监听" :span="1">{{ formatDate(detailAccount.next_run_at) }}</el-descriptions-item>
            <el-descriptions-item label="指标采集" :span="1">{{ formatDate(detailAccount.metrics_captured_at) }}</el-descriptions-item>
            <el-descriptions-item v-if="detailAccount.last_error_message" label="最近错误" :span="3">
              <el-alert :title="String(detailAccount.last_error_message)" type="error" :closable="false" show-icon />
            </el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>
        <el-tab-pane label="趋势分析" name="metrics" lazy>
          <AccountMetricsPanel :account="accountPanelRecord(detailAccount)" />
        </el-tab-pane>
        <el-tab-pane label="账号内容" name="contents" lazy>
          <AccountPublishedContentPanel :account="accountPanelRecord(detailAccount)" />
        </el-tab-pane>
      </el-tabs>
      <template #footer><el-button type="primary" @click="detailVisible = false">关闭</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.account-data__workspace {
  --content-inset: 16px;
  border-color: #d9e2ec;
  border-radius: 8px;
}

.account-data__workspace :deep(.el-card__body) { padding: 0; }
.account-data__header,
.account-data__title,
.account-data__actions,
.monitor-dialog-footer,
.monitor-dialog-footer__actions,
.table-actions,
.filter-title,
.filter-actions,
.account-cell,
.account-cell__meta,
.monitor-cell { display: flex; align-items: center; }

.account-data__header {
  justify-content: space-between;
  gap: 16px;
  padding: 13px var(--content-inset);
  border-bottom: 1px solid #e6edf3;
  background: #fff;
}

.monitor-dialog-footer {
  justify-content: space-between;
  gap: 16px;
  width: 100%;
}

.monitor-dialog-footer__actions { gap: 8px; margin-left: auto; }

.table-actions {
  justify-content: center;
  flex-wrap: nowrap;
  gap: 4px;
  white-space: nowrap;
}

.table-actions :deep(.el-button) { margin-left: 0; }

.account-data__title { gap: 10px; }
.account-data__icon {
  display: inline-flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #1f668f;
  background: #eef8ff;
}
.account-data__title h1 { color: #1f2933; font-size: 18px; font-weight: 700; line-height: 1.25; }
.account-data__title p { margin-top: 3px; color: #66788a; font-size: 12px; }
.account-data__actions { gap: 10px; }
.account-data__body { padding: 14px var(--content-inset) 16px; background: #f8fafc; }

.account-data__summary {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}
.summary-item {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  padding: 11px 12px;
  border: 1px solid #dbe4ed;
  border-radius: 6px;
  color: #334155;
  background: #fff;
  text-align: left;
  transition: border-color .15s ease, box-shadow .15s ease;
}
.summary-item:hover,
.summary-item.is-active { border-color: #5c91b4; box-shadow: 0 0 0 2px rgb(47 111 151 / 8%); }
.summary-item__icon {
  display: inline-flex;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: #2f6f97;
  background: #edf6fc;
}
.summary-item--active .summary-item__icon { color: #2f855a; background: #edf9f1; }
.summary-item--paused .summary-item__icon { color: #ad6800; background: #fff7e8; }
.summary-item--danger .summary-item__icon { color: #c2413b; background: #fff1f0; }
.summary-item--muted .summary-item__icon { color: #64748b; background: #f1f5f9; }
.summary-item small,
.summary-item strong { display: block; }
.summary-item small { color: #718096; font-size: 11px; }
.summary-item strong { margin-top: 2px; font-size: 18px; line-height: 1.1; }

.account-data__filters,
.account-data__table {
  border: 1px solid #dbe4ed;
  border-radius: 6px;
  background: #fff;
}
.account-data__filters { margin-bottom: 12px; padding: 12px; }
.filter-title { gap: 6px; margin-bottom: 10px; color: #26384a; font-size: 13px; font-weight: 700; }
.filter-grid { display: grid; grid-template-columns: repeat(4, minmax(130px, 1fr)) minmax(220px, 1.35fr); gap: 10px; }
.filter-actions { gap: 10px; margin-top: 10px; }
.account-data__table { overflow: hidden; }
.account-data__pagination { display: flex; justify-content: flex-end; padding: 12px; border-top: 1px solid #e5ebf1; }

.account-cell { min-width: 0; gap: 10px; }
.account-cell__copy { min-width: 0; }
.account-cell__copy strong { display: block; overflow: hidden; color: #243548; text-overflow: ellipsis; white-space: nowrap; }
.account-cell__meta { gap: 6px; margin-top: 5px; }
.account-cell__meta :deep(.el-tag) { height: 20px; padding: 0 6px; font-size: 10px; }
.monitor-cell { flex-direction: column; gap: 4px; }
.monitor-cell small { color: #8190a0; font-size: 10px; }
.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
.metric-grid span { min-width: 0; padding: 5px 7px; border-radius: 4px; background: #f6f9fc; text-align: center; }
.metric-grid small,
.metric-grid strong { display: block; }
.metric-grid small { color: #7b8b9b; font-size: 10px; }
.metric-grid strong { margin-top: 2px; overflow: hidden; color: #26384a; font-size: 13px; text-overflow: ellipsis; }
.text-muted { color: #94a3b8; font-size: 12px; }

.monitor-dialog-grid { display: grid; grid-template-columns: minmax(280px, .85fr) minmax(0, 1.15fr); gap: 14px; }
.monitor-dialog-grid--locked { grid-template-columns: minmax(0, 1fr); }
.monitor-dialog-account,
.monitor-dialog-form { min-width: 0; padding: 12px; border: 1px solid #dbe4ed; border-radius: 6px; background: #f8fafc; }
.monitor-dialog-account { max-height: 510px; overflow: auto; }
.dialog-section-title { margin-bottom: 12px; color: #26384a; font-size: 14px; font-weight: 700; }
.monitor-target-account { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; padding: 10px 12px; border: 1px solid #d6e3ef; border-radius: 6px; background: #fff; }
.monitor-target-account__icon { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; flex: 0 0 32px; border-radius: 6px; color: #23699a; background: #eaf4fb; }
.monitor-target-account__content { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 2px; }
.monitor-target-account__content strong { overflow: hidden; color: #203346; font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
.monitor-target-account__content small { overflow: hidden; color: #718096; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.monitor-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.reply-config { margin: 2px 0 14px; padding-top: 12px; border-top: 1px solid #dbe4ed; }
.reply-config__fields { margin-top: 12px; }
.reply-config :deep(.el-segmented) { min-height: 34px; }
.account-detail-tabs :deep(.el-tabs__header) { margin-bottom: 14px; }

@media (max-width: 1100px) {
  .account-data__summary { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .filter-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 720px) {
  .account-data__header { align-items: flex-start; flex-direction: column; }
  .account-data__actions { width: 100%; justify-content: flex-end; }
  .account-data__summary,
  .filter-grid,
  .monitor-dialog-grid,
  .monitor-form-row { grid-template-columns: 1fr; }
  .account-data__body { padding: 12px; }
}
</style>
