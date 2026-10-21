<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, Save, Sparkles } from 'lucide-vue-next'
import { accountPersona, personaStatus, type PersonaAnalysis, type PersonaJob, type PersonaVersion } from '@/api/accountPersona'
import AccountPersonaDialog from '@/components/AccountPersonaDialog.vue'
import PersonaJobStatus from '@/components/PersonaJobStatus.vue'
import { languages } from '@/utils/benchmarkPostProcessing'
import { formatDate } from '@/utils/format'
import { jobPersonaAnalysis, latestPersonaJob, personaProgress } from '@/utils/personaAnalysis'

const props = defineProps<{ accountId: string; sourceId: string; sourceName: string; postId: string; revision: string; modelValue: string; disabled: boolean; historyTarget?: string; historyActive?: boolean }>()
const historyVisible = computed(() => props.historyActive !== false)
watch(historyVisible, () => { historySequence++; void load() })
const subjectId = computed(() => `source:${props.sourceId}`)
const emit = defineEmits<{ apply: [text: string, jobId: string]; historyCount: [count: number] }>()
const persona = ref<PersonaVersion | null>(null)
const authorAnalysis = ref<PersonaAnalysis | null>(null)
const jobs = ref<PersonaJob[]>([])
const selectedJob = ref<PersonaJob | null>(null)
const index = ref('0')
const language = ref('zh-CN')
const direction = ref('')
const personaVisible = ref(false)
const busy = ref(false)
const error = ref('')
const historyPage = ref(1)
const historyTotal = ref(0)
const sourceActive = ref(false)
const notice = ref('')
let editorVersion = 0
watch(() => props.modelValue, () => { editorVersion++ }, { flush: 'sync' })
const pending = ref<{ id: string; text: string; editorVersion: number; account: string; post: string; revision: string } | null>(null)
let disposed = false
let sequence = 0
const loading = ref(false)
let reloadPending = false
let historySequence = 0
const selecting = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
const active = computed(() => !!pending.value || (historyVisible.value && (sourceActive.value || jobs.value.some(j => ['queued', 'running'].includes(j.status)))))
const candidates = computed(() => selectedJob.value?.result.candidates || [])
const candidate = computed(() => index.value === 'draft' && selectedJob.value?.draft_text
  ? { title: '人工稿', text_body: selectedJob.value.draft_text, review_notes: '' } : candidates.value[Number(index.value)])
const matchingAccount = computed(() => !!props.accountId && selectedJob.value?.target_account_id === props.accountId)
const currentAnalysis = computed(() => jobPersonaAnalysis(selectedJob.value) || authorAnalysis.value)
const statusText = computed(() => selectedJob.value?.status === 'running' && ['source-author-creation-v3', 'source-author-creation-v4', 'source-author-creation-v5'].includes(selectedJob.value.input?.prompt_version || '')
  ? (selectedJob.value.result.author_analysis ? '生成正文中' : 'AI 分析原作者中') : selectedJob.value ? personaStatus[selectedJob.value.status] : '')
const staleSource = computed(() => !!selectedJob.value?.input?.source_revision && new Date(selectedJob.value.input.source_revision).getTime() !== new Date(props.revision).getTime())
const fail = (e: unknown) => { error.value = e instanceof Error ? e.message : '创作请求未完成' }
async function load() {
  if (disposed) return
  if (loading.value) { reloadPending = true; return }
  loading.value = true
  const request = historySequence
  try {
    if (!historyVisible.value) {
      const history = await accountPersona.history(subjectId.value, { post_id: props.postId,
        target_account_id: props.accountId || undefined, page: 1, page_size: 20, count_only: true })
      if (disposed || request !== historySequence) return
      historyTotal.value = history.total
      emit('historyCount', history.total)
      await fillGeneratedDraft()
      return
    }
    const data = await accountPersona.overview(subjectId.value)
    if (disposed) return
    persona.value = data.versions[0] || null
    authorAnalysis.value = jobPersonaAnalysis(latestPersonaJob(data.jobs))
    sourceActive.value = data.jobs.some(j => ['queued', 'running'].includes(j.status))
    const history = await accountPersona.history(subjectId.value, { post_id: props.postId,
      target_account_id: props.accountId || undefined, page: historyPage.value, page_size: 20 })
    if (disposed || request !== historySequence) return
    jobs.value = history.items
    historyTotal.value = history.total
    emit('historyCount', history.total)
    if (selectedJob.value) {
      const fresh = jobs.value.find(j => j.id === selectedJob.value?.id)
      if (fresh) selectedJob.value = { ...selectedJob.value, status: fresh.status, result: fresh.result,
        usage: fresh.usage, budget: fresh.budget, error_message: fresh.error_message, attempts: fresh.attempts,
        draft_text: fresh.draft_text, draft_version: fresh.draft_version, target_account: fresh.target_account }
    }
    if (!selectedJob.value && !selecting.value && jobs.value[0]) await selectJob(jobs.value[0].id)
    await fillGeneratedDraft()
  } catch (e) { if (!disposed) fail(e) }
  finally { loading.value = false
    if (reloadPending && !disposed) { reloadPending = false; void load() } else schedule() }
}
async function fillGeneratedDraft() {
  const request = pending.value
  if (!request) return
  const result = await accountPersona.job(subjectId.value, request.id)
  if (disposed || pending.value !== request) return
  if (result.status === 'failed') {
    pending.value = null
    error.value = result.error_message || '正文生成失败，请查看创作记录'
    return
  }
  if (result.status !== 'succeeded') return
  pending.value = null
  if (result.input?.prompt_version !== 'source-author-creation-v5') return
  const text = result.result.candidates?.[0]?.text_body
  if (result.id !== request.id || result.kind !== 'generate' || result.account_id !== subjectId.value ||
      result.post_id !== request.post || result.target_account_id !== request.account || result.result.candidates?.length !== 1 || !text?.trim()) {
    error.value = '生成记录与当前创作不一致，请查看创作记录'
    return
  }
  if (props.disabled || editorVersion !== request.editorVersion || props.modelValue !== request.text ||
      props.accountId !== request.account || props.postId !== request.post || props.revision !== request.revision ||
      new Date(result.input.source_revision || '').getTime() !== new Date(props.revision).getTime()) {
    notice.value = '正文已生成并保存；当前编辑内容或状态已变化，请在创作记录中查看并应用。'
    return
  }
  emit('apply', text, result.id)
  ElMessage.success('正文已生成并填入发布稿')
}
function changeHistoryPage(page: number) {
  historyPage.value = page
  historySequence++
  sequence++
  selecting.value = false
  selectedJob.value = null
  void load()
}
function schedule() {
  clearTimeout(timer)
  if (!disposed && (pending.value || (historyVisible.value && active.value))) timer = setTimeout(() => { if (document.hidden) schedule(); else void load() }, 5000)
}
async function selectJob(id: string) {
  const current = ++sequence
  selecting.value = true
  selectedJob.value = null
  index.value = '0'
  try { const result = await accountPersona.job(subjectId.value, id)
    if (!disposed && current === sequence) {
      if (result.post_id !== props.postId || result.account_id !== subjectId.value) throw new Error('创作记录不属于当前原帖')
      selectedJob.value = { ...jobs.value.find(j => j.id === id), ...result }
      index.value = result.draft_text ? 'draft' : '0'
    }
  }
  catch (e) { if (!disposed && current === sequence) fail(e) }
  finally { if (current === sequence) selecting.value = false }
}
async function generate() {
  if (!props.accountId || busy.value || active.value || props.disabled) return
  busy.value = true; error.value = ''; notice.value = ''
  const request = { text: props.modelValue, editorVersion, account: props.accountId, post: props.postId, revision: props.revision }
  try {
    const job = await accountPersona.generate(subjectId.value, { request_key: crypto.randomUUID(), post_id: props.postId, target_account_id: props.accountId,
      persona_id: persona.value?.id, language: language.value, direction: direction.value })
    if (!disposed) { pending.value = { ...request, id: job.id }; historyPage.value = 1; historySequence++; if (historyVisible.value) await selectJob(job.id); await load() }
  } catch (e) { if (!disposed) fail(e) } finally { busy.value = false }
}
async function apply(text: string) {
  if (props.disabled || !selectedJob.value || !matchingAccount.value || selectedJob.value.status !== 'succeeded' || busy.value || staleSource.value) return
  const jobId = selectedJob.value.id
  try { await ElMessageBox.confirm('将所选内容应用到发布正文？当前编辑区中的正文会被替换。', '应用候选稿') } catch { return }
  if (disposed || props.disabled || !matchingAccount.value || staleSource.value || selectedJob.value?.id !== jobId) return
  emit('apply', text, jobId)
}
async function save() {
  const job = selectedJob.value
  if (!job || !matchingAccount.value || job.status !== 'succeeded' || staleSource.value || busy.value || props.disabled || !props.modelValue.trim()) return
  const current = sequence
  busy.value = true; error.value = ''
  try {
    const saved = await accountPersona.save(subjectId.value, job.id, props.modelValue, job.draft_version)
    if (!disposed && current === sequence) { selectedJob.value = { ...job, ...saved }; index.value = 'draft'; ElMessage.success('人工草稿已保存') }
  } catch (e) { if (!disposed) fail(e) } finally { busy.value = false }
}
onMounted(() => { void load() })
onBeforeUnmount(() => { disposed = true; sequence++; historySequence++; clearTimeout(timer) })
</script>

<template>
  <section class="persona-creation">
    <div class="creation-toolbar"><strong>原帖作者 · {{ sourceName }}</strong><el-tag v-if="persona" type="info">参考人设 v{{ persona.version }}</el-tag>
      <el-tag v-if="currentAnalysis" type="success">AI 已分析</el-tag>
      <el-button :icon="Sparkles" :disabled="disabled" @click="personaVisible = true">作者 AI 人设</el-button></div>
    <p v-if="currentAnalysis || persona" class="persona-summary">{{ persona?.document.positioning || currentAnalysis?.suggested_persona.positioning }}</p>
    <el-form label-position="top" :disabled="disabled || busy">
      <el-form-item label="本次创作方向"><el-input v-model="direction" :maxlength="1000" type="textarea" :rows="2" /></el-form-item>
      <div class="creation-toolbar"><el-select v-model="language" aria-label="创作语言"><el-option v-for="(name, code) in languages" :key="code" :value="code" :label="name" /></el-select>
        <el-button type="primary" :icon="Sparkles" :loading="busy" :disabled="!accountId || active" @click="generate">{{ active ? '创作处理中' : historyTotal ? '重新生成' : 'AI 创作' }}</el-button></div>
    </el-form>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-alert v-if="notice" :title="notice" type="info" :closable="false" />
    <Teleport :to="historyTarget || 'body'" :disabled="!historyTarget" defer>
    <section v-if="historyVisible" class="persona-creation creation-history">
    <el-alert v-if="historyTarget && error" :title="error" type="error" :closable="false" />
    <div class="creation-toolbar"><strong>创作记录<span v-if="historyTotal">（{{ historyTotal }}）</span></strong>
      <el-select v-if="jobs.length" :loading="loading || selecting" :model-value="selectedJob?.id || ''" aria-label="生成记录" placeholder="生成记录" @change="selectJob">
        <el-option v-for="job in jobs" :key="job.id" :value="job.id" :label="`${formatDate(job.created_at)} · ${job.target_account?.name || job.target_account_id} · ${personaStatus[job.status]}`" /></el-select>
      <el-pagination v-if="historyTotal > 20" small layout="prev, pager, next" :total="historyTotal" :page-size="20" :current-page="historyPage" @current-change="changeHistoryPage" />
    </div>
    <p v-if="loading && !jobs.length" role="status">加载创作记录中</p>
    <el-empty v-if="!jobs.length && !loading && !error" description="暂无创作记录" :image-size="48" />
    <template v-if="selectedJob">
      <small>发布账号：{{ selectedJob.target_account?.name || selectedJob.target_account_id }} · {{ formatDate(selectedJob.created_at) }}</small>
      <p role="status">{{ statusText }} · 第 {{ selectedJob.attempts }} 次处理</p>
      <p v-if="personaProgress(selectedJob)" role="status">{{ personaProgress(selectedJob) }}</p>
      <PersonaJobStatus :key="selectedJob.id" :job="selectedJob" :can-resume="!disabled && !active" @resumed="selectedJob = $event; load()" />
      <el-tag v-if="selectedJob.result.analysis_reference && selectedJob.result.analysis_reference.job_id !== selectedJob.id" type="info">已复用作者画像</el-tag>
      <el-tag v-if="selectedJob.input?.persona" type="info">本次参考作者人设 v{{ selectedJob.input.persona.version }}</el-tag>
      <el-alert v-if="staleSource" title="原帖已更新，此记录仅供查看，请重新生成" type="warning" :closable="false" />
      <el-alert v-if="selectedJob.error_message" :title="selectedJob.error_message" :type="selectedJob.status === 'failed' ? 'error' : 'warning'" :closable="false" />
      <el-tabs v-if="candidates.length > 1" v-model="index"><el-tab-pane v-for="(item, i) in candidates" :key="i" :name="String(i)" :label="item.title" /><el-tab-pane v-if="selectedJob.draft_text" name="draft" label="人工稿" /></el-tabs>
      <div v-else-if="candidate" class="creation-toolbar"><strong>{{ index === 'draft' ? '人工稿' : '生成正文' }}</strong>
        <el-button v-if="selectedJob.draft_text && candidates.length" link type="primary" @click="index = index === 'draft' ? '0' : 'draft'">{{ index === 'draft' ? '查看生成原稿' : '查看人工稿' }}</el-button></div>
      <div v-if="candidate" class="candidate"><p>{{ candidate.text_body }}</p><el-alert v-if="candidate.review_notes" :title="candidate.review_notes" type="warning" :closable="false" />
        <div class="creation-toolbar"><el-button :icon="Check" :disabled="disabled || busy || staleSource || !matchingAccount || selectedJob.status !== 'succeeded'" @click="apply(candidate.text_body)">{{ index === 'draft' ? '应用人工稿' : candidates.length === 1 ? '应用正文' : '应用候选稿' }}</el-button>
          <el-button :icon="Save" :disabled="disabled || busy || staleSource || !matchingAccount || selectedJob.status !== 'succeeded' || !modelValue.trim()" @click="save">保存当前发布稿</el-button>
          <el-button v-if="selectedJob.draft_text && index !== 'draft'" :disabled="disabled || busy || staleSource || !matchingAccount" @click="apply(selectedJob.draft_text)">恢复已存草稿</el-button></div></div>
      <small v-for="(usage, i) in selectedJob.usage" :key="i">{{ usage.model }} · Token {{ usage.total_tokens ?? '未返回' }}<template v-if="usage.cost !== null"> · {{ usage.cost }} {{ usage.currency }}</template></small>
    </template>
    </section>
    </Teleport>
    <AccountPersonaDialog v-if="personaVisible" :account-id="subjectId" :account-name="sourceName" @close="personaVisible = false" @confirmed="load" />
  </section>
</template>

<style scoped>
.persona-creation { border-top: 1px solid var(--app-border); margin-top: 16px; padding-top: 14px; min-width: 0; }
.creation-history { border-top: 0; margin-top: 0; padding-top: 0; }
.creation-toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 10px 0; }
.creation-toolbar .el-select { width: 240px; max-width: 100%; }
.creation-toolbar :deep(.el-button) { margin-left: 0; }
.creation-toolbar strong { overflow-wrap: anywhere; }
.persona-summary { color: var(--app-text-muted); max-height: 70px; overflow: auto; }
.candidate > p { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.7; max-height: 280px; overflow: auto; }
.persona-creation small { display: block; color: var(--app-text-muted); }
.persona-creation :deep(.el-alert__title) { overflow-wrap: anywhere; }
</style>
