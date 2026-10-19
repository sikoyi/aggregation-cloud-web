<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { Check, RefreshCw, Sparkles } from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import { accountPersona, emptyPersona, personaFields, personaStatus, type PersonaJob, type PersonaVersion } from '@/api/accountPersona'
import { useAuthStore } from '@/stores/auth'
import { formatDate } from '@/utils/format'
import { safeSelectionLink } from '@/utils/contentSelection'
import { jobPersonaAnalysis, personaProgress } from '@/utils/personaAnalysis'

const props = defineProps<{ accountId: string; accountName?: string }>()
const emit = defineEmits<{ close: []; confirmed: [] }>()
const auth = useAuthStore()
const tab = ref('persona')
const versions = ref<PersonaVersion[]>([])
const jobs = ref<PersonaJob[]>([])
const detail = ref<PersonaJob | null>(null)
const document = reactive(emptyPersona())
const baseVersion = ref(0)
const analysisId = ref<string | null>(null)
const busy = ref(false)
const error = ref('')
const selectedVersion = ref('')
const dirty = ref(false)
const hasDocument = ref(false)
let prefilledKey = ''
let disposed = false
let timer: ReturnType<typeof setTimeout> | undefined
let loading = false
let detailSequence = 0
const isSource = computed(() => props.accountId.startsWith('source:'))
const canEdit = computed(() => auth.can(isSource.value ? 'operations.dispatch' : 'accounts.edit'))
const active = computed(() => jobs.value.some(j => (j.kind === 'analyze' || isSource.value) && ['queued', 'running'].includes(j.status)))
const analysisJobs = computed(() => jobs.value.filter(j => j.kind === 'analyze' || !!jobPersonaAnalysis(j)))
const detailAnalysis = computed(() => jobPersonaAnalysis(detail.value))
const evidencePosts = computed(() => {
  const input = detail.value?.input
  const post = input?.post
  return [...(input?.posts || []), ...(post ? [{ id: post.id, content_url: post.content_url,
    text_content: post.text_body.slice(0, 1500), truncated: post.text_body.length > 1500 }] : [])]
})
const fail = (e: unknown) => { error.value = e instanceof Error ? e.message : '加载失败，请重试' }
function prefill(initial: boolean) {
  const version = versions.value[0]
  const latest = jobs.value.find(j => !!jobPersonaAnalysis(j))
  const analysis = jobPersonaAnalysis(latest)
  const preferAI = isSource.value && latest && analysis && (!version || new Date(latest.created_at).getTime() >= new Date(version.created_at).getTime())
  const key = preferAI ? `analysis:${latest.id}` : version?.id || ''
  if (!key || (!initial && (!isSource.value || dirty.value || prefilledKey === key || (hasDocument.value && baseVersion.value !== (version?.version || 0))))) return
  Object.assign(document, emptyPersona(), preferAI ? analysis.suggested_persona : version!.document)
  analysisId.value = preferAI ? latest.id : version!.analysis_job_id
  baseVersion.value = version?.version || 0
  hasDocument.value = true
  prefilledKey = key
}
async function load(initial = false) {
  if (loading || disposed) return
  loading = true
  try {
    const data = await accountPersona.overview(props.accountId)
    if (disposed) return
    versions.value = data.versions
    jobs.value = data.jobs
    if (detail.value) {
      const current = data.jobs.find(j => j.id === detail.value?.id)
      if (current) detail.value = { ...detail.value, ...current }
    }
    prefill(initial)
  } catch (e) { if (!disposed) fail(e) }
  finally {
    loading = false
    clearTimeout(timer)
    schedule()
  }
}
function documentHidden() { return window.document.hidden }
function schedule() {
  clearTimeout(timer)
  if (!disposed) timer = setTimeout(() => { if (documentHidden()) schedule(); else void load() }, 5000)
}
async function analyze() {
  if (busy.value || active.value) return
  busy.value = true; error.value = ''
  try {
    const job = await accountPersona.analyze(props.accountId, crypto.randomUUID())
    if (!disposed) { tab.value = 'analysis'; await inspect(job.id); await load(); ElMessage.success('画像分析已加入队列') }
  } catch (e) { if (!disposed) fail(e) } finally { busy.value = false }
}
async function inspect(id: string) {
  const sequence = ++detailSequence
  detail.value = null
  try { const result = await accountPersona.job(props.accountId, id); if (!disposed && sequence === detailSequence) detail.value = result }
  catch (e) { if (!disposed && sequence === detailSequence) fail(e) }
}
async function useAnalysis() {
  if (!detail.value || !detailAnalysis.value) return
  const job = detail.value
  const analysis = detailAnalysis.value
  try { await ElMessageBox.confirm('将画像建议填入当前编辑区？尚未确认的人设修改会被替换，已确认版本不受影响。', '采用画像建议') } catch { return }
  if (disposed || detail.value?.id !== job.id) return
  Object.assign(document, emptyPersona(), analysis.suggested_persona)
  analysisId.value = job.id
  hasDocument.value = true
  dirty.value = true
  prefilledKey = `analysis:${job.id}`
  tab.value = 'persona'
}
async function useVersion() {
  const version = versions.value.find(v => v.id === selectedVersion.value)
  if (!version) return
  try { await ElMessageBox.confirm('将所选历史版本载入编辑区？尚未确认的修改会被替换。', '载入历史人设') } catch { return }
  if (disposed) return
  Object.assign(document, version.document)
  analysisId.value = version.analysis_job_id
  hasDocument.value = true
  dirty.value = true
  tab.value = 'persona'
}
async function confirm() {
  if (busy.value || !document.positioning.trim()) return
  busy.value = true; error.value = ''
  try {
    const result = await accountPersona.confirm(props.accountId, { expected_version: baseVersion.value, document: { ...document }, analysis_job_id: analysisId.value })
    if (disposed) return
    baseVersion.value = result.version
    dirty.value = false
    await load(); emit('confirmed'); ElMessage.success(`人设 v${result.version} 已确认`)
  } catch (e) { if (!disposed) fail(e) } finally { busy.value = false }
}
onMounted(() => { void load(true) })
onBeforeUnmount(() => { disposed = true; detailSequence++; clearTimeout(timer) })
</script>

<template>
  <el-dialog :model-value="true" :title="`${isSource ? '原帖作者 AI 人设' : '账号画像与人设'} · ${accountName || accountId}`" width="1040px" align-center append-to-body :close-on-click-modal="false" @close="emit('close')">
    <div class="persona-dialog">
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <div class="persona-tools">
        <el-tag :type="versions.length ? 'success' : 'info'">{{ versions.length ? `当前人设 v${versions[0]!.version}` : isSource ? (hasDocument ? 'AI 已分析' : '尚未分析') : '未确认人设' }}</el-tag>
        <el-button v-if="canEdit" :icon="Sparkles" type="primary" plain :loading="busy" :disabled="active" @click="analyze">{{ active ? (isSource ? 'AI 处理中' : '画像分析中') : isSource ? (hasDocument ? '重新分析作者' : 'AI 分析作者人设') : '分析已有历史' }}</el-button>
        <el-tooltip content="刷新记录"><el-button :icon="RefreshCw" circle aria-label="刷新人设记录" @click="load()" /></el-tooltip>
      </div>
      <el-tabs v-model="tab">
        <el-tab-pane label="内容人设" name="persona">
          <el-alert v-if="versions[0] && versions[0].version !== baseVersion" title="人设已被其他运营更新，请重新打开窗口后合并修改" type="warning" :closable="false" />
          <el-empty v-if="isSource && !hasDocument" description="暂无作者 AI 分析结果" :image-size="72" />
          <el-form v-else label-position="top" class="persona-fields" :disabled="!canEdit || busy">
            <el-form-item v-for="field in personaFields" :key="field.key" :label="field.label" :required="field.key === 'positioning'">
              <el-input v-model="document[field.key]" type="textarea" :rows="4" :maxlength="field.limit" show-word-limit :aria-label="field.label" @input="dirty = true" />
            </el-form-item>
          </el-form>
        </el-tab-pane>
        <el-tab-pane label="AI 画像" name="analysis">
          <div class="persona-tools"><el-select :model-value="detail?.id || ''" placeholder="选择分析记录" aria-label="选择分析记录" @change="inspect">
            <el-option v-for="job in analysisJobs" :key="job.id" :label="`${formatDate(job.created_at)} · ${personaStatus[job.status]}`" :value="job.id" />
          </el-select><el-button v-if="canEdit && detailAnalysis" :icon="Check" @click="useAnalysis">采用画像建议</el-button></div>
          <el-empty v-if="!detail" description="暂无选中的画像" :image-size="72" />
          <template v-else>
            <el-alert v-if="detail.error_message" :title="detail.error_message" :type="detail.status === 'failed' ? 'error' : 'warning'" :closable="false" />
            <p>{{ personaStatus[detail.status] }} · 已尝试 {{ detail.attempts }} 次</p>
            <p v-if="personaProgress(detail)" role="status">{{ personaProgress(detail) }}</p>
            <p v-if="detailAnalysis?.sample_count">分析样本 {{ detailAnalysis.sample_count }} 条 / 本次检索可用历史 {{ detailAnalysis.available_posts }} 条</p>
            <p>{{ detailAnalysis?.limitations }}</p>
            <section v-for="(item, index) in detailAnalysis?.observations" :key="index" class="persona-observation">
              <strong>{{ item.dimension }}</strong><el-tag size="small" type="info">可信程度：{{ { low: '低', medium: '中', high: '高' }[item.confidence] }}</el-tag>
              <p>{{ item.finding }}</p>
              <details v-for="id in item.evidence_ids" :key="id"><summary>依据 #{{ id }}</summary>
                <template v-for="post in evidencePosts.filter(p => p.id === id)" :key="post.id"><p>{{ post.text_content }}</p><small v-if="post.truncated">正文已截取</small><a v-if="safeSelectionLink(post.content_url)" :href="safeSelectionLink(post.content_url)" target="_blank" rel="noopener noreferrer">打开历史原帖</a></template>
              </details>
            </section>
            <p v-for="(usage, index) in detail.usage" :key="index">{{ usage.model }} · Token {{ usage.total_tokens ?? '未返回' }}</p>
          </template>
        </el-tab-pane>
        <el-tab-pane label="人设版本" name="versions">
          <div class="persona-tools"><el-select v-model="selectedVersion" placeholder="选择版本" aria-label="选择人设版本"><el-option v-for="v in versions" :key="v.id" :value="v.id" :label="`v${v.version} · ${formatDate(v.created_at)}`" /></el-select>
            <el-button v-if="canEdit" :disabled="!selectedVersion" @click="useVersion">载入编辑区</el-button></div>
          <template v-for="v in versions.filter(v => v.id === selectedVersion)" :key="v.id"><section v-for="field in personaFields" :key="field.key" class="persona-observation"><strong>{{ field.label }}</strong><p>{{ v.document[field.key] || '未填写' }}</p></section></template>
        </el-tab-pane>
      </el-tabs>
    </div>
    <template #footer><el-button @click="emit('close')">关闭</el-button><el-button v-if="canEdit && tab === 'persona' && (!isSource || hasDocument)" type="primary" :icon="Check" :loading="busy" :disabled="!document.positioning.trim() || (isSource && !dirty) || (versions[0]?.version || 0) !== baseVersion" @click="confirm">{{ isSource ? '保存调整' : '确认新版本' }}</el-button></template>
  </el-dialog>
</template>

<style scoped>
.persona-dialog { max-height: 70vh; overflow-y: auto; }
.persona-tools { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 10px 0 14px; }
.persona-tools .el-select { width: 310px; max-width: 100%; }
.persona-fields { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 0 20px; }
.persona-observation { border-bottom: 1px solid var(--app-border); padding: 14px 0; }
.persona-observation p { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.7; }
.persona-observation strong { margin-right: 12px; }
.persona-dialog :deep(.el-alert__title) { overflow-wrap: anywhere; }
summary { cursor: pointer; margin: 8px 0; }
@media(max-width: 700px) { .persona-fields { grid-template-columns: minmax(0,1fr); } }
</style>
