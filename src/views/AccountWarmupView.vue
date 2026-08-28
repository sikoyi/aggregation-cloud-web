<script setup lang="ts">
import {
  Activity,
  CirclePause,
  CirclePlay,
  Eye,
  RefreshCw,
  RotateCw,
  Search,
  Settings2,
  SquarePen,
  X,
} from 'lucide-vue-next'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  createWarmupPlan,
  listWarmupDailyRuns,
  listWarmupMembers,
  listWarmupPlans,
  operateWarmupMember,
  operateWarmupPlan,
  syncWarmupScope,
  updateWarmupPlan,
  type WarmupDailyRun,
  type WarmupMember,
  type WarmupPlan,
  type WarmupPlanPayload,
} from '@/api/accountWarmup'
import { getAllPages } from '@/api/http'
import AccountTreeSelect from '@/components/AccountTreeSelect.vue'
import SlotTreeSelect from '@/components/SlotTreeSelect.vue'
import { usePersistentFilters } from '@/composables/usePersistentFilters'
import { registrationCountryOptions } from '@/config/options'
import { useAuthStore } from '@/stores/auth'
import type { AnyRecord } from '@/types/api'
import { formatDate, statusTagType } from '@/utils/format'
import { notifyError } from '@/utils/notify'

const loading = ref(false)
const saving = ref(false)
const rows = ref<WarmupPlan[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const editorVisible = ref(false)
const editingPlan = ref<WarmupPlan | null>(null)
const editorTab = ref('basic')
const detailVisible = ref(false)
const detailPlan = ref<WarmupPlan | null>(null)
const detailTab = ref('members')
const memberRows = ref<WarmupMember[]>([])
const memberTotal = ref(0)
const memberPage = ref(1)
const memberStatus = ref('')
const memberKeyword = ref('')
const dailyRows = ref<WarmupDailyRun[]>([])
const dailyTotal = ref(0)
const dailyPage = ref(1)
const dailyStatus = ref('')
const accountTags = ref<AnyRecord[]>([])
const slotGroups = ref<AnyRecord[]>([])
const contentGroups = ref<AnyRecord[]>([])
const fixedSource = ref<'account' | 'slot'>('account')
const suspendFormWatch = ref(false)
const auth = useAuthStore()

const { filters, resetFilters } = usePersistentFilters('list:account-warmup', {
  keyword: '',
  status: '',
  planType: '',
  businessPlatform: '',
  runtimePlatform: '',
  provider: '',
})

const planStatusOptions = [
  { label: '草稿', value: 'draft' },
  { label: '执行中', value: 'active' },
  { label: '已暂停', value: 'paused' },
  { label: '已完成', value: 'completed' },
  { label: '已取消', value: 'canceled' },
]
const memberStatusOptions = [
  { label: '养号中', value: 'active' },
  { label: '已暂停', value: 'paused' },
  { label: '待验收', value: 'pending_review' },
  { label: '已完成', value: 'completed' },
  { label: '异常暂停', value: 'abnormal_paused' },
  { label: '已移出范围', value: 'out_of_scope' },
]
const platformOptions = [
  { label: 'Threads', value: 'threads' },
  { label: 'X(Twitter)', value: 'x' },
  { label: 'Instagram', value: 'instagram' },
]
const runtimeOptions = [
  { label: '指纹浏览器', value: 'fingerprint_browser' },
  { label: '云手机', value: 'cloud_phone' },
]
const providerOptions = computed(() => form.runtime_platform === 'cloud_phone'
  ? [{ label: 'VMOS', value: 'vmos' }]
  : [
      { label: 'MoreLogin', value: 'morelogin' },
      { label: 'AdsPower', value: 'adspower' },
    ])
const weekdayOptions = [
  { label: '周一', value: 1 }, { label: '周二', value: 2 }, { label: '周三', value: 3 },
  { label: '周四', value: 4 }, { label: '周五', value: 5 }, { label: '周六', value: 6 },
  { label: '周日', value: 7 },
]
type BehaviorRuleKey = Exclude<keyof WarmupPlanPayload['behavior_rules'], 'target_languages'>

const behaviorRuleKeys: BehaviorRuleKey[] = ['browse', 'detail_view', 'like', 'follow', 'publish']
const behaviorRuleLabels: Record<BehaviorRuleKey, string> = {
  browse: '浏览内容',
  detail_view: '查看帖子详情',
  like: '随机点赞',
  follow: '随机关注',
  publish: '发布内容',
}

function initialForm(): WarmupPlanPayload {
  return {
    name: '',
    business_platform: 'threads',
    runtime_platform: 'fingerprint_browser',
    provider: 'morelogin',
    script_id: null,
    plan_type: 'full',
    target_days: 5,
    maintenance_schedule_type: null,
    maintenance_interval_days: null,
    maintenance_weekdays: [],
    timezone: 'Asia/Shanghai',
    daily_window_start: '09:00:00',
    daily_window_end: '22:00:00',
    max_concurrency: 10,
    failure_counts_as_day: false,
    continue_after_failure: true,
    consecutive_failure_pause_threshold: 3,
    retry_override: null,
    completion_mode: 'automatic',
    auto_convert_to_old: false,
    target_mode: 'fixed',
    target_rules: { account_ids: [], slot_ids: [], account_tag_ids: [], slot_group_ids: [] },
    behavior_rules: {
      target_languages: [],
      browse: { enabled: true, start_day: 1, min_minutes: 10, max_minutes: 30 },
      detail_view: { enabled: false, start_day: 1, probability: 20 },
      like: { enabled: false, start_day: 1, probability: 20 },
      follow: { enabled: false, start_day: 3, probability: 5 },
      publish: { enabled: false, start_day: 3, content_group_id: null, content_usage_status: 'unused' },
    },
  }
}

const form = reactive<WarmupPlanPayload>(initialForm())
const behaviorStartDayMax = computed(() => (
  form.plan_type === 'full' ? Math.max(1, Number(form.target_days || 1)) : 365
))
const selectorFilters = computed(() => ({
  business_platform: form.business_platform,
  runtime_platform: form.runtime_platform,
  provider: form.provider,
}))

function optionLabel(options: { label: string; value: string }[], value: string) {
  return options.find((item) => item.value === value)?.label || value || '-'
}

function planStatusLabel(value: string) {
  return optionLabel(planStatusOptions, value)
}

function memberStatusLabel(value: string) {
  return optionLabel(memberStatusOptions, value)
}

function planTypeLabel(value: string) {
  return value === 'maintenance' ? '日常维护' : '完整养号'
}

async function loadRows() {
  loading.value = true
  try {
    const data = await listWarmupPlans({
      keyword: filters.keyword || undefined,
      status: filters.status || undefined,
      plan_type: filters.planType || undefined,
      business_platform: filters.businessPlatform || undefined,
      runtime_platform: filters.runtimePlatform || undefined,
      provider: filters.provider || undefined,
      page: page.value,
      page_size: pageSize.value,
    })
    rows.value = data.items
    total.value = data.total
  } catch (error) {
    notifyError(error, '加载失败', '无法加载养号计划')
  } finally {
    loading.value = false
  }
}

async function loadOptions() {
  try {
    const [tagRows, groupRows, contentRows] = await Promise.all([
      getAllPages<AnyRecord>('/api/account-tags'),
      getAllPages<AnyRecord>('/api/slot-groups'),
      getAllPages<AnyRecord>('/api/content-center/content-groups'),
    ])
    accountTags.value = tagRows
    slotGroups.value = groupRows
    contentGroups.value = contentRows
  } catch (error) {
    notifyError(error, '选项加载失败', '部分养号配置选项暂时不可用')
  }
}

function openCreate() {
  editingPlan.value = null
  Object.assign(form, initialForm())
  fixedSource.value = 'account'
  editorTab.value = 'basic'
  editorVisible.value = true
}

function openEdit(tableRow: unknown) {
  const row = tableRow as WarmupPlan
  suspendFormWatch.value = true
  editingPlan.value = row
  Object.assign(form, JSON.parse(JSON.stringify(row)))
  form.behavior_rules = {
    ...initialForm().behavior_rules,
    ...form.behavior_rules,
  }
  fixedSource.value = form.target_rules.slot_ids.length && !form.target_rules.account_ids.length ? 'slot' : 'account'
  editorTab.value = 'basic'
  editorVisible.value = true
  void nextTick(() => { suspendFormWatch.value = false })
}

function normalizedPayload(): WarmupPlanPayload {
  const payload = JSON.parse(JSON.stringify(form)) as WarmupPlanPayload
  payload.script_id = null
  if (payload.plan_type === 'full') {
    payload.maintenance_schedule_type = null
    payload.maintenance_interval_days = null
    payload.maintenance_weekdays = []
  } else {
    payload.target_days = null
    payload.auto_convert_to_old = false
  }
  if (payload.target_mode === 'fixed') {
    payload.target_rules.account_tag_ids = []
    payload.target_rules.slot_group_ids = []
    if (payload.runtime_platform === 'fingerprint_browser') {
      if (fixedSource.value === 'account') payload.target_rules.slot_ids = []
      else payload.target_rules.account_ids = []
    }
  } else if (payload.target_mode === 'account_tags') {
    payload.target_rules.account_ids = []
    payload.target_rules.slot_ids = []
    payload.target_rules.slot_group_ids = []
  } else if (payload.target_mode === 'slot_groups') {
    payload.target_rules.account_ids = []
    payload.target_rules.slot_ids = []
    payload.target_rules.account_tag_ids = []
  } else {
    payload.target_rules.account_ids = []
    payload.target_rules.slot_ids = []
  }
  return payload
}

function validateForm() {
  if (!form.name.trim()) return '请填写计划名称'
  if (form.plan_type === 'full' && !form.target_days) return '请填写养号天数'
  if (form.plan_type === 'maintenance' && !form.maintenance_schedule_type) return '请选择维护周期'
  if (form.target_mode === 'fixed') {
    const hasAccount = form.target_rules.account_ids.length > 0
    const hasSlot = form.runtime_platform === 'fingerprint_browser' && form.target_rules.slot_ids.length > 0
    if (!hasAccount && !hasSlot) return '请选择目标账号或设备'
  }
  if (form.target_mode === 'account_tags' && !form.target_rules.account_tag_ids.length) return '请选择账号标签'
  if (form.target_mode === 'slot_groups' && !form.target_rules.slot_group_ids.length) return '请选择设备分组'
  if (form.target_mode === 'dynamic_intersection' && !form.target_rules.account_tag_ids.length && !form.target_rules.slot_group_ids.length) return '请至少选择账号标签或设备分组'
  const browseRule = form.behavior_rules.browse
  if (browseRule.enabled) {
    if (browseRule.min_minutes == null || browseRule.max_minutes == null) {
      editorTab.value = 'behavior'
      return '开启浏览内容后必须填写时长范围'
    }
    if (browseRule.min_minutes < 1 || browseRule.max_minutes < 1) {
      editorTab.value = 'behavior'
      return '浏览时长至少为 1 分钟'
    }
    if (browseRule.min_minutes > browseRule.max_minutes) {
      editorTab.value = 'behavior'
      return '浏览最小时长不能大于最大时长'
    }
  }
  if (form.behavior_rules.publish.enabled && !form.behavior_rules.publish.content_group_id) return '开启发帖后必须选择内容池'
  if (form.plan_type === 'full') {
    const targetDays = Number(form.target_days || 0)
    for (const key of behaviorRuleKeys) {
      const rule = form.behavior_rules[key]
      if (rule.enabled && rule.start_day > targetDays) {
        editorTab.value = 'behavior'
        return `${behaviorRuleLabels[key]}设置为第 ${rule.start_day} 天开始，但目标养号周期只有 ${targetDays} 天`
      }
    }
  }
  return ''
}

function clampEnabledBehaviorStartDays() {
  if (form.plan_type !== 'full') return
  const targetDays = Number(form.target_days || 0)
  if (targetDays < 1) return
  for (const key of behaviorRuleKeys) {
    const rule = form.behavior_rules[key]
    if (rule.enabled && rule.start_day > targetDays) rule.start_day = targetDays
  }
}

async function savePlan() {
  const message = validateForm()
  if (message) {
    ElMessage.warning(message)
    return
  }
  saving.value = true
  try {
    if (editingPlan.value) await updateWarmupPlan(editingPlan.value.id, normalizedPayload())
    else await createWarmupPlan(normalizedPayload())
    ElMessage.success(editingPlan.value ? '养号计划已保存' : '养号计划已创建')
    editorVisible.value = false
    await loadRows()
  } catch (error) {
    notifyError(error, '保存失败', '无法保存养号计划')
  } finally {
    saving.value = false
  }
}

async function operatePlan(tableRow: unknown, action: 'activate' | 'pause' | 'resume' | 'cancel') {
  const row = tableRow as WarmupPlan
  const labels = { activate: '激活', pause: '暂停', resume: '恢复', cancel: '取消' }
  try {
    if (action === 'cancel') {
      await ElMessageBox.confirm('取消后不会再生成后续养号任务，正在执行的任务会自然结束。', '取消养号计划', { type: 'warning' })
    }
    await operateWarmupPlan(row.id, action)
    ElMessage.success(`${labels[action]}成功`)
    await loadRows()
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    notifyError(error, `${labels[action]}失败`)
  }
}

async function handleSync(tableRow: unknown) {
  const row = tableRow as WarmupPlan
  try {
    const data = await syncWarmupScope(row.id)
    ElMessage.success(`范围同步完成：命中 ${data.matched_count}，新增 ${data.joined_count}，移出 ${data.removed_count}，冲突 ${data.conflict_count}`)
    await loadRows()
  } catch (error) {
    notifyError(error, '同步失败', '无法同步养号目标范围')
  }
}

async function openDetail(tableRow: unknown) {
  const row = tableRow as WarmupPlan
  detailPlan.value = row
  detailTab.value = 'members'
  memberPage.value = 1
  dailyPage.value = 1
  detailVisible.value = true
  await loadMembers()
}

async function loadMembers() {
  if (!detailPlan.value) return
  try {
    const data = await listWarmupMembers(detailPlan.value.id, {
      status: memberStatus.value || undefined,
      keyword: memberKeyword.value || undefined,
      page: memberPage.value,
      page_size: 20,
    })
    memberRows.value = data.items
    memberTotal.value = data.total
  } catch (error) {
    notifyError(error, '加载失败', '无法加载养号成员')
  }
}

async function loadDailyRuns() {
  if (!detailPlan.value) return
  try {
    const data = await listWarmupDailyRuns(detailPlan.value.id, {
      status: dailyStatus.value || undefined,
      page: dailyPage.value,
      page_size: 20,
    })
    dailyRows.value = data.items
    dailyTotal.value = data.total
  } catch (error) {
    notifyError(error, '加载失败', '无法加载每日养号记录')
  }
}

async function operateMember(tableRow: unknown, action: string) {
  const row = tableRow as WarmupMember
  if (!detailPlan.value) return
  try {
    await operateWarmupMember(detailPlan.value.id, row.id, action)
    ElMessage.success('账号养号状态已更新')
    await loadMembers()
    await loadRows()
  } catch (error) {
    notifyError(error, '操作失败')
  }
}

watch(() => form.runtime_platform, (value) => {
  if (suspendFormWatch.value) return
  form.provider = value === 'cloud_phone' ? 'vmos' : 'morelogin'
  form.script_id = null
  form.target_rules.account_ids = []
  form.target_rules.slot_ids = []
  form.target_rules.slot_group_ids = []
  fixedSource.value = value === 'cloud_phone' ? 'account' : fixedSource.value
})
watch(() => [form.business_platform, form.provider], () => {
  if (!suspendFormWatch.value) form.script_id = null
})
watch(
  () => [
    form.plan_type,
    form.target_days,
    ...behaviorRuleKeys.map((key) => form.behavior_rules[key].enabled),
  ],
  () => {
    if (!suspendFormWatch.value) clampEnabledBehaviorStartDays()
  },
)
watch(detailTab, (value) => {
  if (value === 'daily') void loadDailyRuns()
})

onMounted(() => {
  void Promise.all([loadRows(), loadOptions()])
})
</script>

<template>
  <section class="warmup-page">
    <el-card shadow="never" class="workspace-card">
      <template #header>
        <div class="page-header">
          <div class="page-title">
            <span class="page-title__icon"><Activity :size="20" /></span>
            <div><h1>账号养号</h1><p>按账号和设备范围制定养号规则，逐日推进并查看执行进度。</p></div>
          </div>
          <div class="header-actions">
            <el-tooltip content="刷新"><el-button circle :icon="RefreshCw" :loading="loading" @click="loadRows" /></el-tooltip>
            <el-button v-if="auth.can('account_warmup.create')" type="primary" @click="openCreate">新建计划</el-button>
          </div>
        </div>
      </template>

      <div class="filter-panel">
        <div class="filter-title"><Settings2 :size="15" /> 筛选条件</div>
        <div class="filter-grid">
          <el-input v-model="filters.keyword" clearable placeholder="计划名称" @keyup.enter="page = 1; loadRows()" />
          <el-select v-model="filters.status" clearable placeholder="计划状态"><el-option v-for="item in planStatusOptions" :key="item.value" v-bind="item" /></el-select>
          <el-select v-model="filters.planType" clearable placeholder="计划类型"><el-option label="完整养号" value="full" /><el-option label="日常维护" value="maintenance" /></el-select>
          <el-select v-model="filters.businessPlatform" clearable placeholder="业务 App"><el-option v-for="item in platformOptions" :key="item.value" v-bind="item" /></el-select>
          <el-select v-model="filters.runtimePlatform" clearable placeholder="执行平台"><el-option v-for="item in runtimeOptions" :key="item.value" v-bind="item" /></el-select>
          <el-select v-model="filters.provider" clearable placeholder="供应商"><el-option label="MoreLogin" value="morelogin" /><el-option label="AdsPower" value="adspower" /><el-option label="VMOS" value="vmos" /></el-select>
        </div>
        <div class="filter-actions">
          <el-button @click="resetFilters(); page = 1; loadRows()">清空</el-button>
          <el-button type="primary" :icon="Search" @click="page = 1; loadRows()">查询</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="rows" border stripe class="plan-table">
        <el-table-column prop="id" label="计划 ID" width="88" align="center" />
        <el-table-column label="计划信息" min-width="230">
          <template #default="{ row }"><strong>{{ row.name }}</strong><div class="subline">{{ planTypeLabel(row.plan_type) }} · {{ optionLabel(platformOptions, row.business_platform) }}<template v-if="row.plan_type === 'full' && row.auto_convert_to_old"> · 完成后转老号</template></div><div class="subline">创建人：{{ row.creator_name || '-' }}</div></template>
        </el-table-column>
        <el-table-column label="执行范围" min-width="180" align="center">
          <template #default="{ row }"><el-tag effect="plain">{{ optionLabel(runtimeOptions, row.runtime_platform) }}</el-tag><el-tag effect="plain" class="ml6">{{ row.provider }}</el-tag></template>
        </el-table-column>
        <el-table-column label="账号进度" min-width="225" align="center">
          <template #default="{ row }"><div class="metric-row"><span>总数 <b>{{ row.member_total }}</b></span><span>完成 <b class="success">{{ row.completed_total }}</b></span><span>异常 <b class="danger">{{ row.abnormal_total }}</b></span></div></template>
        </el-table-column>
        <el-table-column label="并发 / 时段" min-width="180" align="center">
          <template #default="{ row }"><strong>{{ row.max_concurrency }} 个</strong><div class="subline">{{ row.daily_window_start }} - {{ row.daily_window_end }}</div></template>
        </el-table-column>
        <el-table-column label="状态" width="110" align="center"><template #default="{ row }"><el-tag :type="statusTagType(row.status)">{{ planStatusLabel(row.status) }}</el-tag></template></el-table-column>
        <el-table-column label="创建时间" width="180" align="center"><template #default="{ row }">{{ formatDate(row.created_at) }}</template></el-table-column>
        <el-table-column label="操作" width="220" align="center" fixed="right">
          <template #default="{ row }">
            <el-tooltip content="详情"><el-button circle :icon="Eye" @click="openDetail(row)" /></el-tooltip>
            <el-tooltip v-if="auth.can('account_warmup.edit') && ['draft', 'paused'].includes(row.status)" content="编辑"><el-button circle :icon="SquarePen" @click="openEdit(row)" /></el-tooltip>
            <el-tooltip v-if="auth.can('account_warmup.edit') && row.status === 'draft'" content="激活"><el-button circle type="success" :icon="CirclePlay" @click="operatePlan(row, 'activate')" /></el-tooltip>
            <el-tooltip v-if="auth.can('account_warmup.edit') && row.status === 'active'" content="同步范围"><el-button circle :icon="RotateCw" @click="handleSync(row)" /></el-tooltip>
            <el-tooltip v-if="auth.can('account_warmup.edit') && row.status === 'active'" content="暂停"><el-button circle type="warning" :icon="CirclePause" @click="operatePlan(row, 'pause')" /></el-tooltip>
            <el-tooltip v-if="auth.can('account_warmup.edit') && row.status === 'paused'" content="恢复"><el-button circle type="success" :icon="CirclePlay" @click="operatePlan(row, 'resume')" /></el-tooltip>
            <el-tooltip v-if="auth.can('account_warmup.delete') && !['completed', 'canceled'].includes(row.status)" content="取消"><el-button circle type="danger" plain :icon="X" @click="operatePlan(row, 'cancel')" /></el-tooltip>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination"><el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" layout="total, sizes, prev, pager, next" @change="loadRows" /></div>
    </el-card>

    <el-dialog v-model="editorVisible" :title="editingPlan ? '编辑养号计划' : '新建养号计划'" width="1040px" destroy-on-close>
      <el-tabs v-model="editorTab" class="editor-tabs">
        <el-tab-pane label="基础规则" name="basic">
          <el-form label-position="top" class="form-grid">
            <el-form-item label="计划名称" required><el-input v-model="form.name" maxlength="200" /></el-form-item>
            <el-form-item label="计划类型" required><el-segmented v-model="form.plan_type" :disabled="Boolean(editingPlan && editingPlan.status !== 'draft')" :options="[{ label: '完整养号', value: 'full' }, { label: '日常维护', value: 'maintenance' }]" /></el-form-item>
            <el-form-item label="业务 App" required><el-select v-model="form.business_platform"><el-option v-for="item in platformOptions" :key="item.value" v-bind="item" /></el-select></el-form-item>
            <el-form-item label="执行平台" required><el-select v-model="form.runtime_platform"><el-option v-for="item in runtimeOptions" :key="item.value" v-bind="item" /></el-select></el-form-item>
            <el-form-item label="供应商" required><el-select v-model="form.provider"><el-option v-for="item in providerOptions" :key="item.value" v-bind="item" /></el-select></el-form-item>
            <el-form-item v-if="form.plan_type === 'full'" label="目标养号天数" required><el-input-number v-model="form.target_days" :min="1" :max="365" :disabled="Boolean(editingPlan && editingPlan.status !== 'draft')" /><div v-if="editingPlan && editingPlan.status !== 'draft'" class="field-help">计划开始执行后不可修改</div></el-form-item>
            <el-form-item v-else label="维护周期" required><el-select v-model="form.maintenance_schedule_type"><el-option label="每天" value="daily" /><el-option label="间隔天数" value="interval_days" /><el-option label="按星期" value="weekdays" /></el-select></el-form-item>
            <el-form-item v-if="form.plan_type === 'maintenance' && form.maintenance_schedule_type === 'interval_days'" label="间隔天数" required><el-input-number v-model="form.maintenance_interval_days" :min="1" :max="365" /></el-form-item>
            <el-form-item v-if="form.plan_type === 'maintenance' && form.maintenance_schedule_type === 'weekdays'" label="执行星期" required class="span-2"><el-checkbox-group v-model="form.maintenance_weekdays"><el-checkbox-button v-for="item in weekdayOptions" :key="item.value" :value="item.value">{{ item.label }}</el-checkbox-button></el-checkbox-group></el-form-item>
            <el-form-item label="每日允许时段" required class="span-2"><div class="time-range"><el-time-picker v-model="form.daily_window_start" value-format="HH:mm:ss" format="HH:mm" /><span>至</span><el-time-picker v-model="form.daily_window_end" value-format="HH:mm:ss" format="HH:mm" /></div></el-form-item>
            <el-form-item label="最大并发账号数" required><el-input-number v-model="form.max_concurrency" :min="1" :max="10000" /></el-form-item>
            <el-form-item label="连续失败暂停阈值" required><el-input-number v-model="form.consecutive_failure_pause_threshold" :min="1" :max="100" /></el-form-item>
            <el-form-item label="完成方式"><el-select v-model="form.completion_mode"><el-option label="自动完成" value="automatic" /><el-option label="人工验收" value="manual_review" /></el-select></el-form-item>
            <el-form-item v-if="form.plan_type === 'full'" label="完成后的账号类型">
              <div class="switch-field">
                <el-switch v-model="form.auto_convert_to_old" />
                <span>完成后自动转为老号</span>
              </div>
              <div class="field-help">自动完成时立即转换；人工验收时在审核通过后转换。</div>
            </el-form-item>
            <el-form-item label="失败策略"><div class="switches"><el-checkbox v-model="form.failure_counts_as_day">失败计入养号天数</el-checkbox><el-checkbox v-model="form.continue_after_failure">失败后继续后续计划</el-checkbox></div></el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="目标范围" name="target">
          <div class="target-mode"><el-segmented v-model="form.target_mode" :options="[{ label: '固定目标', value: 'fixed' }, { label: '账号标签', value: 'account_tags' }, { label: '设备分组', value: 'slot_groups' }, { label: '标签与分组交集', value: 'dynamic_intersection' }]" /></div>
          <div v-if="form.target_mode === 'fixed'" class="target-picker">
            <el-segmented v-if="form.runtime_platform === 'fingerprint_browser'" v-model="fixedSource" :options="[{ label: '按账号选择', value: 'account' }, { label: '按设备选择', value: 'slot' }]" />
            <div v-if="fixedSource === 'account' || form.runtime_platform === 'cloud_phone'" class="selector-panel"><h3>目标账号</h3><AccountTreeSelect v-model="form.target_rules.account_ids" :filters="selectorFilters" multiple association-only /></div>
            <div v-if="fixedSource === 'slot' || form.runtime_platform === 'cloud_phone'" class="selector-panel"><h3>{{ form.runtime_platform === 'cloud_phone' ? '允许使用的设备池（可选）' : '目标设备' }}</h3><SlotTreeSelect v-model="form.target_rules.slot_ids" :filters="selectorFilters" /></div>
          </div>
          <div v-else class="form-grid target-selects">
            <el-form-item v-if="['account_tags', 'dynamic_intersection'].includes(form.target_mode)" label="账号标签" required><el-select v-model="form.target_rules.account_tag_ids" multiple filterable collapse-tags><el-option v-for="item in accountTags" :key="String(item.id)" :label="String(item.name)" :value="String(item.id)" /></el-select></el-form-item>
            <el-form-item v-if="['slot_groups', 'dynamic_intersection'].includes(form.target_mode)" label="设备分组" required><el-select v-model="form.target_rules.slot_group_ids" multiple filterable collapse-tags><el-option v-for="item in slotGroups" :key="String(item.id)" :label="String(item.name)" :value="String(item.id)" /></el-select></el-form-item>
          </div>
        </el-tab-pane>

        <el-tab-pane label="行为规则" name="behavior">
          <div class="behavior-list">
            <div class="behavior-item behavior-language-filter">
              <div class="behavior-title">
                <div><strong>限制帖子语言</strong><p>按国家/地区限制脚本处理的帖子语言；不选择则不限制。</p></div>
              </div>
              <el-select
                v-model="form.behavior_rules.target_languages"
                multiple
                filterable
                clearable
                collapse-tags
                collapse-tags-tooltip
                placeholder="不限制帖子语言"
              >
                <el-option v-for="item in registrationCountryOptions" :key="String(item.value)" v-bind="item" />
              </el-select>
            </div>
            <div class="behavior-rule-grid">
              <div class="behavior-item"><div class="behavior-title"><div><strong>浏览内容</strong><p>随机生成脚本本次需要浏览的时长。</p></div><el-switch v-model="form.behavior_rules.browse.enabled" /></div><div v-if="form.behavior_rules.browse.enabled" class="behavior-fields behavior-fields--compact"><label>开始天数：<el-input-number v-model="form.behavior_rules.browse.start_day" :controls="false" :min="1" :max="behaviorStartDayMax" /></label><label>时长范围（分钟）：<span class="inline-range"><el-input-number v-model="form.behavior_rules.browse.min_minutes" :controls="false" :min="1" /> - <el-input-number v-model="form.behavior_rules.browse.max_minutes" :controls="false" :min="1" /></span></label></div></div>
              <div class="behavior-item"><div class="behavior-title"><div><strong>查看帖子详情</strong><p>按概率进入帖子详情页查看。</p></div><el-switch v-model="form.behavior_rules.detail_view.enabled" /></div><div v-if="form.behavior_rules.detail_view.enabled" class="behavior-fields behavior-fields--compact"><label>开始天数：<el-input-number v-model="form.behavior_rules.detail_view.start_day" :controls="false" :min="1" :max="behaviorStartDayMax" /></label><label>查看概率（%）：<el-input-number v-model="form.behavior_rules.detail_view.probability" :controls="false" :min="0" :max="100" /></label></div></div>
            </div>
            <div class="behavior-rule-grid">
              <div class="behavior-item"><div class="behavior-title"><div><strong>随机点赞</strong><p>按浏览内容独立随机判断。</p></div><el-switch v-model="form.behavior_rules.like.enabled" /></div><div v-if="form.behavior_rules.like.enabled" class="behavior-fields behavior-fields--compact"><label>开始天数：<el-input-number v-model="form.behavior_rules.like.start_day" :controls="false" :min="1" :max="behaviorStartDayMax" /></label><label>点赞概率（%）：<el-input-number v-model="form.behavior_rules.like.probability" :controls="false" :min="0" :max="100" /></label></div></div>
              <div class="behavior-item"><div class="behavior-title"><div><strong>随机关注</strong><p>按浏览到的账号独立随机判断。</p></div><el-switch v-model="form.behavior_rules.follow.enabled" /></div><div v-if="form.behavior_rules.follow.enabled" class="behavior-fields behavior-fields--compact"><label>开始天数：<el-input-number v-model="form.behavior_rules.follow.start_day" :controls="false" :min="1" :max="behaviorStartDayMax" /></label><label>关注概率（%）：<el-input-number v-model="form.behavior_rules.follow.probability" :controls="false" :min="0" :max="100" /></label></div></div>
            </div>
            <div class="behavior-item"><div class="behavior-title"><div><strong>发布内容</strong><p>从指定内容池中随机分配一条内容，失败后不释放。</p></div><el-switch v-model="form.behavior_rules.publish.enabled" /></div><div v-if="form.behavior_rules.publish.enabled" class="behavior-fields"><label>开始天数：<el-input-number v-model="form.behavior_rules.publish.start_day" :controls="false" :min="1" :max="behaviorStartDayMax" /></label><label>内容池：<el-select v-model="form.behavior_rules.publish.content_group_id" filterable><el-option v-for="item in contentGroups.filter((group) => group.business_platform === form.business_platform)" :key="String(item.id)" :label="String(item.name)" :value="String(item.id)" /></el-select></label><label>内容使用状态：<el-select v-model="form.behavior_rules.publish.content_usage_status"><el-option label="未使用" value="unused" /><el-option label="已使用" value="used" /><el-option label="全部" value="all" /></el-select></label></div></div>
          </div>
        </el-tab-pane>
      </el-tabs>
      <template #footer><el-button @click="editorVisible = false">取消</el-button><el-button type="primary" :loading="saving" @click="savePlan">保存草稿</el-button></template>
    </el-dialog>

    <el-dialog v-model="detailVisible" :title="detailPlan ? `养号计划：${detailPlan.name}` : '养号计划详情'" width="1100px" destroy-on-close>
      <el-tabs v-model="detailTab">
        <el-tab-pane label="账号进度" name="members">
          <div class="detail-toolbar"><el-input v-model="memberKeyword" clearable placeholder="搜索账号" @keyup.enter="memberPage = 1; loadMembers()" /><el-select v-model="memberStatus" clearable placeholder="成员状态"><el-option v-for="item in memberStatusOptions" :key="item.value" v-bind="item" /></el-select><el-button type="primary" :icon="Search" @click="memberPage = 1; loadMembers()">查询</el-button></div>
          <el-table :data="memberRows" border stripe>
            <el-table-column prop="account_id" label="账号 ID" width="90" align="center" />
            <el-table-column label="账号" min-width="150"><template #default="{ row }"><strong>{{ row.account_name || '-' }}</strong><div class="subline">{{ row.slot_name || '暂无固定设备' }}</div></template></el-table-column>
            <el-table-column label="账号类型" width="95" align="center"><template #default="{ row }">{{ row.account_type === 'new' ? '新号' : row.account_type === 'old' ? '老号' : '未知' }}</template></el-table-column>
            <el-table-column label="养号进度" width="150" align="center"><template #default="{ row }"><strong>第 {{ row.current_day }} 天</strong><div class="subline">有效 {{ row.counted_days }} 天</div></template></el-table-column>
            <el-table-column label="结果" width="150" align="center"><template #default="{ row }"><span class="success">成功 {{ row.success_count }}</span><span class="danger ml10">失败 {{ row.failure_count }}</span></template></el-table-column>
            <el-table-column label="状态" width="105" align="center"><template #default="{ row }"><el-tag :type="statusTagType(row.status)">{{ memberStatusLabel(row.status) }}</el-tag></template></el-table-column>
            <el-table-column label="下次执行" width="175" align="center"><template #default="{ row }">{{ formatDate(row.next_run_at) }}</template></el-table-column>
            <el-table-column label="暂停原因" min-width="160" show-overflow-tooltip><template #default="{ row }">{{ row.pause_reason || '-' }}</template></el-table-column>
            <el-table-column label="操作" width="145" align="center"><template #default="{ row }"><el-button v-if="auth.can('account_warmup.edit') && row.status === 'active'" link type="warning" @click="operateMember(row, 'pause')">暂停</el-button><el-button v-if="auth.can('account_warmup.edit') && ['paused', 'abnormal_paused'].includes(row.status)" link type="primary" @click="operateMember(row, 'resume')">恢复</el-button><el-button v-if="auth.can('account_warmup.review') && row.status === 'pending_review'" link type="success" @click="operateMember(row, 'approve')">通过</el-button><el-button v-if="auth.can('account_warmup.review') && row.status === 'pending_review'" link type="warning" @click="operateMember(row, 'reject')">驳回</el-button><el-button v-if="auth.can('account_warmup.edit') && !['removed', 'completed'].includes(row.status)" link type="danger" @click="operateMember(row, 'remove')">移出</el-button></template></el-table-column>
          </el-table>
          <div class="pagination"><el-pagination v-model:current-page="memberPage" :total="memberTotal" :page-size="20" layout="total, prev, pager, next" @change="loadMembers" /></div>
        </el-tab-pane>
        <el-tab-pane label="每日执行记录" name="daily">
          <div class="detail-toolbar"><el-select v-model="dailyStatus" clearable placeholder="执行状态"><el-option label="排队中" value="queued" /><el-option label="成功" value="succeeded" /><el-option label="失败" value="failed" /><el-option label="已取消" value="canceled" /></el-select><el-button type="primary" :icon="Search" @click="dailyPage = 1; loadDailyRuns()">查询</el-button></div>
          <el-table :data="dailyRows" border stripe>
            <el-table-column prop="id" label="记录 ID" width="90" align="center" /><el-table-column prop="account_id" label="账号 ID" width="100" align="center" /><el-table-column prop="warmup_day" label="养号天数" width="100" align="center"><template #default="{ row }">第 {{ row.warmup_day }} 天</template></el-table-column><el-table-column prop="task_run_id" label="任务 ID" width="100" align="center" /><el-table-column label="状态" width="100" align="center"><template #default="{ row }"><el-tag :type="statusTagType(row.status)">{{ row.status }}</el-tag></template></el-table-column><el-table-column label="计入有效日" width="110" align="center"><template #default="{ row }"><el-tag :type="row.counts_as_day ? 'success' : 'info'">{{ row.counts_as_day ? '是' : '否' }}</el-tag></template></el-table-column><el-table-column label="计划时间" width="180" align="center"><template #default="{ row }">{{ formatDate(row.scheduled_at) }}</template></el-table-column><el-table-column label="错误信息" min-width="220" show-overflow-tooltip><template #default="{ row }">{{ row.task_error_message || '-' }}</template></el-table-column>
          </el-table>
          <div class="pagination"><el-pagination v-model:current-page="dailyPage" :total="dailyTotal" :page-size="20" layout="total, prev, pager, next" @change="loadDailyRuns" /></div>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>
  </section>
</template>

<style scoped>
.warmup-page { padding: 20px 24px; }
.workspace-card { border-radius: 6px; }
.page-header, .page-title, .header-actions, .filter-title, .filter-actions, .metric-row, .time-range, .behavior-title, .inline-range, .detail-toolbar { display: flex; align-items: center; }
.page-header { justify-content: space-between; gap: 16px; }
.page-title { gap: 12px; }
.page-title__icon { width: 38px; height: 38px; display: grid; place-items: center; color: #256b9b; background: #eef7fc; border-radius: 6px; }
h1, h3, p { margin: 0; }
h1 { font-size: 20px; color: #17233d; }
.page-title p, .field-help, .subline, .behavior-title p { color: #718096; font-size: 12px; margin-top: 4px; }
.header-actions { gap: 10px; }
.filter-panel { padding: 14px 16px; margin-bottom: 16px; background: #f8fafc; border: 1px solid #e1e8f0; border-radius: 6px; }
.filter-title { gap: 6px; color: #243b53; font-weight: 600; margin-bottom: 12px; }
.filter-grid { display: grid; grid-template-columns: repeat(6, minmax(130px, 1fr)); gap: 12px; }
.filter-actions { gap: 10px; margin-top: 12px; }
.metric-row { justify-content: center; gap: 15px; white-space: nowrap; }
.success { color: #2f8f46; }.danger { color: #d14a4a; }.ml6 { margin-left: 6px; }.ml10 { margin-left: 10px; }
.pagination { display: flex; justify-content: flex-end; padding-top: 14px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 18px; }
.span-2 { grid-column: span 2; }.time-range, .inline-range { gap: 10px; }.switches { display: flex; flex-direction: column; gap: 8px; }
.switch-field { display: flex; align-items: center; gap: 10px; min-height: 32px; color: #334155; }
.target-mode { margin-bottom: 16px; }.target-picker { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
.selector-panel { border: 1px solid #dce5ef; border-radius: 6px; padding: 14px; }.selector-panel h3 { font-size: 14px; margin-bottom: 10px; }
.selector-panel :deep(.account-tree-select) { max-height: none; overflow: hidden; }
.target-selects { padding-top: 10px; }.behavior-list { display: grid; gap: 12px; }
.behavior-rule-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.behavior-item { border: 1px solid #dce5ef; border-radius: 6px; padding: 15px 16px; }.behavior-title { justify-content: space-between; }.behavior-fields { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; padding-top: 14px; border-top: 1px solid #edf1f5; margin-top: 14px; }.behavior-fields label { display: flex; align-items: center; gap: 8px; min-width: 0; color: #52677d; font-size: 13px; white-space: nowrap; }
.behavior-language-filter { display: grid; grid-template-columns: minmax(240px, 0.7fr) minmax(360px, 1.3fr); align-items: center; gap: 20px; }
.behavior-fields--compact { grid-template-columns: minmax(140px, 0.8fr) minmax(230px, 1.2fr); gap: 10px; }
.behavior-fields label :deep(.el-input-number), .behavior-fields label :deep(.el-select) { flex: 1; min-width: 0; width: auto; }
.behavior-fields .inline-range { flex: 1; min-width: 0; }
.behavior-fields .inline-range :deep(.el-input-number) { flex: 1; min-width: 0; width: 0; }
.detail-toolbar { gap: 10px; margin-bottom: 12px; }.detail-toolbar .el-input, .detail-toolbar .el-select { width: 220px; }
@media (max-width: 1200px) { .filter-grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 900px) { .behavior-rule-grid, .behavior-fields, .behavior-language-filter { grid-template-columns: 1fr; } }
</style>
