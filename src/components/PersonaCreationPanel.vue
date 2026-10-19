<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, Save, Sparkles } from 'lucide-vue-next'
import { accountPersona, personaStatus, type PersonaAnalysis, type PersonaJob, type PersonaVersion } from '@/api/accountPersona'
import AccountPersonaDialog from '@/components/AccountPersonaDialog.vue'
import { languages } from '@/utils/benchmarkPostProcessing'
import { formatDate } from '@/utils/format'
import { jobPersonaAnalysis } from '@/utils/personaAnalysis'

const props = defineProps<{ accountId: string; sourceId: string; sourceName: string; postId: string; revision: string; modelValue: string; disabled: boolean }>()
const subjectId = computed(() => `source:${props.sourceId}`)
const emit = defineEmits<{ apply: [text: string, jobId: string] }>()
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
let disposed = false
let sequence = 0
let loading = false
let timer: ReturnType<typeof setTimeout> | undefined
const active = computed(() => jobs.value.some(j => ['queued', 'running'].includes(j.status)))
const candidates = computed(() => selectedJob.value?.result.candidates || [])
const candidate = computed(() => candidates.value[Number(index.value)])
const currentAnalysis = computed(() => jobPersonaAnalysis(selectedJob.value) || authorAnalysis.value)
const statusText = computed(() => selectedJob.value?.status === 'running' && selectedJob.value.input?.prompt_version === 'source-author-creation-v3'
  ? (selectedJob.value.result.author_analysis ? '生成候选稿中' : 'AI 分析原作者中') : selectedJob.value ? personaStatus[selectedJob.value.status] : '')
const staleSource = computed(() => !!selectedJob.value?.input?.source_revision && new Date(selectedJob.value.input.source_revision).getTime() !== new Date(props.revision).getTime())
const fail = (e: unknown) => { error.value = e instanceof Error ? e.message : '创作请求未完成' }
async function load() {
  if (disposed || loading) return
  loading = true
  try {
    const data = await accountPersona.overview(subjectId.value)
    if (disposed) return
    persona.value = data.versions[0] || null
    authorAnalysis.value = data.jobs.map(jobPersonaAnalysis).find((value): value is PersonaAnalysis => !!value) || null
    jobs.value = data.jobs.filter(j => j.kind === 'generate' && j.post_id === props.postId && j.target_account_id === props.accountId)
    if (selectedJob.value) {
      const fresh = jobs.value.find(j => j.id === selectedJob.value?.id)
      if (fresh) selectedJob.value = { ...selectedJob.value, status: fresh.status, result: fresh.result,
        usage: fresh.usage, error_message: fresh.error_message, attempts: fresh.attempts }
    }
  } catch (e) { if (!disposed) fail(e) }
  finally { loading = false; schedule() }
}
function schedule() {
  clearTimeout(timer)
  if (!disposed) timer = setTimeout(() => { if (document.hidden) schedule(); else void load() }, 5000)
}
async function selectJob(id: string) {
  const current = ++sequence
  selectedJob.value = null
  index.value = '0'
  try { const result = await accountPersona.job(subjectId.value, id); if (!disposed && current === sequence) selectedJob.value = result }
  catch (e) { if (!disposed && current === sequence) fail(e) }
}
async function generate() {
  if (!props.accountId || busy.value || active.value || props.disabled) return
  busy.value = true; error.value = ''
  try {
    const job = await accountPersona.generate(subjectId.value, { request_key: crypto.randomUUID(), post_id: props.postId, target_account_id: props.accountId,
      persona_id: persona.value?.id, language: language.value, direction: direction.value })
    if (!disposed) { await selectJob(job.id); await load() }
  } catch (e) { if (!disposed) fail(e) } finally { busy.value = false }
}
async function apply(text: string) {
  if (props.disabled || !selectedJob.value || busy.value || staleSource.value) return
  const jobId = selectedJob.value.id
  try { await ElMessageBox.confirm('将所选内容应用到发布正文？当前编辑区中的正文会被替换。', '应用候选稿') } catch { return }
  if (disposed || props.disabled || staleSource.value || selectedJob.value?.id !== jobId) return
  emit('apply', text, jobId)
}
async function save() {
  const job = selectedJob.value
  if (!job || busy.value || props.disabled || !props.modelValue.trim()) return
  const current = sequence
  busy.value = true; error.value = ''
  try {
    const saved = await accountPersona.save(subjectId.value, job.id, props.modelValue, job.draft_version)
    if (!disposed && current === sequence) { selectedJob.value = { ...job, ...saved }; ElMessage.success('人工草稿已保存') }
  } catch (e) { if (!disposed) fail(e) } finally { busy.value = false }
}
onMounted(() => { void load() })
onBeforeUnmount(() => { disposed = true; sequence++; clearTimeout(timer) })
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
        <el-button type="primary" :icon="Sparkles" :loading="busy" :disabled="!accountId || active" @click="generate">{{ active ? '创作处理中' : 'AI 创作' }}</el-button></div>
    </el-form>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <div v-if="jobs.length" class="creation-toolbar"><el-select :model-value="selectedJob?.id || ''" aria-label="生成记录" placeholder="生成记录" @change="selectJob">
      <el-option v-for="job in jobs" :key="job.id" :value="job.id" :label="`${formatDate(job.created_at)} · ${personaStatus[job.status]}`" /></el-select></div>
    <template v-if="selectedJob">
      <p role="status">{{ statusText }} · 第 {{ selectedJob.attempts }} 次处理</p>
      <el-tag v-if="selectedJob.input?.persona" type="info">本次参考作者人设 v{{ selectedJob.input.persona.version }}</el-tag>
      <el-alert v-if="staleSource" title="原帖已更新，此记录仅供查看，请重新生成" type="warning" :closable="false" />
      <el-alert v-if="selectedJob.error_message" :title="selectedJob.error_message" type="warning" :closable="false" />
      <el-tabs v-if="candidates.length" v-model="index"><el-tab-pane v-for="(item, i) in candidates" :key="i" :name="String(i)" :label="item.title" /></el-tabs>
      <div v-if="candidate" class="candidate"><p>{{ candidate.text_body }}</p><el-alert v-if="candidate.review_notes" :title="candidate.review_notes" type="warning" :closable="false" />
        <div class="creation-toolbar"><el-button :icon="Check" :disabled="disabled || busy || staleSource" @click="apply(candidate.text_body)">应用候选稿</el-button>
          <el-button :icon="Save" :disabled="disabled || busy || !modelValue.trim()" @click="save">保存当前发布稿</el-button>
          <el-button v-if="selectedJob.draft_text" :disabled="disabled || busy || staleSource" @click="apply(selectedJob.draft_text)">恢复已存草稿</el-button></div></div>
      <small v-for="(usage, i) in selectedJob.usage" :key="i">{{ usage.model }} · Token {{ usage.total_tokens ?? '未返回' }}<template v-if="usage.cost !== null"> · {{ usage.cost }} {{ usage.currency }}</template></small>
    </template>
    <AccountPersonaDialog v-if="personaVisible" :account-id="subjectId" :account-name="sourceName" @close="personaVisible = false" @confirmed="load" />
  </section>
</template>

<style scoped>
.persona-creation { border-top: 1px solid var(--app-border); margin-top: 16px; padding-top: 14px; min-width: 0; }
.creation-toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 10px 0; }
.creation-toolbar .el-select { width: 240px; max-width: 100%; }
.creation-toolbar :deep(.el-button) { margin-left: 0; }
.creation-toolbar strong { overflow-wrap: anywhere; }
.persona-summary { color: var(--app-text-muted); max-height: 70px; overflow: auto; }
.candidate > p { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.7; max-height: 280px; overflow: auto; }
.persona-creation small { display: block; color: var(--app-text-muted); }
</style>
