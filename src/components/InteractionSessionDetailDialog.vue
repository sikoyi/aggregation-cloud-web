<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { http } from '@/api/http'
import StatusBadge from '@/components/StatusBadge.vue'
import { REALTIME_EVENT_NAME, type RealtimeEventPayload } from '@/composables/useRealtimeEvents'
import type { AnyRecord } from '@/types/api'
import { formatDate, truncateId } from '@/utils/format'
import { notifyError } from '@/utils/notify'

const props = defineProps<{
  modelValue: boolean
  sessionId: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const loading = ref(false)
const error = ref('')
const detail = ref<AnyRecord | null>(null)
let realtimeRefreshTimer: number | undefined

const session = computed<AnyRecord | null>(() => {
  const value = detail.value?.session
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : null
})
const aiProvider = computed(() => String((session.value?.ai_config as AnyRecord | undefined)?.provider || 'gemini'))
const steps = computed<AnyRecord[]>(() => Array.isArray(detail.value?.steps) ? detail.value.steps : [])
const dialogTitle = computed(() => `互动会话详情：${String(session.value?.title || props.sessionId || '')}`)
const stepCount = computed(() => {
  const configured = Number((session.value?.params as AnyRecord | undefined)?.interaction_step_count || 0)
  if (configured > 0) return configured
  return Math.max(0, ...steps.value.map((step) => Number(step.step_no || 0)))
})
const dispatchDelayText = computed(() => {
  const minimum = Number(session.value?.step_delay_min_minutes ?? 0)
  const maximum = Number(session.value?.step_delay_max_minutes ?? minimum)
  return minimum === maximum ? `${minimum} 分钟` : `${minimum} - ${maximum} 分钟`
})

const groupedSteps = computed(() => {
  const map = new Map<string, AnyRecord[]>()
  steps.value.forEach((step) => {
    const key = String(step.comment_account_id || '')
    const items = map.get(key) || []
    items.push(step)
    map.set(key, items)
  })
  return [...map.entries()].map(([accountId, items]) => ({
    accountId,
    accountName: String(items[0]?.comment_account_name || accountId),
    steps: items.sort((a, b) => Number(a.step_no || 0) - Number(b.step_no || 0)),
  }))
})

function text(value: unknown) {
  return value === undefined || value === null || value === '' ? '-' : String(value)
}

function aiProviderLabel(value: string) {
  const labels: Record<string, string> = {
    gemini: 'Gemini',
    openai: 'GPT / OpenAI',
    claude: 'Claude',
  }
  return labels[value] || value
}

function stepActionLabel(value: unknown) {
  const action = String(value || '')
  const labels: Record<string, string> = {
    homepage_browse_comment: '首页刷帖评论',
    main_reply_comment: '主号回复评论',
    commenter_reply_main: '评论号二次回复',
  }
  return labels[action] || action || '-'
}

function stepProgressText(step: AnyRecord) {
  if (step.status === 'generating') return 'AI 文案生成中'
  if (step.status === 'locked') return '等待解锁'
  if (step.status === 'queued') return '排队中'
  if (step.status === 'dispatching') return '下发中'
  if (step.status === 'running') return '执行中'
  if (step.status === 'succeeded') return '执行成功'
  if (step.status === 'failed') return '执行失败'
  if (step.status === 'blocked') return '后续已阻断'
  if (step.status === 'expired') return '已超时'
  if (step.status === 'lost') return '已失联'
  if (step.status === 'canceled') return '已取消'
  if (step.generated_content) return '文案已生成'
  return '等待处理'
}

async function loadDetail(sessionId: string) {
  loading.value = true
  error.value = ''
  try {
    detail.value = await http.get<AnyRecord>(`/api/interaction-center/sessions/${encodeURIComponent(sessionId)}`)
  } catch (err) {
    error.value = notifyError(err, '加载互动会话失败', '加载互动会话详情失败')
  } finally {
    loading.value = false
  }
}

function handleRealtimeEvent(event: Event) {
  const payload = (event as CustomEvent<RealtimeEventPayload>).detail
  if (!visible.value || !props.sessionId || payload?.topic !== 'task') return
  if (realtimeRefreshTimer) window.clearTimeout(realtimeRefreshTimer)
  realtimeRefreshTimer = window.setTimeout(() => loadDetail(props.sessionId as string), 500)
}

watch(
  () => [props.modelValue, props.sessionId] as const,
  ([open, sessionId]) => {
    if (open && sessionId) loadDetail(sessionId)
    if (!open) {
      detail.value = null
      error.value = ''
    }
  },
  { immediate: true },
)

onMounted(() => window.addEventListener(REALTIME_EVENT_NAME, handleRealtimeEvent))
onBeforeUnmount(() => {
  window.removeEventListener(REALTIME_EVENT_NAME, handleRealtimeEvent)
  if (realtimeRefreshTimer) window.clearTimeout(realtimeRefreshTimer)
})
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="dialogTitle"
    width="1080px"
    destroy-on-close
    append-to-body
    align-center
  >
    <div v-loading="loading" class="interaction-session-detail">
      <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="mb-3" />

      <template v-if="session">
        <div class="metric-strip">
          <div class="metric-item">
            <span>状态</span>
            <StatusBadge :value="session.status" />
          </div>
          <div class="metric-item">
            <span>进度</span>
            <strong>{{ text(session.progress_text) }}</strong>
          </div>
          <div class="metric-item">
            <span>成功步骤</span>
            <strong>{{ text(session.step_succeeded) }}</strong>
          </div>
          <div class="metric-item">
            <span>失败/阻断</span>
            <strong>{{ text(session.step_failed) }}</strong>
          </div>
        </div>

        <el-descriptions :column="2" border class="mb-4">
          <el-descriptions-item label="目标内容">
            {{ text(session.target_content_title || session.target_platform_content_id || session.target_content_url) }}
          </el-descriptions-item>
          <el-descriptions-item label="主号">{{ text(session.main_account_name || session.main_account_id) }}</el-descriptions-item>
          <el-descriptions-item label="首次评论脚本">
            <el-tag size="small" effect="plain">{{ text(session.initial_comment_script_key) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="后续回复脚本">
            <el-tag size="small" effect="plain">{{ text(session.reply_script_key) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="评论账号数">{{ text(session.comment_account_count) }}</el-descriptions-item>
          <el-descriptions-item label="每号互动轮次">{{ text(stepCount) }}</el-descriptions-item>
          <el-descriptions-item label="延迟下发范围">{{ dispatchDelayText }}</el-descriptions-item>
          <el-descriptions-item label="随机点赞概率">{{ text(session.like_probability) }}%</el-descriptions-item>
          <el-descriptions-item label="AI 供应商">
            <el-tag size="small" type="primary" effect="light">
              {{ aiProviderLabel(aiProvider) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="父任务">
            <span class="font-mono text-xs" :title="String(session.task_run_id || '')">{{ truncateId(session.task_run_id) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDate(session.created_at) }}</el-descriptions-item>
        </el-descriptions>

        <el-table :data="groupedSteps" border stripe table-layout="auto" empty-text="暂无步骤">
          <el-table-column prop="accountName" label="评论账号" min-width="160" align="center" />
          <el-table-column label="互动步骤" min-width="760">
            <template #default="{ row }">
              <div class="chain-strip">
                <div v-for="step in row.steps" :key="`${step.id}-chain`" class="chain-node">
                  <span>第 {{ step.step_no }} 步</span>
                  <strong>{{ stepProgressText(step) }}</strong>
                </div>
              </div>
              <div class="step-grid">
                <div v-for="step in row.steps" :key="step.id" class="step-card">
                  <div class="step-card__head">
                    <strong>第 {{ step.step_no }} 步</strong>
                    <StatusBadge :value="step.status" />
                  </div>
                  <div class="step-card__action">{{ stepActionLabel(step.action_type) }}</div>
                  <div v-if="step.script_key" class="step-card__relation">
                    <span>执行脚本</span>
                    <el-tag size="small" type="info" effect="plain">{{ step.script_key }}</el-tag>
                  </div>
                  <div class="step-card__meta">执行账号：{{ text(step.operator_account_name || step.operator_account_id) }}</div>
                  <div class="step-card__meta">
                    任务：<span class="font-mono" :title="String(step.task_run_id || '')">{{ truncateId(step.task_run_id) }}</span>
                  </div>
                  <div v-if="step.ai_model" class="step-card__relation">
                    <span>生成模型</span>
                    <el-tag size="small" effect="plain">{{ step.ai_model }}</el-tag>
                  </div>
                  <div v-if="step.generated_content" class="step-card__content">
                    <span>服务端生成稿</span>
                    <p>{{ step.generated_content }}</p>
                  </div>
                  <div v-if="step.generation_error" class="step-card__error">{{ step.generation_error }}</div>
                  <div
                    v-if="step.error_message && step.error_message !== step.generation_error"
                    class="step-card__error"
                  >{{ step.error_message }}</div>
                </div>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </div>
  </el-dialog>
</template>

<style scoped>
.interaction-session-detail {
  min-height: 360px;
}

.metric-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.metric-item {
  display: flex;
  min-height: 64px;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 10px 12px;
  background: #fff;
}

.metric-item span {
  color: #64748b;
  font-size: 12px;
}

.metric-item strong {
  color: #0f172a;
  font-size: 20px;
}

.step-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.chain-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.chain-node {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #dbeafe;
  border-radius: 999px;
  padding: 5px 10px;
  background: #eff6ff;
  color: #1e3a8a;
  font-size: 12px;
}

.chain-node:not(:last-child)::after {
  content: "";
  width: 18px;
  height: 1px;
  background: #bfdbfe;
  margin-left: 2px;
}

.chain-node span {
  color: #64748b;
}

.chain-node strong {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.step-card {
  min-height: 168px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px;
  background: #f8fafc;
}

.step-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.step-card__action {
  color: #0f172a;
  font-weight: 600;
}

.step-card__meta {
  margin-top: 5px;
  color: #64748b;
  font-size: 12px;
}

.step-card__relation {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 7px;
  border-radius: 6px;
  padding: 6px 8px;
  background: #fff;
  color: #64748b;
  font-size: 12px;
}

.step-card__relation strong {
  min-width: 0;
  overflow: hidden;
  color: #0f172a;
  font-weight: 600;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.step-card__content {
  margin-top: 8px;
  color: #334155;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.step-card__content span {
  display: block;
  margin-bottom: 4px;
  color: #64748b;
}

.step-card__content p {
  margin: 0;
}

.step-card__error {
  margin-top: 8px;
  color: #dc2626;
  font-size: 12px;
}
</style>
