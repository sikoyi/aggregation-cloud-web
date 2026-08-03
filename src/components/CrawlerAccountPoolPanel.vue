<script setup lang="ts">
import {
  Activity,
  CirclePlus,
  KeyRound,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UsersRound,
} from 'lucide-vue-next'
import { ElMessageBox, ElNotification } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'

import { http } from '@/api/http'
import { notifyError } from '@/utils/notify'

interface CrawlerAccount {
  username: string
  status: string
  req_count: number
  err_count: number
  last_used?: string | null
  cool_left?: string | number | null
  last_error?: string | null
  queue_stats: Record<string, number>
  queue_locks: Record<string, unknown>
}

interface CrawlerAccountPool {
  accounts: CrawlerAccount[]
  healthy: number
  total: number
}

interface ProviderConfig {
  enabled: boolean
  provider: string
  updated_at?: string | null
}

const loading = ref(false)
const savingEnabled = ref(false)
const testing = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const keyword = ref('')
const statusFilter = ref('')
const enabled = ref(false)
const accounts = ref<CrawlerAccount[]>([])
const healthy = ref(0)
const total = ref(0)
const form = reactive({
  username: '',
  password: '',
  totp_secret: '',
  proxy: '',
})

const endpoint = '/api/interaction-center/content-monitor'

const filteredAccounts = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  return accounts.value.filter((item) => {
    const matchesKeyword = !query || item.username.toLowerCase().includes(query)
    const matchesStatus = !statusFilter.value || item.status === statusFilter.value
    return matchesKeyword && matchesStatus
  })
})

const cooldownCount = computed(() => accounts.value.filter((item) => item.status === 'cooldown').length)
const bannedCount = computed(() => accounts.value.filter((item) => item.status === 'banned').length)
const requestCount = computed(() => accounts.value.reduce((sum, item) => sum + Number(item.req_count || 0), 0))

function statusMeta(status: string) {
  const values: Record<string, { label: string; type: 'success' | 'warning' | 'danger' | 'info' }> = {
    healthy: { label: '健康', type: 'success' },
    cooldown: { label: '冷却中', type: 'warning' },
    banned: { label: '已封禁', type: 'danger' },
    offline: { label: '离线', type: 'info' },
  }
  return values[status] || { label: status || '未知', type: 'info' }
}

function queueSummary(stats: Record<string, number>) {
  const entries = Object.entries(stats || {}).filter(([, value]) => Number(value) > 0)
  if (!entries.length) return '暂无任务'
  return entries.map(([key, value]) => `${key} ${value}`).join(' · ')
}

function lastUsedText(value?: string | null) {
  return value?.trim() || '尚未使用'
}

async function loadData() {
  loading.value = true
  try {
    const [config, pool] = await Promise.all([
      http.get<ProviderConfig>(`${endpoint}/provider-config/threads`),
      http.get<CrawlerAccountPool>(`${endpoint}/crawler-accounts`),
    ])
    enabled.value = config.enabled === true
    accounts.value = Array.isArray(pool.accounts) ? pool.accounts : []
    healthy.value = Number(pool.healthy || 0)
    total.value = Number(pool.total || accounts.value.length)
  } catch (err) {
    notifyError(err, '加载失败', '独立爬虫账号池加载失败')
  } finally {
    loading.value = false
  }
}

async function saveEnabled(value: boolean) {
  savingEnabled.value = true
  try {
    const config = await http.put<ProviderConfig>(`${endpoint}/provider-config/threads`, { enabled: value })
    enabled.value = config.enabled === true
    ElNotification.success({
      title: '设置已更新',
      message: enabled.value ? '内容监听已启用' : '内容监听已停止',
    })
  } catch (err) {
    enabled.value = !value
    notifyError(err, '设置失败', '内容监听状态更新失败')
  } finally {
    savingEnabled.value = false
  }
}

async function testConnection() {
  testing.value = true
  try {
    const result = await http.post<{ healthy: number; total: number }>(`${endpoint}/crawler-service/test`)
    ElNotification.success({
      title: '连接正常',
      message: `账号池 ${result.total} 个账号，当前 ${result.healthy} 个健康账号`,
      duration: 5000,
    })
  } catch (err) {
    notifyError(err, '连接失败', '独立爬虫服务暂时不可用')
  } finally {
    testing.value = false
  }
}

function openCreateDialog() {
  form.username = ''
  form.password = ''
  form.totp_secret = ''
  form.proxy = ''
  dialogVisible.value = true
}

async function submitAccount() {
  if (!form.username.trim() || !form.password) {
    ElNotification.warning({ title: '请完善信息', message: '登录账号和密码不能为空' })
    return
  }
  submitting.value = true
  try {
    await http.post(`${endpoint}/crawler-accounts`, {
      username: form.username.trim(),
      password: form.password,
      totp_secret: form.totp_secret.trim(),
      proxy: form.proxy.trim(),
    })
    dialogVisible.value = false
    ElNotification.success({ title: '添加成功', message: '爬虫账号已加入账号池' })
    await loadData()
  } catch (err) {
    notifyError(err, '添加失败', '爬虫账号添加失败')
  } finally {
    submitting.value = false
  }
}

async function unbanAccount(account: Record<string, unknown>) {
  const username = String(account.username || '')
  try {
    await http.post(`${endpoint}/crawler-accounts/${encodeURIComponent(username)}/unban`)
    ElNotification.success({ title: '操作成功', message: `${username} 已解除封禁` })
    await loadData()
  } catch (err) {
    notifyError(err, '解除失败', '账号解除封禁失败')
  }
}

async function deleteAccount(account: Record<string, unknown>) {
  const username = String(account.username || '')
  try {
    await ElMessageBox.confirm(
      `确认从爬虫账号池删除“${username}”吗？删除后该账号不会再参与采集任务。`,
      '删除爬虫账号',
      { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' },
    )
    await http.delete(`${endpoint}/crawler-accounts/${encodeURIComponent(username)}`)
    ElNotification.success({ title: '删除成功', message: '爬虫账号已从账号池移除' })
    await loadData()
  } catch (err) {
    if (err === 'cancel' || err === 'close') return
    notifyError(err, '删除失败', '爬虫账号删除失败')
  }
}

onMounted(loadData)
</script>

<template>
  <div v-loading="loading" class="crawler-panel">
    <header class="crawler-header">
      <div>
        <div class="crawler-title">
          <span class="provider-mark">独立爬虫</span>
          <h2>Threads 采集账号池</h2>
        </div>
        <p>统一维护爬虫登录账号、2FA 和专用代理。业务采集只提交目标地址，由爬虫服务自动选择健康账号。</p>
      </div>
      <div class="header-actions">
        <div class="monitor-switch">
          <span>监听状态</span>
          <el-switch
            v-model="enabled"
            :loading="savingEnabled"
            inline-prompt
            active-text="启用"
            inactive-text="停用"
            @change="saveEnabled(Boolean($event))"
          />
        </div>
        <el-tooltip content="刷新账号池" placement="top">
          <el-button circle :icon="RefreshCw" :loading="loading" @click="loadData" />
        </el-tooltip>
        <el-button :icon="Activity" :loading="testing" @click="testConnection">测试连接</el-button>
        <el-button type="primary" :icon="CirclePlus" @click="openCreateDialog">添加账号</el-button>
      </div>
    </header>

    <section class="summary-strip" aria-label="账号池概览">
      <div class="summary-item">
        <UsersRound :size="18" />
        <span>账号总数</span>
        <strong>{{ total }}</strong>
      </div>
      <div class="summary-item summary-item--healthy">
        <ShieldCheck :size="18" />
        <span>健康账号</span>
        <strong>{{ healthy }}</strong>
      </div>
      <div class="summary-item summary-item--warning">
        <Activity :size="18" />
        <span>冷却账号</span>
        <strong>{{ cooldownCount }}</strong>
      </div>
      <div class="summary-item summary-item--danger">
        <KeyRound :size="18" />
        <span>封禁账号</span>
        <strong>{{ bannedCount }}</strong>
      </div>
      <div class="summary-item">
        <Activity :size="18" />
        <span>累计请求</span>
        <strong>{{ requestCount }}</strong>
      </div>
    </section>

    <div class="table-toolbar">
      <el-input v-model="keyword" clearable placeholder="搜索爬虫账号" :prefix-icon="Search" />
      <el-select v-model="statusFilter" clearable placeholder="全部状态">
        <el-option label="健康" value="healthy" />
        <el-option label="冷却中" value="cooldown" />
        <el-option label="已封禁" value="banned" />
        <el-option label="离线" value="offline" />
      </el-select>
      <span class="result-count">当前展示 {{ filteredAccounts.length }} 个账号</span>
    </div>

    <el-table :data="filteredAccounts" border stripe class="account-table" empty-text="还没有爬虫账号">
      <el-table-column prop="username" label="登录账号" min-width="210">
        <template #default="{ row }">
          <div class="account-name"><KeyRound :size="15" /><strong>{{ row.username }}</strong></div>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="110" align="center">
        <template #default="{ row }">
          <el-tag :type="statusMeta(row.status).type" effect="light" round>{{ statusMeta(row.status).label }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="请求 / 错误" width="130" align="center">
        <template #default="{ row }"><strong>{{ row.req_count }}</strong><span class="metric-divider">/</span><span class="error-count">{{ row.err_count }}</span></template>
      </el-table-column>
      <el-table-column label="队列使用" min-width="190">
        <template #default="{ row }"><span class="secondary-text">{{ queueSummary(row.queue_stats) }}</span></template>
      </el-table-column>
      <el-table-column label="最近使用" min-width="150">
        <template #default="{ row }"><span class="secondary-text">{{ lastUsedText(row.last_used) }}</span></template>
      </el-table-column>
      <el-table-column label="冷却剩余" width="120" align="center">
        <template #default="{ row }"><span class="secondary-text">{{ row.cool_left || '-' }}</span></template>
      </el-table-column>
      <el-table-column label="最近错误" min-width="220" show-overflow-tooltip>
        <template #default="{ row }"><span :class="row.last_error ? 'error-text' : 'secondary-text'">{{ row.last_error || '无' }}</span></template>
      </el-table-column>
      <el-table-column label="操作" width="112" fixed="right" align="center">
        <template #default="{ row }">
          <div class="row-actions">
            <el-tooltip v-if="row.status === 'banned'" content="解除封禁" placement="top">
              <el-button circle :icon="RotateCcw" @click="unbanAccount(row)" />
            </el-tooltip>
            <el-tooltip content="删除账号" placement="top">
              <el-button circle type="danger" plain :icon="Trash2" @click="deleteAccount(row)" />
            </el-tooltip>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" title="添加爬虫账号" width="620px" destroy-on-close>
      <el-alert
        title="登录凭据将直接发送给独立爬虫服务，主系统不会保存或回显密码、2FA 密钥和代理密码。"
        type="info"
        :closable="false"
        show-icon
      />
      <el-form label-position="top" class="account-form" @submit.prevent="submitAccount">
        <div class="form-grid">
          <el-form-item label="登录账号" required>
            <el-input v-model="form.username" autocomplete="off" placeholder="Threads 用户名、邮箱或手机号" />
          </el-form-item>
          <el-form-item label="登录密码" required>
            <el-input v-model="form.password" type="password" show-password autocomplete="new-password" placeholder="请输入账号密码" />
          </el-form-item>
          <el-form-item label="2FA / TOTP 密钥">
            <el-input v-model="form.totp_secret" autocomplete="off" placeholder="未开启 2FA 时可留空" />
          </el-form-item>
          <el-form-item label="账号专用代理">
            <el-input v-model="form.proxy" autocomplete="off" placeholder="http://user:pass@host:port" />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitAccount">确认添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.crawler-panel { min-height: 430px; color: #273444; }
.crawler-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; padding-bottom: 16px; border-bottom: 1px solid #e6edf3; }
.crawler-title { display: flex; align-items: center; gap: 10px; }
.crawler-title h2 { margin: 0; color: #1f2933; font-size: 17px; line-height: 28px; }
.crawler-header p { max-width: 720px; margin: 5px 0 0; color: #66788a; font-size: 13px; line-height: 1.6; }
.provider-mark { display: inline-flex; align-items: center; height: 25px; padding: 0 9px; border: 1px solid #9dcef0; border-radius: 4px; color: #17618e; background: #eef8ff; font-size: 12px; font-weight: 700; }
.header-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 9px; }
.monitor-switch { display: flex; align-items: center; gap: 9px; padding-right: 10px; border-right: 1px solid #dce5ed; color: #52606d; font-size: 13px; white-space: nowrap; }
.summary-strip { display: grid; grid-template-columns: repeat(5, minmax(120px, 1fr)); margin: 16px 0; border: 1px solid #dbe4ed; border-radius: 6px; background: #f8fafc; }
.summary-item { display: grid; grid-template-columns: 20px 1fr auto; align-items: center; gap: 8px; min-height: 62px; padding: 0 16px; color: #52606d; border-right: 1px solid #e1e8ef; font-size: 12px; }
.summary-item:last-child { border-right: 0; }
.summary-item svg { color: #3578a6; }
.summary-item strong { color: #1f2933; font-size: 21px; }
.summary-item--healthy svg, .summary-item--healthy strong { color: #39934f; }
.summary-item--warning svg, .summary-item--warning strong { color: #b88218; }
.summary-item--danger svg, .summary-item--danger strong { color: #cf4c4c; }
.table-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.table-toolbar .el-input { width: 260px; }
.table-toolbar .el-select { width: 150px; }
.result-count { margin-left: auto; color: #7b8b99; font-size: 12px; }
.account-table { width: 100%; }
.account-name, .row-actions { display: flex; align-items: center; }
.account-name { gap: 8px; color: #273444; }
.account-name svg { color: #3578a6; }
.row-actions { justify-content: center; gap: 6px; }
.metric-divider { margin: 0 7px; color: #b8c4ce; }
.error-count, .error-text { color: #cf4c4c; }
.secondary-text { color: #697b8c; }
.account-form { margin-top: 18px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 14px; }
@media (max-width: 980px) {
  .crawler-header { flex-direction: column; }
  .header-actions { justify-content: flex-start; }
  .summary-strip { grid-template-columns: repeat(2, minmax(140px, 1fr)); }
  .summary-item { border-bottom: 1px solid #e1e8ef; }
}
@media (max-width: 640px) {
  .form-grid { grid-template-columns: 1fr; }
  .table-toolbar { align-items: stretch; flex-direction: column; }
  .table-toolbar .el-input, .table-toolbar .el-select { width: 100%; }
  .result-count { margin-left: 0; }
}
</style>