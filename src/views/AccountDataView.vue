<script setup lang="ts">
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CircleOff,
  Clock,
  ExternalLink,
  GitCompareArrows,
  Play,
  RefreshCw,
  Search,
  Minus,
  Users,
} from 'lucide-vue-next'
import { ElMessageBox, ElNotification } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import { getAllPages, http, resolveBackendUrl } from '@/api/http'
import { getEnabledAiProviderOptions, resolveEnabledAiProvider, type EnabledAiProviderOption } from '@/api/interactionAi'
import { getSystemDefaults } from '@/api/systemSettings'
import AccountPublishedContentPanel from '@/components/AccountPublishedContentPanel.vue'
import AccountTreeSelect from '@/components/AccountTreeSelect.vue'
import BenchmarkTrackerDetailPanel from '@/components/BenchmarkTrackerDetailPanel.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { usePersistentFilters } from '@/composables/usePersistentFilters'
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
const disablingBenchmarkAccountId = ref('')
const rows = ref<AnyRecord[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const slotGroups = ref<AnyRecord[]>([])
const aiProviderOptions = ref<EnabledAiProviderOption[]>([])
const summary = reactive({
  total_accounts: 0,
  monitoring_accounts: 0,
  paused_accounts: 0,
  abnormal_accounts: 0,
  unmonitored_accounts: 0,
})
const { filters, resetFilters: resetCachedFilters } = usePersistentFilters(
  'list:account-data',
  {
    business_platform: '',
    login_status: '',
    slot_group_id: '',
    monitor_state: '',
    keyword: '',
  },
)
const monitorVisible = ref(false)
const monitorFeature = ref<'account_data' | 'benchmark'>('account_data')
const monitorAccountLocked = ref(false)
const monitorTargetAccount = ref<AnyRecord | null>(null)
const detailTab = ref('overview')
const selectedAccount = ref<AnyRecord | null>(null)
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
const benchmarkForm = reactive({
  source_profile_url: '',
  monitor_mode: 'system',
  interval_minutes: 60,
})
let realtimeRefreshTimer: number | undefined
let accountProfileRequest = 0

const hasFilters = computed(() => Object.values(filters).some(Boolean))
const monitorAccountFilters = computed(() => ({
  business_platform: monitorForm.business_platform,
}))
const profileMetricItems = computed(() => {
  const account = selectedAccount.value
  if (!account) return []
  return [
    { label: '粉丝', value: account.followers_count, delta: account.followers_day_delta },
    { label: '关注', value: account.following_count, delta: account.following_day_delta },
    { label: '帖子', value: account.posts_count, delta: account.posts_day_delta },
    { label: '总点赞', value: account.total_likes_count, delta: account.total_likes_day_delta },
    { label: '总回复', value: account.total_replies_count, delta: account.total_replies_day_delta },
    {
      label: '采集次数',
      value: account.collection_count,
      delta: account.collection_day_delta,
      deltaMode: 'daily',
    },
  ]
})
const monitorDialogTitle = computed(() => {
  if (!monitorAccountLocked.value) return '账号监听'
  return `监听设置：${String(monitorTargetAccount.value?.account_name || monitorTargetAccount.value?.login_username || '-')}`
})
const monitorSubmitLabel = computed(() => (
  monitorFeature.value === 'benchmark'
    ? monitorTargetAccount.value?.benchmark_state === 'paused'
      ? '重新开启对标'
      : monitorTargetAccount.value?.benchmark_tracker_id ? '保存对标配置' : '开启对标跟踪'
    : monitorTargetAccount.value?.monitor_state === 'paused'
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

function metricDeltaMeta(value: unknown, mode: unknown = 'previous') {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return { icon: Minus, label: '暂无前日数据', type: 'unknown' }
  }
  if (mode === 'daily') {
    return numberValue > 0
      ? { icon: ArrowUp, label: `当日新增 +${formatNumber(numberValue)}`, type: 'up' }
      : { icon: Minus, label: '当日暂无新增', type: 'flat' }
  }
  if (numberValue > 0) {
    return { icon: ArrowUp, label: `较前一日 +${formatNumber(numberValue)}`, type: 'up' }
  }
  if (numberValue < 0) {
    return { icon: ArrowDown, label: `较前一日 ${formatNumber(numberValue)}`, type: 'down' }
  }
  return { icon: Minus, label: '较前一日 持平', type: 'flat' }
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

async function loadSlotGroups() {
  try {
    slotGroups.value = await getAllPages<AnyRecord>('/api/slot-groups')
  } catch (err) {
    notifyError(err, '加载失败', '加载设备分组失败')
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
    const selectedId = String(selectedAccount.value?.account_id || '')
    selectedAccount.value = data.items.find((item) => String(item.account_id) === selectedId) || data.items[0] || null
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
  resetCachedFilters()
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
  monitorFeature.value = 'account_data'
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
  Object.assign(benchmarkForm, {
    source_profile_url: String(account?.benchmark_source_profile_url || ''),
    monitor_mode: String(account?.benchmark_monitor_mode || 'system'),
    interval_minutes: Number(account?.benchmark_interval_minutes || 60),
  })
  monitorVisible.value = true
}

async function saveBenchmarkTracker() {
  const accountId = String(monitorForm.account_id || '')
  if (!accountId) {
    ElNotification.warning({ title: '请选择账号', message: '请选择需要执行对标跟踪的系统账号' })
    return
  }
  if (!benchmarkForm.source_profile_url.trim()) {
    ElNotification.warning({ title: '请填写对标主页', message: '请输入已授权对标账号的 Threads 主页链接' })
    return
  }
  submitting.value = true
  try {
    await http.post('/api/benchmark-trackers', {
      target_account_id: accountId,
      business_platform: monitorForm.business_platform,
      source_profile_url: benchmarkForm.source_profile_url.trim(),
      monitor_mode: benchmarkForm.monitor_mode,
      interval_minutes: benchmarkForm.monitor_mode === 'custom' ? benchmarkForm.interval_minutes : null,
    })
    monitorVisible.value = false
    ElNotification.success({
      title: '对标跟踪已开启',
      message: '正在同步对标账号资料并建立帖子基线，历史帖子不会补发。',
    })
    await loadRows()
  } catch (err) {
    notifyError(err, '开启失败', '对标跟踪保存失败')
  } finally {
    submitting.value = false
  }
}

async function disableBenchmarkTracker(account: AnyRecord) {
  try {
    await ElMessageBox.confirm(
      `关闭后将停止跟踪“${String(account.benchmark_source_display_name || account.benchmark_source_username || account.benchmark_source_profile_url || '当前对标账号')}”的资料和帖子变化，已有映射记录会保留。`,
      '确认关闭对标跟踪',
      {
        confirmButtonText: '确认关闭',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
  } catch {
    return
  }
  disablingBenchmarkAccountId.value = String(account.account_id)
  try {
    await http.post(`/api/benchmark-trackers/accounts/${encodeURIComponent(String(account.account_id))}/disable`)
    monitorVisible.value = false
    ElNotification.success({ title: '对标跟踪已关闭', message: '已有资料和帖子映射记录已保留' })
    await loadRows()
  } catch (err) {
    notifyError(err, '关闭失败', '对标跟踪关闭失败')
  } finally {
    disablingBenchmarkAccountId.value = ''
  }
}

async function runBenchmarkTrackerNow(account: AnyRecord) {
  submitting.value = true
  try {
    await http.post(`/api/benchmark-trackers/accounts/${encodeURIComponent(String(account.account_id))}/run-now`)
    ElNotification.success({ title: '已加入采集队列', message: '服务端会立即执行一次对标采集' })
  } catch (err) {
    notifyError(err, '执行失败', '无法立即执行对标采集')
  } finally {
    submitting.value = false
  }
}

function submitMonitorForm() {
  if (monitorFeature.value === 'benchmark') {
    void saveBenchmarkTracker()
    return
  }
  void saveMonitor()
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

function selectAccount(account: AnyRecord) {
  if (String(selectedAccount.value?.account_id || '') !== String(account.account_id || '')) {
    detailTab.value = 'overview'
  }
  selectedAccount.value = account
}

function openProfile(account: AnyRecord) {
  const url = String(account.profile_url || '').trim()
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

function replyModeLabel(value: unknown) {
  if (value === 'automatic') return '自动回复'
  if (value === 'review') return '审核后回复'
  return '未开启'
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
  loadSlotGroups()
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
            <el-select v-model="filters.slot_group_id" clearable filterable placeholder="设备分组">
              <el-option v-for="group in slotGroups" :key="String(group.id)" :label="String(group.name || group.id)" :value="String(group.id)" />
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

        <div class="account-data__split">
          <div class="account-directory__column">
            <aside class="account-directory">
            <div class="account-directory__header">
              <div>
                <strong>账号列表</strong>
                <small>选择账号查看完整资料</small>
              </div>
              <el-tag type="info" effect="plain">{{ formatNumber(total) }} 个</el-tag>
            </div>

            <div v-loading="loading" class="account-directory__viewport">
              <el-scrollbar class="account-directory__scroll">
                <div v-if="rows.length" class="account-directory__items">
                  <button
                    v-for="account in rows"
                    :key="String(account.account_id)"
                    type="button"
                    class="account-directory__item"
                    :class="{ 'is-selected': String(selectedAccount?.account_id || '') === String(account.account_id) }"
                    :aria-pressed="String(selectedAccount?.account_id || '') === String(account.account_id)"
                    @click="selectAccount(account)"
                  >
                    <el-avatar
                      :size="42"
                      :src="resolveBackendUrl(account.avatar_url) || undefined"
                      fit="cover"
                      class="account-data__avatar"
                    >
                      {{ String(account.account_name || '-').slice(0, 1) }}
                    </el-avatar>
                    <span class="account-directory__copy">
                      <strong>{{ account.account_name || account.login_username || '-' }}</strong>
                      <small v-if="account.username">@{{ account.username }}</small>
                      <small v-else>{{ account.login_username || '暂无公开用户名' }}</small>
                      <span class="account-directory__tags">
                        <el-tag size="small" effect="plain">{{ optionLabel(businessPlatformOptions, account.business_platform) }}</el-tag>
                        <el-tag size="small" :type="monitorStateType(account.monitor_state)" effect="light">
                          {{ monitorStateLabel(account.monitor_state) }}
                        </el-tag>
                      </span>
                    </span>
                  </button>
                </div>
                <el-empty v-else :image-size="72" description="暂无账号数据" />
              </el-scrollbar>
            </div>

            <div class="account-directory__pagination">
              <span>第 {{ page }} 页</span>
              <el-pagination
                v-model:current-page="page"
                small
                background
                layout="prev, next"
                :page-size="pageSize"
                :total="total"
                @current-change="loadRows"
              />
            </div>
            </aside>
          </div>

          <main class="account-profile">
            <template v-if="selectedAccount">
              <header class="account-profile__header">
                <el-avatar
                  :size="76"
                  :src="resolveBackendUrl(selectedAccount.avatar_url) || undefined"
                  fit="cover"
                  class="account-profile__avatar"
                >
                  {{ String(selectedAccount.account_name || '-').slice(0, 1) }}
                </el-avatar>
                <div class="account-profile__identity">
                  <div class="account-profile__name-row">
                    <h2>{{ selectedAccount.display_name || selectedAccount.account_name || selectedAccount.login_username || '-' }}</h2>
                    <StatusBadge :value="selectedAccount.login_status" />
                  </div>
                  <div class="account-profile__handle">
                    <span v-if="selectedAccount.username">@{{ selectedAccount.username }}</span>
                    <span v-else>暂未采集公开用户名</span>
                    <span>账号 ID {{ selectedAccount.account_id }}</span>
                  </div>
                  <p class="account-profile__biography">
                    {{ selectedAccount.biography || '暂未采集到账号简介' }}
                  </p>
                  <div class="account-profile__tags">
                    <el-tag effect="plain">{{ optionLabel(businessPlatformOptions, selectedAccount.business_platform) }}</el-tag>
                    <el-tag v-if="selectedAccount.country" type="info" effect="plain">{{ selectedAccount.country }}</el-tag>
                    <el-tag v-if="selectedAccount.slot_group_name" type="primary" effect="plain">{{ selectedAccount.slot_group_name }}</el-tag>
                    <el-tag :type="monitorStateType(selectedAccount.monitor_state)" effect="light">
                      数据{{ monitorStateLabel(selectedAccount.monitor_state) }}
                    </el-tag>
                    <el-tag :type="monitorStateType(selectedAccount.benchmark_state)" effect="light">
                      对标{{ monitorStateLabel(selectedAccount.benchmark_state) }}
                    </el-tag>
                  </div>
                </div>
                <div class="account-profile__actions">
                  <el-button
                    v-if="selectedAccount.profile_url"
                    :icon="ExternalLink"
                    @click="openProfile(selectedAccount)"
                  >打开主页</el-button>
                  <el-button type="primary" :icon="Activity" @click="openMonitor(selectedAccount)">监听设置</el-button>
                </div>
              </header>

              <div class="account-profile__metrics">
                <div v-for="metric in profileMetricItems" :key="metric.label">
                  <small>{{ metric.label }}</small>
                  <strong>{{ formatNumber(metric.value) }}</strong>
                  <span
                    class="account-profile__delta"
                    :class="'is-' + metricDeltaMeta(metric.delta, metric.deltaMode).type"
                  >
                    <component :is="metricDeltaMeta(metric.delta, metric.deltaMode).icon" :size="11" />
                    {{ metricDeltaMeta(metric.delta, metric.deltaMode).label }}
                  </span>
                </div>
              </div>

              <el-tabs v-model="detailTab" class="account-profile__tabs">
                <el-tab-pane label="数据概览" name="overview">
                  <section class="profile-section">
                    <div class="profile-section__title">
                      <div>
                        <strong>账号资料</strong>
                        <small>平台公开信息与系统关联信息</small>
                      </div>
                    </div>
                    <div class="profile-info-grid">
                      <div><small>登录账号</small><strong>{{ selectedAccount.login_username || '-' }}</strong></div>
                      <div><small>公开用户名</small><strong>{{ selectedAccount.username ? '@' + selectedAccount.username : '-' }}</strong></div>
                      <div><small>国家</small><strong>{{ selectedAccount.country || '-' }}</strong></div>
                      <div><small>设备分组</small><strong>{{ selectedAccount.slot_group_name || '未分组' }}</strong></div>
                      <div><small>业务 App</small><strong>{{ optionLabel(businessPlatformOptions, selectedAccount.business_platform) }}</strong></div>
                      <div><small>登录状态</small><StatusBadge :value="selectedAccount.login_status" /></div>
                    </div>
                  </section>

                  <section class="profile-section">
                    <div class="profile-section__title">
                      <div>
                        <strong>监听情况</strong>
                        <small>当前账号的数据采集和评论回复配置</small>
                      </div>
                    </div>
                    <div class="profile-info-grid">
                      <div>
                        <small>数据监听</small>
                        <el-tag :type="monitorStateType(selectedAccount.monitor_state)" effect="light">
                          {{ monitorStateLabel(selectedAccount.monitor_state) }}
                        </el-tag>
                      </div>
                      <div><small>监听间隔</small><strong>{{ selectedAccount.monitor_interval_minutes ? selectedAccount.monitor_interval_minutes + ' 分钟' : '-' }}</strong></div>
                      <div><small>新评论回复</small><strong>{{ replyModeLabel(selectedAccount.comment_reply_mode) }}</strong></div>
                      <div><small>最近成功</small><strong>{{ formatDate(selectedAccount.last_success_at) }}</strong></div>
                      <div><small>下次监听</small><strong>{{ formatDate(selectedAccount.next_run_at) }}</strong></div>
                      <div><small>指标采集</small><strong>{{ formatDate(selectedAccount.metrics_captured_at) }}</strong></div>
                    </div>
                    <el-alert
                      v-if="selectedAccount.last_error_message"
                      :title="String(selectedAccount.last_error_message)"
                      type="error"
                      :closable="false"
                      show-icon
                      class="profile-section__alert"
                    />
                  </section>

                  <section class="profile-section">
                    <div class="profile-section__title">
                      <div>
                        <strong>对标跟踪</strong>
                        <small>对标账号资料和帖子同步概况</small>
                      </div>
                    </div>
                    <div class="profile-info-grid">
                      <div>
                        <small>跟踪状态</small>
                        <el-tag :type="monitorStateType(selectedAccount.benchmark_state)" effect="light">
                          {{ monitorStateLabel(selectedAccount.benchmark_state) }}
                        </el-tag>
                      </div>
                      <div><small>对标账号</small><strong>{{ selectedAccount.benchmark_source_display_name || selectedAccount.benchmark_source_username || '-' }}</strong></div>
                      <div><small>帖子映射</small><strong>{{ formatNumber(selectedAccount.benchmark_mapping_count) }}</strong></div>
                      <div><small>最近成功</small><strong>{{ formatDate(selectedAccount.benchmark_last_success_at) }}</strong></div>
                      <div><small>下次采集</small><strong>{{ formatDate(selectedAccount.benchmark_next_run_at) }}</strong></div>
                      <div><small>对标主页</small><strong class="profile-info-grid__ellipsis">{{ selectedAccount.benchmark_source_profile_url || '-' }}</strong></div>
                    </div>
                  </section>
                </el-tab-pane>
                <el-tab-pane label="账号内容" name="contents" lazy>
                  <AccountPublishedContentPanel
                    :key="'contents-' + String(selectedAccount.account_id)"
                    :account="accountPanelRecord(selectedAccount)"
                  />
                </el-tab-pane>
                <el-tab-pane label="对标账号" name="benchmark" lazy>
                  <BenchmarkTrackerDetailPanel
                    :key="'benchmark-' + String(selectedAccount.account_id)"
                    :account="accountPanelRecord(selectedAccount)"
                  />
                </el-tab-pane>
              </el-tabs>
            </template>
            <el-empty v-else description="请选择需要查看的账号" />
          </main>
        </div>
      </div>
    </el-card>

    <el-dialog
      v-model="monitorVisible"
      :title="monitorDialogTitle"
      width="min(92vw, 860px)"
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
          <div class="monitor-type-switch">
            <el-segmented
              v-model="monitorFeature"
              :options="[
                { label: '账号数据监听', value: 'account_data' },
                { label: '对标账号跟踪', value: 'benchmark' },
              ]"
              class="w-full"
            />
          </div>
          <div v-if="monitorAccountLocked && monitorTargetAccount" class="monitor-target-account">
            <span class="monitor-target-account__icon"><el-icon><Users /></el-icon></span>
            <span class="monitor-target-account__content">
              <strong>{{ monitorTargetAccount.account_name || monitorTargetAccount.login_username || '-' }}</strong>
              <small>
                {{ optionLabel(businessPlatformOptions, monitorTargetAccount.business_platform) }}
                · {{ monitorTargetAccount.slot_group_name || '未分组' }}
              </small>
            </span>
            <StatusBadge :value="monitorTargetAccount.login_status" />
          </div>
          <template v-if="monitorFeature === 'account_data'">
            <div class="dialog-section-title">账号数据监听</div>
            <el-form-item v-if="!monitorAccountLocked" label="业务 App">
              <el-select v-model="monitorForm.business_platform" disabled class="w-full">
                <el-option v-for="option in businessPlatformOptions" :key="String(option.value)" :label="option.label" :value="String(option.value)" />
              </el-select>
            </el-form-item>
            <el-form-item label="账号主页链接" required>
              <el-input v-model="monitorForm.profile_url" placeholder="例如：https://www.threads.com/@username" />
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
                      <el-option label="韩国财经互动（固定韩文）" value="korean_finance" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="最大长度">
                    <el-input-number v-model="monitorForm.ai_max_length" :min="20" :max="500" controls-position="right" class="w-full" />
                  </el-form-item>
                </div>
              </template>
            </div>
            <el-alert title="保存后服务端会立即同步一次，后续按监听规则自动采集账号资料、内容、指标和评论。" type="info" :closable="false" show-icon />
          </template>
          <template v-else>
            <div class="dialog-section-title">对标账号跟踪</div>
            <div v-if="monitorTargetAccount?.benchmark_tracker_id" class="benchmark-source">
              <el-avatar
                :size="42"
                :src="resolveBackendUrl(monitorTargetAccount.benchmark_source_avatar_url) || undefined"
              >
                {{ String(monitorTargetAccount.benchmark_source_display_name || monitorTargetAccount.benchmark_source_username || 'B').slice(0, 1) }}
              </el-avatar>
              <div>
                <strong>{{ monitorTargetAccount.benchmark_source_display_name || monitorTargetAccount.benchmark_source_username || '等待首次采集' }}</strong>
                <small>
                  {{ monitorTargetAccount.benchmark_mapping_count || 0 }} 条帖子基线 / 映射
                  · {{ formatDate(monitorTargetAccount.benchmark_last_success_at) }}
                </small>
              </div>
              <el-tag :type="monitorStateType(monitorTargetAccount.benchmark_state)">
                {{ monitorStateLabel(monitorTargetAccount.benchmark_state) }}
              </el-tag>
            </div>
            <el-form-item label="对标账号主页链接" required>
              <el-input v-model="benchmarkForm.source_profile_url" placeholder="例如：https://www.threads.com/@benchmark_user">
                <template #prefix><GitCompareArrows :size="15" /></template>
              </el-input>
            </el-form-item>
            <div class="monitor-form-row">
              <el-form-item label="监听规则">
                <el-select v-model="benchmarkForm.monitor_mode" class="w-full">
                  <el-option label="系统默认（每 60 分钟）" value="system" />
                  <el-option label="自定义间隔" value="custom" />
                </el-select>
              </el-form-item>
              <el-form-item label="监听间隔（分钟）">
                <el-input-number
                  v-model="benchmarkForm.interval_minutes"
                  :min="1"
                  :max="1440"
                  :disabled="benchmarkForm.monitor_mode !== 'custom'"
                  controls-position="right"
                  class="w-full"
                />
              </el-form-item>
            </div>
            <el-alert
              title="首次采集会立即同步头像、显示名称和简介，并以当前帖子建立基线；历史帖子不会补发。后续只复刻新增帖子，确认源帖删除后同步删除映射帖子。"
              type="info"
              :closable="false"
              show-icon
            />
            <el-alert
              v-if="monitorTargetAccount?.benchmark_last_error_message"
              :title="String(monitorTargetAccount.benchmark_last_error_message)"
              type="error"
              :closable="false"
              show-icon
              class="benchmark-error"
            />
          </template>
        </el-form>
      </div>
      <template #footer>
        <div class="monitor-dialog-footer">
          <el-button
            v-if="monitorFeature === 'account_data' && monitorAccountLocked && monitorTargetAccount?.monitor_enabled"
            type="danger"
            plain
            :icon="CircleOff"
            :loading="disablingAccountId === String(monitorTargetAccount.account_id)"
            @click="disableMonitor(monitorTargetAccount)"
          >关闭监听</el-button>
          <template v-if="monitorFeature === 'benchmark' && monitorAccountLocked && monitorTargetAccount?.benchmark_tracker_id">
            <el-button
              v-if="monitorTargetAccount?.benchmark_enabled"
              type="danger"
              plain
              :icon="CircleOff"
              :loading="disablingBenchmarkAccountId === String(monitorTargetAccount.account_id)"
              @click="disableBenchmarkTracker(monitorTargetAccount)"
            >关闭对标</el-button>
            <el-button
              v-if="monitorTargetAccount?.benchmark_enabled"
              plain
              :icon="RefreshCw"
              :loading="submitting"
              @click="runBenchmarkTrackerNow(monitorTargetAccount)"
            >立即采集</el-button>
          </template>
          <div class="monitor-dialog-footer__actions">
            <el-button @click="monitorVisible = false">取消</el-button>
            <el-button type="primary" :icon="Play" :loading="submitting" @click="submitMonitorForm">{{ monitorSubmitLabel }}</el-button>
          </div>
        </div>
      </template>
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
.filter-title,
.filter-actions,
.account-profile__header,
.account-profile__name-row,
.account-profile__handle,
.account-profile__tags,
.account-profile__actions,
.account-directory__header,
.account-directory__pagination,
.account-directory__item,
.account-directory__tags,
.profile-section__title { display: flex; align-items: center; }

.account-data__header {
  justify-content: space-between;
  gap: 16px;
  padding: 13px var(--content-inset);
  border-bottom: 1px solid #e6edf3;
  background: #fff;
}

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

.account-data__filters {
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid #dbe4ed;
  border-radius: 6px;
  background: #fff;
}
.filter-title { gap: 6px; margin-bottom: 10px; color: #26384a; font-size: 13px; font-weight: 700; }
.filter-grid { display: grid; grid-template-columns: repeat(4, minmax(130px, 1fr)) minmax(220px, 1.35fr); gap: 10px; }
.filter-actions { gap: 10px; margin-top: 10px; }

.account-data__split {
  display: grid;
  grid-template-columns: 316px minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid #dbe4ed;
  border-radius: 6px;
  background: #fff;
}
.account-directory__column {
  position: relative;
  min-width: 0;
  min-height: 0;
}
.account-directory {
  position: absolute;
  inset: 0;
  display: flex;
  min-width: 0;
  flex-direction: column;
  border-right: 1px solid #dbe4ed;
  background: #fbfdff;
}
.account-directory__header {
  justify-content: space-between;
  gap: 12px;
  min-height: 64px;
  padding: 12px 14px;
  border-bottom: 1px solid #e5ebf1;
  background: #fff;
}
.account-directory__header > div { min-width: 0; }
.account-directory__header strong,
.account-directory__header small { display: block; }
.account-directory__header strong { color: #26384a; font-size: 14px; }
.account-directory__header small { margin-top: 3px; color: #8190a0; font-size: 11px; }
.account-directory__viewport { min-height: 0; flex: 1; }
.account-directory__scroll { height: 100%; }
.account-directory__items { padding: 6px; }
.account-directory__item {
  width: 100%;
  min-width: 0;
  gap: 10px;
  padding: 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  color: inherit;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: border-color .15s ease, background .15s ease;
}
.account-directory__item:hover { background: #f1f7fb; }
.account-directory__item.is-selected {
  border-color: #9fc4dc;
  background: #eaf5fc;
}
.account-directory__copy {
  display: block;
  min-width: 0;
  flex: 1;
}
.account-directory__copy > strong,
.account-directory__copy > small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.account-directory__copy > strong { color: #243548; font-size: 13px; }
.account-directory__copy > small { margin-top: 3px; color: #7b8b9b; font-size: 11px; }
.account-directory__tags { gap: 5px; margin-top: 6px; }
.account-directory__tags :deep(.el-tag) { height: 20px; padding: 0 6px; font-size: 10px; }
.account-directory__pagination {
  justify-content: space-between;
  gap: 8px;
  min-height: 48px;
  padding: 8px 10px;
  border-top: 1px solid #e5ebf1;
  color: #718096;
  background: #fff;
  font-size: 11px;
}

.account-data__avatar,
.account-profile__avatar {
  flex: 0 0 auto;
  border: 1px solid #d5e2ec;
  color: #245f87;
  background: #edf6fc;
}
.account-profile {
  min-width: 0;
  padding: 18px 20px 22px;
  background: #fff;
}
.account-profile__header {
  align-items: flex-start;
  gap: 16px;
  padding-bottom: 18px;
  border-bottom: 1px solid #e7edf3;
}
.account-profile__avatar { box-shadow: 0 0 0 4px #f3f8fb; }
.account-profile__identity { min-width: 0; flex: 1; }
.account-profile__name-row { flex-wrap: wrap; gap: 9px; }
.account-profile__name-row h2 {
  overflow: hidden;
  max-width: 100%;
  color: #1f2f40;
  font-size: 21px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.account-profile__handle { flex-wrap: wrap; gap: 12px; margin-top: 5px; color: #718096; font-size: 12px; }
.account-profile__handle span + span { position: relative; padding-left: 12px; }
.account-profile__handle span + span::before {
  position: absolute;
  top: 50%;
  left: 0;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #a8b5c2;
  content: '';
  transform: translateY(-50%);
}
.account-profile__biography {
  max-width: 760px;
  margin-top: 12px;
  color: #425466;
  font-size: 13px;
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
}
.account-profile__tags { flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.account-profile__actions { flex: 0 0 auto; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.account-profile__actions :deep(.el-button) { margin-left: 0; }

.account-profile__metrics {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  margin: 16px 0 4px;
  border: 1px solid #dce5ed;
  border-radius: 6px;
  background: #f8fafc;
}
.account-profile__metrics > div {
  min-width: 0;
  padding: 13px 12px;
  border-right: 1px solid #dce5ed;
  text-align: center;
}
.account-profile__metrics > div:last-child { border-right: 0; }
.account-profile__metrics small,
.account-profile__metrics strong { display: block; }
.account-profile__metrics small { color: #7b8b9b; font-size: 11px; }
.account-profile__metrics strong {
  margin-top: 4px;
  overflow: hidden;
  color: #1f3a50;
  font-size: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.account-profile__delta {
  display: inline-flex;
  min-height: 16px;
  align-items: center;
  justify-content: center;
  gap: 3px;
  margin-top: 5px;
  color: #7b8b9b;
  font-size: 10px;
  line-height: 1;
  white-space: nowrap;
}
.account-profile__delta.is-up { color: #238457; }
.account-profile__delta.is-down { color: #cf4f4f; }
.account-profile__delta.is-flat,
.account-profile__delta.is-unknown { color: #8291a1; }
.account-profile__tabs { margin-top: 10px; }
.account-profile__tabs :deep(.el-tabs__header) { margin-bottom: 16px; }
.profile-section {
  padding: 15px 0 18px;
  border-bottom: 1px solid #e7edf3;
}
.profile-section:last-child { border-bottom: 0; }
.profile-section__title { justify-content: space-between; margin-bottom: 12px; }
.profile-section__title strong,
.profile-section__title small { display: block; }
.profile-section__title strong { color: #26384a; font-size: 14px; }
.profile-section__title small { margin-top: 3px; color: #8190a0; font-size: 11px; }
.profile-info-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  overflow: hidden;
  border: 1px solid #e1e8ef;
  border-radius: 6px;
}
.profile-info-grid > div {
  min-width: 0;
  min-height: 64px;
  padding: 11px 13px;
  border-right: 1px solid #e1e8ef;
  border-bottom: 1px solid #e1e8ef;
  background: #fbfdff;
}
.profile-info-grid > div:nth-child(3n) { border-right: 0; }
.profile-info-grid > div:nth-last-child(-n + 3) { border-bottom: 0; }
.profile-info-grid small,
.profile-info-grid strong { display: block; }
.profile-info-grid small { margin-bottom: 6px; color: #7b8b9b; font-size: 11px; }
.profile-info-grid strong { overflow: hidden; color: #2b3f52; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.profile-info-grid__ellipsis { max-width: 100%; }
.profile-section__alert { margin-top: 12px; }

.monitor-dialog-footer {
  justify-content: space-between;
  gap: 16px;
  width: 100%;
}
.monitor-dialog-footer__actions { gap: 8px; margin-left: auto; }
.monitor-dialog-grid { display: grid; grid-template-columns: minmax(280px, .85fr) minmax(0, 1.15fr); gap: 14px; }
.monitor-dialog-grid--locked { grid-template-columns: minmax(0, 1fr); }
.monitor-dialog-account,
.monitor-dialog-form { min-width: 0; padding: 12px; border: 1px solid #dbe4ed; border-radius: 6px; background: #f8fafc; }
.monitor-dialog-account { max-height: 510px; overflow: auto; }
.monitor-type-switch { margin-bottom: 14px; }
.monitor-type-switch :deep(.el-segmented) { min-height: 36px; }
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
.benchmark-source {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  padding: 10px 12px;
  border: 1px solid #d6e3ef;
  border-radius: 6px;
  background: #fff;
}
.benchmark-source > div { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 2px; }
.benchmark-source strong,
.benchmark-source small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.benchmark-source strong { color: #203346; font-size: 14px; }
.benchmark-source small { color: #718096; font-size: 11px; }
.benchmark-error { margin-top: 12px; }

@media (max-width: 1280px) {
  .account-data__split { grid-template-columns: 286px minmax(0, 1fr); }
  .account-profile__metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .account-profile__metrics > div:nth-child(3) { border-right: 0; }
  .account-profile__metrics > div:nth-child(-n + 3) { border-bottom: 1px solid #dce5ed; }
}

@media (max-width: 1100px) {
  .account-data__summary { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .filter-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .account-data__split { grid-template-columns: 260px minmax(0, 1fr); }
  .profile-info-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .profile-info-grid > div,
  .profile-info-grid > div:nth-child(3n) { border-right: 1px solid #e1e8ef; border-bottom: 1px solid #e1e8ef; }
  .profile-info-grid > div:nth-child(2n) { border-right: 0; }
  .profile-info-grid > div:nth-last-child(-n + 2) { border-bottom: 0; }
}

@media (max-width: 800px) {
  .account-data__header,
  .account-profile__header { align-items: flex-start; flex-direction: column; }
  .account-data__actions,
  .account-profile__actions { width: 100%; justify-content: flex-end; }
  .account-data__summary,
  .filter-grid,
  .monitor-dialog-grid,
  .monitor-form-row,
  .account-data__split { grid-template-columns: 1fr; }
  .account-data__body { padding: 12px; }
  .account-directory__column { position: static; }
  .account-directory {
    position: static;
    border-right: 0;
    border-bottom: 1px solid #dbe4ed;
  }
  .account-directory__viewport { flex: 0 1 auto; }
  .account-directory__scroll { height: auto; max-height: 50vh; }
  .account-profile { padding: 16px; }
}

@media (max-width: 560px) {
  .account-profile__metrics,
  .profile-info-grid { grid-template-columns: 1fr; }
  .account-profile__metrics > div,
  .account-profile__metrics > div:nth-child(3),
  .profile-info-grid > div,
  .profile-info-grid > div:nth-child(2n),
  .profile-info-grid > div:nth-child(3n) { border-right: 0; border-bottom: 1px solid #dce5ed; }
  .account-profile__metrics > div:last-child,
  .profile-info-grid > div:last-child { border-bottom: 0; }
  .account-profile__name-row h2 { font-size: 18px; }
}
</style>
