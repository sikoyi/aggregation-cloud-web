<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { Play } from 'lucide-vue-next'
import { ElMessageBox } from 'element-plus'
import { accountPersona, type PersonaJob } from '@/api/accountPersona'
import { personaMetrics } from '@/utils/personaMetrics'

const props = defineProps<{ job: PersonaJob; canResume: boolean }>()
const emit = defineEmits<{ resumed: [job: PersonaJob] }>()
const busy = ref(false)
const error = ref('')
const metrics = computed(() => personaMetrics([props.job]))
let request: { id: string; key: string } | undefined
let disposed = false
onBeforeUnmount(() => { disposed = true })
async function resume() {
  if (busy.value || !props.canResume || props.job.status !== 'failed' || props.job.budget?.blocked_reason) return
  busy.value = true
  error.value = ''
  const job = props.job
  try {
    try { await ElMessageBox.confirm('继续原任务的未完成阶段？保留已完成批次与累计用量，可能产生额外 AI 费用，不会自动发布。', '从断点继续', { confirmButtonText: '继续分析', cancelButtonText: '取消' }) }
    catch { return }
    if (disposed || props.job.id !== job.id) return
    if (request?.id !== job.id) request = { id: job.id, key: crypto.randomUUID() }
    const resumed = await accountPersona.resume(job.account_id, job.id, request.key)
    request = undefined
    if (!disposed && props.job.id === job.id) emit('resumed', resumed)
  } catch (e) { if (!disposed) error.value = e instanceof Error ? e.message : '续跑失败，请刷新后重试' }
  finally { busy.value = false }
}
</script>

<template>
  <section class="job-health">
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <div class="budget-row" v-if="job.budget">
      <span>已报告费用 ¥{{ job.budget.known_cny.toFixed(2) }} / ¥{{ job.budget.limit_cny }}</span>
      <span>费用未确认 {{ job.budget.unknown_cost_calls }} 次</span>
      <span>调用保护计数 {{ job.budget.calls }} / {{ job.budget.max_calls }}</span>
      <el-tooltip content="未返回 Token 的调用按保护额度计入；仅累计上游明确返回的人民币费用，非最终账单">
        <span>Token 保护计数 {{ job.budget.tokens.toLocaleString() }} / {{ job.budget.max_tokens.toLocaleString() }}</span>
      </el-tooltip>
    </div>
    <el-alert v-if="job.budget?.legacy_unknown_calls" :title="`历史未确认处理 ${job.budget.legacy_unknown_calls} 次，已按保护额度计入，并非实际账单`" type="info" :closable="false" />
    <el-alert v-if="job.budget?.blocked_reason" :title="`${job.budget.blocked_reason}，已保留断点`" type="warning" :closable="false" />
    <el-button v-if="canResume && job.status === 'failed'" :icon="Play" :loading="busy" :disabled="!!job.budget?.blocked_reason" @click="resume">从断点继续</el-button>
    <el-table v-if="metrics.length" :data="metrics" size="small">
      <el-table-column prop="stage" label="阶段" min-width="160" />
      <el-table-column prop="attempts" label="次数" width="65" />
      <el-table-column prop="succeeded" label="成功" width="65" />
      <el-table-column prop="pending" label="未确认" width="75" />
      <el-table-column prop="rate" label="成功率" width="85" />
      <el-table-column prop="seconds" label="累计秒数" width="95" />
    </el-table>
  </section>
</template>

<style scoped>
.job-health { display: grid; gap: 10px; margin: 12px 0; min-width: 0; }
.job-health > .el-button { justify-self: start; }
.budget-row { display: flex; flex-wrap: wrap; gap: 8px 18px; color: var(--el-text-color-secondary); font-size: 12px; }
</style>
