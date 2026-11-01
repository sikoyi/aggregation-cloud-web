<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { Search } from 'lucide-vue-next'
import { ElNotification } from 'element-plus'
import { http } from '@/api/http'
import { useScopedBusinessPlatformOptions } from '@/composables/useScopedBusinessPlatformOptions'
import { useAuthStore } from '@/stores/auth'
import { canMaintainExternalMonitor, canManageExternalPersona, externalMonitorOperatorLabel } from '@/utils/externalMonitorOperator'
import type { AnyRecord } from '@/types/api'
import type { ExternalMonitor, ExternalMonitorContext, ExternalPersona } from '@/types/externalMonitor'

const emit = defineEmits<{ changed: []; busy: [value: boolean] }>()
const auth = useAuthStore()
const visible = ref(false)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const anchor = ref<ExternalMonitor | null>(null)
const association = ref<ExternalPersona | null>(null)
const accounts = ref<ExternalMonitor[]>([])
const manageAllowed = ref<boolean | undefined>(undefined)
const canManage = computed(() => auth.can('operations.edit') && (auth.isSuperAdmin || (manageAllowed.value !== false && accounts.value.length > 0 && accounts.value.every(canMaintain))))
const mode = ref('existing')
const form = reactive({ name: '', platform: 'threads', profile_url: '', interval_minutes: 720 })
const keyword = ref('')
const candidates = ref<ExternalMonitor[]>([])
const selected = ref<ExternalMonitor[]>([])
const page = ref(1)
const total = ref(0)
const searching = ref(false)
const platforms = useScopedBusinessPlatformOptions([{ label: 'Threads', value: 'threads' }, { label: 'X(Twitter)', value: 'x' }, { label: 'Instagram', value: 'instagram' }])
let sequence = 0
let candidateSequence = 0
function label(row: AnyRecord) { const account = row as ExternalMonitor; return account.profile?.display_name || account.profile?.username || account.profile_url }
function platformLabel(value: string) { return value === 'x' ? 'X(Twitter)' : value === 'instagram' ? 'Instagram' : 'Threads' }
function canMaintain(row: ExternalMonitor) { return !row.is_persona && canMaintainExternalMonitor(row, auth) }
function selectCandidates(rows: ExternalMonitor[]) { selected.value = rows.filter(canMaintain) }
async function search() {
  if (!anchor.value || !canManage.value || saving.value) return
  const request = ++candidateSequence
  const current = sequence
  searching.value = true
  selected.value = []
  candidates.value = []
  try {
    const data = await http.get<{ items: ExternalMonitor[]; total: number }>(`/api/external-account-monitors/${anchor.value!.id}/association-candidates`, { keyword: keyword.value, page: page.value, page_size: 20 })
    if (request !== candidateSequence || current !== sequence || !visible.value) return
    candidates.value = data.items.filter(row => row.id !== anchor.value?.id)
    total.value = data.total
  } catch (e) { if (request === candidateSequence && current === sequence) error.value = e instanceof Error ? e.message : '加载账号失败' }
  finally { if (request === candidateSequence) searching.value = false }
}
async function open(row: AnyRecord) {
  const account = row as ExternalMonitor
  if (saving.value || !auth.can('operations.edit') || !canManageExternalPersona(account, auth)) return
  const current = ++sequence
  anchor.value = account.is_persona ? account.children?.[0] || null : account
  if (!anchor.value) return
  accounts.value = []
  manageAllowed.value = undefined
  visible.value = true
  loading.value = true
  error.value = ''
  mode.value = 'existing'
  association.value = null
  keyword.value = ''
  candidates.value = []
  selected.value = []
  page.value = 1
  Object.assign(form, { name: '', platform: platforms.value[0]?.value || 'threads', profile_url: '', interval_minutes: 720 })
  try {
    const result = await http.get<ExternalMonitorContext>(`/api/external-account-monitors/${anchor.value!.id}/persona`)
    if (current !== sequence || !visible.value) return
    anchor.value = result.accounts.find(account => account.id === anchor.value?.id) || null
    accounts.value = result.accounts
    manageAllowed.value = result.can_manage_persona
    association.value = result.association || result.persona || null
    form.name = association.value?.name || ''
    if (!anchor.value || !canManage.value) { error.value = '无权维护此形象的关联账号'; return }
    await search()
  } catch (e) { if (current === sequence) error.value = e instanceof Error ? e.message : '加载账号失败' }
  finally { if (current === sequence) loading.value = false }
}
async function save() {
  if (saving.value || loading.value || searching.value || !canManage.value || !anchor.value || !canMaintain(anchor.value) || (!association.value && !form.name.trim())) return
  if (mode.value === 'existing' ? !selected.value.length : !form.profile_url.trim()) return
  if (mode.value === 'existing' && selected.value.some(row => !canMaintain(row))) return
  saving.value = true
  error.value = ''
  try {
    await http.post(`/api/external-account-monitors/${anchor.value.id}/associations`, {
      expected_version: anchor.value.version, expected_persona_version: association.value?.version || null,
      name: form.name.trim() || null,
      ...(mode.value === 'existing' ? { existing_items: selected.value.map(row => ({ id: row.id, expected_version: row.version })) }
        : { new_account: { business_platform: form.platform, profile_url: form.profile_url.trim(), interval_minutes: form.interval_minutes } }),
    })
    visible.value = false
    ElNotification.success({ title: mode.value === 'existing' ? '已关联，沿用原监听记录' : '已添加关联账号' })
    emit('changed')
  } catch (e) { error.value = e instanceof Error ? e.message : '关联失败，请刷新后重试' }
  finally { saving.value = false }
}
watch(visible, value => { emit('busy', value); if (!value) { ++sequence; ++candidateSequence } })
onBeforeUnmount(() => { ++sequence; ++candidateSequence })
defineExpose({ open })
</script>

<template>
  <el-dialog v-model="visible" title="添加关联账号" width="min(740px, 96vw)" append-to-body :close-on-click-modal="false" :close-on-press-escape="!saving" :show-close="!saving" destroy-on-close>
    <div v-loading="loading" class="association-form">
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <el-form label-position="top" :disabled="saving || loading || !canManage" @submit.prevent="save">
        <el-form-item label="当前账号"><span>{{ anchor ? label(anchor) : '-' }}</span></el-form-item>
        <el-form-item label="操作员"><span>{{ anchor ? externalMonitorOperatorLabel(anchor) : '-' }}</span></el-form-item>
        <el-form-item label="形象名称" required><el-input v-model="form.name" :disabled="!!association" maxlength="80" /></el-form-item>
        <el-radio-group v-model="mode"><el-radio-button value="existing">关联已有账号</el-radio-button><el-radio-button value="new">新增监听账号</el-radio-button></el-radio-group>
        <template v-if="mode === 'new'">
          <el-form-item label="业务 App" required><el-select v-model="form.platform"><el-option v-for="item in platforms" :key="String(item.value)" :label="item.label" :value="item.value" /></el-select></el-form-item>
          <el-form-item label="账号主页链接" required><el-input v-model="form.profile_url" /></el-form-item>
          <el-form-item label="操作员"><el-input :model-value="auth.displayName" disabled /></el-form-item>
          <el-form-item label="监听间隔（分钟）"><el-input-number v-model="form.interval_minutes" :min="1" :max="1440" /></el-form-item>
        </template>
      </el-form>
      <template v-if="mode === 'existing'">
        <div class="association-search"><el-input v-model="keyword" placeholder="账号 / 主页 / 备注" clearable :disabled="saving || !canManage" @keyup.enter="page = 1; search()" /><el-button :icon="Search" :disabled="saving || !canManage" :loading="searching" @click="page = 1; search()">查询</el-button></div>
        <el-table v-loading="searching" :data="candidates" row-key="id" max-height="300" border empty-text="没有可关联的独立账号" @selection-change="selectCandidates">
          <el-table-column type="selection" width="44" :selectable="(row: ExternalMonitor) => !saving && !searching && canManage && canMaintain(row)" />
          <el-table-column label="账号" min-width="220"><template #default="{ row }"><strong>{{ label(row) }}</strong><div class="association-url">{{ row.profile_url }}</div></template></el-table-column>
          <el-table-column label="平台" width="110"><template #default="{ row }">{{ platformLabel(row.business_platform) }}</template></el-table-column>
          <el-table-column label="操作员" min-width="140" show-overflow-tooltip><template #default="{ row }">{{ externalMonitorOperatorLabel(row as ExternalMonitor) }}</template></el-table-column>
        </el-table>
        <el-pagination v-model:current-page="page" :disabled="saving || searching || !canManage" :total="total" :page-size="20" layout="total, prev, pager, next" @current-change="search" />
      </template>
    </div>
    <template #footer><el-button :disabled="saving" @click="visible = false">取消</el-button><el-button type="primary" :loading="saving" :disabled="loading || searching || !canManage || !anchor || (!association && !form.name.trim()) || (mode === 'existing' ? !selected.length || selected.some(row => !canMaintain(row)) : !form.profile_url.trim())" @click="save">确认关联</el-button></template>
  </el-dialog>
</template>

<style scoped>
.association-form { min-height: 200px; }
.association-search { display: flex; gap: 8px; margin: 14px 0; }
.association-url { font-size: 12px; color: var(--el-text-color-secondary); overflow-wrap: anywhere; }
.el-radio-group { margin-bottom: 16px; }
.el-pagination { margin-top: 12px; overflow-x: auto; }
</style>
