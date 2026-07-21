<script setup lang="ts">
import {
  Activity,
  CalendarDays,
  Eye,
  EyeOff,
  KeyRound,
  Pencil,
  PlugZap,
  Plus,
  RefreshCw,
  Trash2,
  WalletCards,
} from 'lucide-vue-next'
import { ElMessageBox, ElNotification } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'

import { http } from '@/api/http'
import type { AnyRecord } from '@/types/api'
import { formatDate } from '@/utils/format'
import { notifyError } from '@/utils/notify'

interface ProviderToken {
  id: string
  name: string
  api_token: string
  enabled: boolean
  last_selected_at?: string | null
  created_at: string
  updated_at: string
}

interface DailyUsage {
  date: string
  usage_usd: number
}

interface TokenUsage {
  token_id: string
  token_name: string
  enabled: boolean
  available: boolean
  account_username?: string | null
  plan_name?: string | null
  monthly_credits_usd: number
  monthly_usage_usd: number
  remaining_credits_usd: number
  monthly_limit_usd?: number | null
  today_usage_usd: number
  cycle_start_at?: string | null
  cycle_end_at?: string | null
  daily_usages: DailyUsage[]
  error_message?: string | null
}

interface UsageSummary {
  token_count: number
  enabled_token_count: number
  available_token_count: number
  total_monthly_credits_usd: number
  total_monthly_usage_usd: number
  total_remaining_credits_usd: number
  total_today_usage_usd: number
  daily_usages: DailyUsage[]
  tokens: TokenUsage[]
  refreshed_at?: string
}

const businessPlatform = 'threads'
const loading = ref(false)
const usageLoading = ref(false)
const savingEnabled = ref(false)
const submitting = ref(false)
const testingTokenId = ref('')
const dialogVisible = ref(false)
const editingTokenId = ref('')
const revealedTokenIds = ref<string[]>([])
const enabled = ref(false)
const tokens = ref<ProviderToken[]>([])
const updatedAt = ref('')
const usage = ref<UsageSummary>(emptyUsage())
const tokenForm = reactive({ name: '', api_token: '', enabled: true })

const usageByTokenId = computed(() => {
  const values = new Map<string, TokenUsage>()
  usage.value.tokens.forEach((item) => values.set(item.token_id, item))
  return values
})
const recentDailyUsages = computed(() => usage.value.daily_usages.slice(-14))
const maxDailyUsage = computed(() => Math.max(...recentDailyUsages.value.map((item) => item.usage_usd), 0.000001))

function emptyUsage(): UsageSummary {
  return {
    token_count: 0,
    enabled_token_count: 0,
    available_token_count: 0,
    total_monthly_credits_usd: 0,
    total_monthly_usage_usd: 0,
    total_remaining_credits_usd: 0,
    total_today_usage_usd: 0,
    daily_usages: [],
    tokens: [],
  }
}

function endpoint(suffix = '') {
  return `/api/interaction-center/content-monitor/provider-config/${businessPlatform}${suffix}`
}

async function loadConfig() {
  loading.value = true
  try {
    const data = await http.get<AnyRecord>(endpoint())
    enabled.value = data.enabled === true
    tokens.value = Array.isArray(data.tokens) ? data.tokens as unknown as ProviderToken[] : []
    updatedAt.value = String(data.updated_at || '')
  } catch (err) {
    notifyError(err, '加载失败', '加载 Apify 配置失败')
  } finally {
    loading.value = false
  }
}

async function loadUsage() {
  if (!tokens.value.length) {
    usage.value = emptyUsage()
    return
  }
  usageLoading.value = true
  try {
    usage.value = await http.get<UsageSummary>(endpoint('/usage'))
  } catch (err) {
    notifyError(err, '用量读取失败', '暂时无法读取 Apify 额度与消耗')
  } finally {
    usageLoading.value = false
  }
}

async function refreshAll() {
  await loadConfig()
  await loadUsage()
}

async function saveEnabled(value: boolean) {
  savingEnabled.value = true
  try {
    const data = await http.put<AnyRecord>(endpoint(), { enabled: value })
    enabled.value = data.enabled === true
    updatedAt.value = String(data.updated_at || '')
    ElNotification.success({ title: '设置已更新', message: value ? '内容监听已启用' : '内容监听已停止' })
  } catch (err) {
    enabled.value = !value
    notifyError(err, '设置失败', '内容监听状态更新失败')
  } finally {
    savingEnabled.value = false
  }
}

function openCreateDialog() {
  editingTokenId.value = ''
  tokenForm.name = ''
  tokenForm.api_token = ''
  tokenForm.enabled = true
  dialogVisible.value = true
}

function openEditDialog(token: ProviderToken) {
  editingTokenId.value = token.id
  tokenForm.name = token.name
  tokenForm.api_token = token.api_token
  tokenForm.enabled = token.enabled
  dialogVisible.value = true
}

async function submitToken() {
  if (!tokenForm.name.trim() || !tokenForm.api_token.trim()) {
    ElNotification.warning({ title: '请完善信息', message: 'Token 名称和 Token 内容不能为空' })
    return
  }
  submitting.value = true
  try {
    const payload = {
      name: tokenForm.name.trim(),
      api_token: tokenForm.api_token.trim(),
      enabled: tokenForm.enabled,
    }
    if (editingTokenId.value) {
      await http.put(endpoint(`/tokens/${editingTokenId.value}`), payload)
    } else {
      await http.post(endpoint('/tokens'), payload)
    }
    dialogVisible.value = false
    ElNotification.success({ title: '保存成功', message: editingTokenId.value ? 'Token 已更新' : 'Token 已添加' })
    await refreshAll()
  } catch (err) {
    notifyError(err, '保存失败', 'Apify Token 保存失败')
  } finally {
    submitting.value = false
  }
}

async function toggleToken(token: ProviderToken, value: boolean) {
  try {
    await http.put(endpoint(`/tokens/${token.id}`), { enabled: value })
    token.enabled = value
    await loadConfig()
    await loadUsage()
  } catch (err) {
    token.enabled = !value
    notifyError(err, '更新失败', 'Token 状态更新失败')
  }
}

async function testConnection(token: ProviderToken) {
  testingTokenId.value = token.id
  try {
    const result = await http.post<AnyRecord>(endpoint('/test'), { token_id: token.id })
    ElNotification.success({
      title: '连接成功',
      message: result.account_username ? `已连接 Apify 账号：${result.account_username}` : 'Token 与固定 Actor 均可用',
      duration: 5000,
    })
  } catch (err) {
    notifyError(err, '连接失败', '该 Apify Token 不可用')
  } finally {
    testingTokenId.value = ''
  }
}

async function deleteToken(token: ProviderToken) {
  try {
    await ElMessageBox.confirm(
      `确认删除“${token.name}”吗？正在执行的采集任务使用该 Token 时将禁止删除。`,
      '删除 Token',
      { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' },
    )
    await http.delete(endpoint(`/tokens/${token.id}`))
    ElNotification.success({ title: '删除成功', message: 'Apify Token 已删除' })
    await refreshAll()
  } catch (err) {
    if (err === 'cancel' || err === 'close') return
    notifyError(err, '删除失败', 'Apify Token 删除失败')
  }
}

function toggleTokenVisibility(tokenId: string) {
  revealedTokenIds.value = revealedTokenIds.value.includes(tokenId)
    ? revealedTokenIds.value.filter((id) => id !== tokenId)
    : [...revealedTokenIds.value, tokenId]
}

function visibleToken(token: ProviderToken) {
  if (revealedTokenIds.value.includes(token.id)) return token.api_token
  if (token.api_token.length < 12) return '********'
  return `${token.api_token.slice(0, 7)}${'*'.repeat(10)}${token.api_token.slice(-4)}`
}

function rowToken(row: AnyRecord) {
  return row as unknown as ProviderToken
}

function money(value?: number | null, digits = 2) {
  return `$${Number(value || 0).toFixed(digits)}`
}

function usageRate(item?: TokenUsage) {
  if (!item || item.monthly_credits_usd <= 0) return 0
  return Math.min(100, Math.round((item.monthly_usage_usd / item.monthly_credits_usd) * 100))
}

function shortDate(value: string) {
  const parts = value.split('-')
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : value
}

onMounted(refreshAll)
</script>

<template>
  <div v-loading="loading" class="monitor-config">
    <div class="monitor-header">
      <div>
        <div class="monitor-title"><span class="provider-mark">Apify</span><h2>内容监听</h2></div>
        <p>服务端固定使用 Apify 采集适配器，多个 Token 按轮换顺序承接新的监听任务。</p>
      </div>
      <div class="monitor-switch">
        <div><strong>{{ enabled ? '监听已启用' : '监听已停止' }}</strong><span>同时控制账号与帖子监听</span></div>
        <el-switch :model-value="enabled" :loading="savingEnabled" @change="saveEnabled(Boolean($event))" />
      </div>
    </div>

    <div class="summary-strip" v-loading="usageLoading">
      <div class="summary-item">
        <span class="summary-icon summary-icon--blue"><KeyRound :size="18" /></span>
        <div><span>可用 Token</span><strong>{{ usage.enabled_token_count }} <small>/ {{ usage.token_count }}</small></strong></div>
      </div>
      <div class="summary-item">
        <span class="summary-icon summary-icon--green"><WalletCards :size="18" /></span>
        <div><span>剩余月度额度</span><strong>{{ money(usage.total_remaining_credits_usd) }}</strong></div>
      </div>
      <div class="summary-item">
        <span class="summary-icon summary-icon--amber"><CalendarDays :size="18" /></span>
        <div><span>本账期消耗</span><strong>{{ money(usage.total_monthly_usage_usd) }}</strong></div>
      </div>
      <div class="summary-item">
        <span class="summary-icon summary-icon--red"><Activity :size="18" /></span>
        <div><span>今日消耗</span><strong>{{ money(usage.total_today_usage_usd, 4) }}</strong></div>
      </div>
    </div>

    <div class="section-heading">
      <div><h3>Token 管理</h3><span>Token 原值仅对系统管理员可见</span></div>
      <div class="section-actions">
        <el-button :icon="RefreshCw" :loading="usageLoading" @click="refreshAll">刷新用量</el-button>
        <el-button type="primary" :icon="Plus" @click="openCreateDialog">添加 Token</el-button>
      </div>
    </div>

    <el-table v-if="tokens.length" :data="tokens" border class="token-table">
      <el-table-column label="Token 信息" min-width="260">
        <template #default="{ row }">
          <div class="token-main">
            <strong>{{ row.name }}</strong>
            <div class="token-secret">
              <code>{{ visibleToken(rowToken(row)) }}</code>
              <el-button link :icon="revealedTokenIds.includes(row.id) ? EyeOff : Eye" @click="toggleTokenVisibility(row.id)" />
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="Apify 账号" min-width="160">
        <template #default="{ row }">
          <div v-if="usageByTokenId.get(row.id)?.available" class="account-cell">
            <strong>{{ usageByTokenId.get(row.id)?.account_username || '未命名账号' }}</strong>
            <span>{{ usageByTokenId.get(row.id)?.plan_name || '未知套餐' }}</span>
          </div>
          <el-tooltip v-else :content="usageByTokenId.get(row.id)?.error_message || '尚未刷新用量'">
            <el-tag type="danger" effect="light">连接异常</el-tag>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="额度 / 消耗" min-width="240">
        <template #default="{ row }">
          <div v-if="usageByTokenId.get(row.id)?.available" class="usage-cell">
            <div><span>剩余 {{ money(usageByTokenId.get(row.id)?.remaining_credits_usd) }}</span><span>已用 {{ money(usageByTokenId.get(row.id)?.monthly_usage_usd) }}</span></div>
            <el-progress :percentage="usageRate(usageByTokenId.get(row.id))" :stroke-width="6" :show-text="false" />
            <small>今日 {{ money(usageByTokenId.get(row.id)?.today_usage_usd, 4) }}</small>
          </div>
          <span v-else class="muted-text">暂无可用数据</span>
        </template>
      </el-table-column>
      <el-table-column label="参与轮换" width="110" align="center">
        <template #default="{ row }">
          <el-switch :model-value="row.enabled" @change="toggleToken(rowToken(row), Boolean($event))" />
        </template>
      </el-table-column>
      <el-table-column label="最近调度" width="160" align="center">
        <template #default="{ row }"><span class="date-text">{{ row.last_selected_at ? formatDate(row.last_selected_at) : '尚未使用' }}</span></template>
      </el-table-column>
      <el-table-column label="操作" width="142" align="center" fixed="right">
        <template #default="{ row }">
          <div class="row-actions">
            <el-tooltip content="测试连接"><el-button circle :icon="PlugZap" :loading="testingTokenId === row.id" @click="testConnection(rowToken(row))" /></el-tooltip>
            <el-tooltip content="编辑"><el-button circle :icon="Pencil" @click="openEditDialog(rowToken(row))" /></el-tooltip>
            <el-tooltip content="删除"><el-button circle type="danger" plain :icon="Trash2" @click="deleteToken(rowToken(row))" /></el-tooltip>
          </div>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-else description="还没有 Apify Token，添加后即可启用内容监听" :image-size="74" />

    <div v-if="recentDailyUsages.length" class="daily-section">
      <div class="section-heading section-heading--compact">
        <div><h3>每日消耗</h3><span>最近 {{ recentDailyUsages.length }} 天，全部 Token 合计</span></div>
        <span class="refresh-time">{{ usage.refreshed_at ? `更新于 ${formatDate(usage.refreshed_at)}` : '' }}</span>
      </div>
      <div class="daily-chart">
        <el-tooltip v-for="item in recentDailyUsages" :key="item.date" :content="`${item.date} · ${money(item.usage_usd, 4)}`">
          <div class="daily-bar-item">
            <div class="daily-bar-track"><span :style="{ height: `${Math.max(4, (item.usage_usd / maxDailyUsage) * 100)}%` }" /></div>
            <small>{{ shortDate(item.date) }}</small>
          </div>
        </el-tooltip>
      </div>
    </div>

    <div class="config-footer">{{ updatedAt ? `配置最近更新：${formatDate(updatedAt)}` : '配置尚未创建' }}</div>

    <el-dialog v-model="dialogVisible" :title="editingTokenId ? '编辑 Apify Token' : '添加 Apify Token'" width="520px" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="Token 名称" required>
          <el-input v-model="tokenForm.name" maxlength="100" placeholder="例如：运营账号 A" />
        </el-form-item>
        <el-form-item label="Apify Token" required>
          <el-input v-model="tokenForm.api_token" type="password" show-password autocomplete="new-password" placeholder="请输入 apify_api_ 开头的 Token" />
        </el-form-item>
        <el-form-item label="参与轮换">
          <div class="enabled-field"><el-switch v-model="tokenForm.enabled" /><span>启用后，新监听任务会轮换使用该 Token</span></div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitToken">确认保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.monitor-config { min-height: 360px; color: #26384a; }
.monitor-header,
.monitor-title,
.monitor-switch,
.summary-item,
.section-heading,
.section-actions,
.token-secret,
.row-actions,
.enabled-field { display: flex; align-items: center; }
.monitor-header { justify-content: space-between; gap: 24px; padding-bottom: 16px; border-bottom: 1px solid #e4ebf2; }
.monitor-title { gap: 9px; }
.monitor-title h2 { font-size: 17px; font-weight: 700; }
.provider-mark { padding: 3px 8px; border-radius: 5px; color: #fff; background: #1d2939; font-size: 12px; font-weight: 700; }
.monitor-header p { margin-top: 6px; color: #718096; font-size: 12px; }
.monitor-switch { flex: 0 0 auto; gap: 14px; padding-left: 18px; border-left: 1px solid #e5ebf1; }
.monitor-switch div { display: grid; gap: 2px; text-align: right; }
.monitor-switch strong { font-size: 13px; }
.monitor-switch span { color: #8793a3; font-size: 11px; }
.summary-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 16px 0 20px; border: 1px solid #dce5ed; border-radius: 6px; background: #f9fbfd; }
.summary-item { gap: 10px; min-height: 78px; padding: 12px 16px; border-right: 1px solid #e2e9f0; }
.summary-item:last-child { border-right: 0; }
.summary-item > div { display: grid; gap: 3px; }
.summary-item span { color: #718096; font-size: 12px; }
.summary-item strong { color: #203246; font-size: 19px; font-weight: 700; }
.summary-item small { color: #8793a3; font-size: 12px; font-weight: 500; }
.summary-icon { display: inline-flex; width: 34px; height: 34px; align-items: center; justify-content: center; border-radius: 7px; }
.summary-icon--blue { color: #236b97; background: #eaf5fc; }
.summary-icon--green { color: #26845a; background: #eaf7f0; }
.summary-icon--amber { color: #a76912; background: #fff4df; }
.summary-icon--red { color: #c15454; background: #fff0f0; }
.section-heading { justify-content: space-between; gap: 16px; margin-bottom: 10px; }
.section-heading > div:first-child { display: grid; gap: 2px; }
.section-heading h3 { color: #25384a; font-size: 14px; font-weight: 700; }
.section-heading span { color: #8793a3; font-size: 11px; }
.section-heading--compact { margin-bottom: 14px; }
.section-actions,
.row-actions,
.token-secret,
.enabled-field { gap: 8px; }
.token-table { width: 100%; }
.token-table :deep(th.el-table__cell) { height: 42px; color: #46596c; background: #f5f8fb; font-size: 12px; }
.token-table :deep(td.el-table__cell) { padding: 10px 0; }
.token-main,
.account-cell,
.usage-cell { display: grid; gap: 5px; }
.token-main strong,
.account-cell strong { color: #25384a; font-size: 13px; }
.token-secret code { overflow: hidden; color: #66788a; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.account-cell span,
.usage-cell small,
.date-text,
.muted-text { color: #8793a3; font-size: 11px; }
.usage-cell > div { display: flex; justify-content: space-between; gap: 12px; color: #526273; font-size: 11px; }
.usage-cell :deep(.el-progress-bar__outer) { background: #edf1f5; }
.row-actions { justify-content: center; }
.row-actions .el-button + .el-button { margin-left: 0; }
.daily-section { margin-top: 20px; padding-top: 18px; border-top: 1px solid #e4ebf2; }
.daily-chart { display: grid; grid-template-columns: repeat(14, minmax(24px, 1fr)); height: 132px; gap: 8px; padding: 8px 8px 0; border: 1px solid #e1e8ef; border-radius: 6px; background: #fbfcfe; }
.daily-bar-item { display: grid; min-width: 0; grid-template-rows: 92px 18px; gap: 5px; text-align: center; }
.daily-bar-track { display: flex; align-items: flex-end; justify-content: center; border-bottom: 1px solid #dbe4ed; }
.daily-bar-track span { display: block; width: min(22px, 72%); min-height: 4px; border-radius: 3px 3px 0 0; background: #2d719d; transition: height .2s ease; }
.daily-bar-item small { overflow: hidden; color: #8793a3; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.refresh-time { white-space: nowrap; }
.config-footer { margin-top: 14px; color: #98a4b3; font-size: 11px; text-align: right; }
.enabled-field { min-height: 32px; color: #66788a; font-size: 12px; }
@media (max-width: 980px) {
  .summary-strip { grid-template-columns: repeat(2, 1fr); }
  .summary-item:nth-child(2) { border-right: 0; }
  .summary-item:nth-child(-n+2) { border-bottom: 1px solid #e2e9f0; }
  .daily-chart { overflow-x: auto; grid-template-columns: repeat(14, minmax(42px, 1fr)); }
}
@media (max-width: 680px) {
  .monitor-header { align-items: flex-start; flex-direction: column; }
  .monitor-switch { width: 100%; justify-content: space-between; padding: 10px 0 0; border-top: 1px solid #e5ebf1; border-left: 0; }
  .monitor-switch div { text-align: left; }
  .summary-strip { grid-template-columns: 1fr; }
  .summary-item { border-right: 0; border-bottom: 1px solid #e2e9f0; }
  .summary-item:last-child { border-bottom: 0; }
  .section-heading { align-items: flex-start; flex-direction: column; }
}
</style>
