<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { Pencil, Plus, RefreshCw, Unlink, UserRound } from 'lucide-vue-next'
import { ElMessageBox, ElNotification } from 'element-plus'
import { http } from '@/api/http'
import { externalAvatarUrl } from '@/utils/externalAvatar'
import ExternalAccountDetail from './ExternalAccountDetail.vue'
import type { AnyRecord } from '@/types/api'
import type { ExternalMonitor, ExternalPersona } from '@/types/externalMonitor'

const props = defineProps<{ monitorId: string; canEdit: boolean; revision: number }>()
const emit = defineEmits<{ link: [row: ExternalMonitor]; edit: [row: ExternalMonitor]; changed: [] }>()
const accounts = ref<ExternalMonitor[]>([])
const persona = ref<ExternalPersona | null>(null)
const selected = ref('')
type AccountDetail = InstanceType<typeof ExternalAccountDetail>['$props']['detail']
const detail = ref<AccountDetail | null>(null)
const page = ref(1)
const loading = ref(false)
const contextLoading = ref(false)
const busy = ref(false)
const error = ref('')
let contextSequence = 0
let detailSequence = 0
let disposed = false
function name(row: { profile?: AnyRecord; profile_url: string }) { return row.profile?.display_name || row.profile?.username || row.profile_url }
function platform(value: string) { return value === 'x' ? 'X(Twitter)' : value === 'instagram' ? 'Instagram' : 'Threads' }
async function loadDetail() {
  const request = ++detailSequence
  loading.value = true
  detail.value = null
  error.value = ''
  try {
    const result = await http.get<AccountDetail>(`/api/external-account-monitors/${selected.value}`, { page: page.value, page_size: 20 })
    if (!disposed && request === detailSequence) detail.value = result
  } catch (e) { if (!disposed && request === detailSequence) error.value = e instanceof Error ? e.message : '加载数据失败' }
  finally { if (request === detailSequence) loading.value = false }
}
function choose(id: string) { if (selected.value === id) return; selected.value = id; page.value = 1; void loadDetail() }
async function refresh() {
  const request = ++contextSequence
  ++detailSequence
  contextLoading.value = true
  detail.value = null
  loading.value = false
  error.value = ''
  try {
    const result = await http.get<{ persona: ExternalPersona | null; accounts: ExternalMonitor[] }>(`/api/external-account-monitors/${props.monitorId}/persona`)
    if (disposed || request !== contextSequence) return
    persona.value = result.persona
    accounts.value = result.accounts
    selected.value = result.accounts.some(row => row.id === selected.value) ? selected.value : props.monitorId
    page.value = 1
    await loadDetail()
  } catch (e) { if (!disposed && request === contextSequence) error.value = e instanceof Error ? e.message : '加载形象失败' }
  finally { if (request === contextSequence) contextLoading.value = false }
}
async function rename() {
  if (busy.value || !persona.value) return
  const current = persona.value
  busy.value = true
  try {
    const { value } = await ElMessageBox.prompt('形象名称', '修改形象名称', { inputValue: current.name, inputValidator: value => !!value?.trim() && value.trim().length <= 80 || '请输入 1 到 80 个字符', confirmButtonText: '保存', cancelButtonText: '取消' })
    await http.put(`/api/external-account-monitors/${props.monitorId}/persona`, { name: value.trim(), expected_version: current.version })
    await refresh()
    emit('changed')
  } catch (e) { if (e !== 'cancel' && e !== 'close') ElNotification.error({ title: '修改失败', message: e instanceof Error ? e.message : '请刷新重试' }) }
  finally { busy.value = false }
}
async function detach() {
  const row = detail.value?.monitor
  if (busy.value || !row) return
  busy.value = true
  try {
    await ElMessageBox.confirm(`将“${name(row)}”恢复为独立账号？监听、标签、国家和采集数据均保留。`, '解除形象关联', { type: 'warning', confirmButtonText: '解除关联', cancelButtonText: '取消' })
    const version = accounts.value.find(account => account.id === row.id)?.version
    if (!version) throw new Error('账号版本已变化，请刷新后重试')
    await http.delete(`/api/external-account-monitors/${row.id}/association?expected_version=${version}`)
    selected.value = ''
    await refresh()
    emit('changed')
  } catch (e) { if (e !== 'cancel' && e !== 'close') ElNotification.error({ title: '解除关联失败', message: e instanceof Error ? e.message : '请刷新重试' }) }
  finally { busy.value = false }
}
watch(() => [props.monitorId, props.revision], () => { selected.value = ''; detail.value = null; accounts.value = []; persona.value = null; void refresh() }, { immediate: true })
onBeforeUnmount(() => { disposed = true; ++contextSequence; ++detailSequence })
defineExpose({ refresh })
</script>

<template>
  <section class="persona-detail">
    <header class="persona-header">
      <h2 v-if="persona">{{ persona.name }}</h2>
      <span v-if="persona">{{ accounts.length }} 个账号</span>
      <el-tooltip v-if="persona && canEdit" content="修改形象名称"><el-button :icon="Pencil" circle aria-label="修改形象名称" :disabled="busy || contextLoading" @click="rename" /></el-tooltip>
      <el-button :icon="RefreshCw" :loading="contextLoading || loading" :disabled="busy" @click="refresh">刷新</el-button>
    </header>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <div class="persona-body" :class="{ 'has-peers': accounts.length > 1 }" v-loading="contextLoading">
      <nav v-if="accounts.length > 1" class="persona-accounts" aria-label="形象旗下账号">
        <button v-for="row in accounts" :key="row.id" :class="{ 'is-active': selected === row.id }" :aria-current="selected === row.id ? 'true' : undefined" :disabled="busy" @click="choose(row.id)">
          <el-avatar :size="36" :src="externalAvatarUrl(row.profile?.avatar_url)"><UserRound :size="18" /></el-avatar>
          <span><strong>{{ name(row) }}</strong><small>{{ platform(row.business_platform) }} · {{ row.profile?.username || row.profile_url.split('/').pop() }}</small></span>
        </button>
      </nav>
      <main v-loading="loading" class="persona-content">
        <div v-if="canEdit && detail" class="persona-actions">
          <el-button :icon="Plus" :disabled="busy || loading" @click="emit('link', accounts.find(row => row.id === selected)!)">添加关联账号</el-button>
          <el-button :icon="Pencil" :disabled="busy || loading" @click="emit('edit', accounts.find(row => row.id === selected)!)">监听设置</el-button>
          <el-button v-if="persona" :icon="Unlink" :disabled="busy || loading" @click="detach">解除关联</el-button>
        </div>
        <ExternalAccountDetail v-if="detail" :detail="detail" :page="page" @update:page="page = $event; loadDetail()" />
      </main>
    </div>
  </section>
</template>

<style scoped>
.persona-header { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid var(--el-border-color-lighter); }
.persona-header h2 { margin: 0; font-size: 18px; overflow-wrap: anywhere; min-width: 0; }
.persona-header > span { color: var(--el-text-color-secondary); font-size: 13px; }
.persona-header > .el-button:last-child { margin-left: auto; }
.persona-body { display: grid; min-height: 320px; padding-top: 16px; gap: 20px; }
.persona-body.has-peers { grid-template-columns: 210px minmax(0, 1fr); }
.persona-accounts { border-right: 1px solid var(--el-border-color-lighter); padding-right: 12px; max-height: 60vh; overflow-y: auto; }
.persona-accounts button { display: flex; width: 100%; align-items: center; gap: 10px; padding: 12px 8px; border: 0; border-bottom: 1px solid var(--el-border-color-lighter); background: transparent; text-align: left; cursor: pointer; color: var(--el-text-color-primary); }
.persona-accounts button.is-active { background: var(--el-color-primary-light-9); box-shadow: inset 3px 0 var(--el-color-primary); }
.persona-accounts button:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: -2px; }
.persona-accounts .el-avatar { flex-shrink: 0; }
.persona-accounts button > span:last-child { min-width: 0; }
.persona-accounts strong, .persona-accounts small { display: block; overflow-wrap: anywhere; }
.persona-accounts small { color: var(--el-text-color-secondary); font-size: 12px; margin-top: 4px; }
.persona-content { min-width: 0; }
.persona-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; margin-bottom: 16px; }
.persona-actions .el-button { margin-left: 0; }
@media(max-width: 800px) { .persona-body.has-peers { grid-template-columns: minmax(0,1fr); } .persona-accounts { display: flex; gap: 8px; border-right: 0; overflow-x: auto; max-height: 150px; } .persona-accounts button { flex: 0 0 210px; } }
</style>
