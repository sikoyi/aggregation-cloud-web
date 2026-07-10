<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { http } from '@/api/http'
import StatusBadge from '@/components/StatusBadge.vue'
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

const session = computed<AnyRecord | null>(() => {
  const value = detail.value?.session
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : null
})
const steps = computed<AnyRecord[]>(() => Array.isArray(detail.value?.steps) ? detail.value.steps : [])
const dialogTitle = computed(() => `互动会话详情：${String(session.value?.title || props.sessionId || '')}`)
const stepCount = computed(() => {
  const configured = Number((session.value?.params as AnyRecord | undefined)?.interaction_step_count || 0)
  if (configured > 0) return configured
  return Math.max(0, ...steps.value.map((step) => Number(step.step_no || 0)))
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

function stepActionLabel(value: unknown) {
  const action = String(value || '')
  const labels: Record<string, string> = {
    homepage_browse_comment: '首页刷帖评论',
    main_reply_comment: '主号回复评论',
    commenter_reply_main: '评论号二次回复',
  }
  return labels[action] || action || '-'
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
          <el-descriptions-item label="脚本">{{ text(session.script_key) }}</el-descriptions-item>
          <el-descriptions-item label="评论账号数">{{ text(session.comment_account_count) }}</el-descriptions-item>
          <el-descriptions-item label="每号互动次数">{{ text(stepCount) }}</el-descriptions-item>
          <el-descriptions-item label="父任务">
            <span class="font-mono text-xs" :title="String(session.task_run_id || '')">{{ truncateId(session.task_run_id) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDate(session.created_at) }}</el-descriptions-item>
        </el-descriptions>

        <el-table :data="groupedSteps" border stripe table-layout="auto" empty-text="暂无步骤">
          <el-table-column prop="accountName" label="评论账号" min-width="160" align="center" />
          <el-table-column label="互动步骤" min-width="760">
            <template #default="{ row }">
              <div class="step-grid">
                <div v-for="step in row.steps" :key="step.id" class="step-card">
                  <div class="step-card__head">
                    <strong>第 {{ step.step_no }} 步</strong>
                    <StatusBadge :value="step.status" />
                  </div>
                  <div class="step-card__action">{{ stepActionLabel(step.action_type) }}</div>
                  <div class="step-card__meta">执行账号：{{ text(step.operator_account_name || step.operator_account_id) }}</div>
                  <div class="step-card__meta">
                    任务：<span class="font-mono" :title="String(step.task_run_id || '')">{{ truncateId(step.task_run_id) }}</span>
                  </div>
                  <div v-if="step.result_content" class="step-card__content">{{ step.result_content }}</div>
                  <div v-if="step.error_message" class="step-card__error">{{ step.error_message }}</div>
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

.step-card {
  min-height: 132px;
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

.step-card__content {
  margin-top: 8px;
  color: #334155;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.step-card__error {
  margin-top: 8px;
  color: #dc2626;
  font-size: 12px;
}
</style>
