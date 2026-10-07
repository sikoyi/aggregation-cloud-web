<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Plus, Save, Trash2 } from 'lucide-vue-next'
import { ElNotification } from 'element-plus'
import { http } from '@/api/http'
import { notifyError } from '@/utils/notify'
import type { AnyRecord } from '@/types/api'
import type { CommentReplyScheduleOptions } from '@/api/commentReplySchedule'
import CommentReplyTimeSettings from '@/components/CommentReplyTimeSettings.vue'

const props = defineProps<{ modelValue: boolean; accounts: AnyRecord[]; replyMode?: string }>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; saved: [] }>()
const visible = computed({ get: () => props.modelValue, set: value => emit('update:modelValue', value) })
const platform = ref('threads')
const inherit = ref(false)
const times = ref<string[]>([])
const busy = ref(false)
const loaded = ref(false)
const batchSchedule = ref<CommentReplyScheduleOptions>({ inherit: true, times: [] })
const batchReady = ref(false)
const batchMode = ref('automatic')
const endpoint = '/api/interaction-center/comment-reply-schedules'
const accountIds = computed(() => props.accounts.map(account => String(account.account_id)))
const mixed = computed(() => props.accounts.some(account => account.business_platform !== platform.value))
let revision = 0

async function load() {
  const current = ++revision
  busy.value = true
  loaded.value = false
  try {
    const policy = await http.get<{ times: string[]; inherit: boolean }>(endpoint, {
      business_platform: platform.value,
      account_id: accountIds.value.length === 1 ? accountIds.value[0] : '',
    })
    if (current !== revision) return
    times.value = [...policy.times]
    inherit.value = accountIds.value.length > 1 || policy.inherit
    loaded.value = true
  } catch (error) {
    notifyError(error, '加载失败', '回复时间加载失败')
  } finally {
    if (current === revision) busy.value = false
  }
}

async function save() {
  if (busy.value || (props.replyMode ? !batchReady.value : mixed.value || !loaded.value)) return
  busy.value = true
  try {
    if (props.replyMode) {
      const result = await http.put<{ updated_count: number; skipped_count: number }>('/api/accounts/data-overview/comment-reply-mode/batch', {
        account_ids: accountIds.value, comment_reply_mode: batchMode.value,
        comment_reply_schedule: batchSchedule.value,
      })
      ElNotification.success({ title: '回复设置已保存', message: `已更新 ${result.updated_count} 个账号${result.skipped_count ? `，跳过 ${result.skipped_count} 个未配置账号` : ''}` })
      emit('saved')
      visible.value = false
      return
    }
    await http.put(endpoint, {
      business_platform: platform.value, account_ids: accountIds.value,
      inherit: accountIds.value.length > 0 && inherit.value,
      times: times.value,
    })
    ElNotification.success({ title: '保存成功', message: '集中回复时间已更新' })
    visible.value = false
  } catch (error) {
    notifyError(error, '保存失败', '回复时间保存失败')
  } finally { busy.value = false }
}

watch(visible, value => {
  if (!value) { revision++; return }
  platform.value = String(props.accounts[0]?.business_platform || 'threads')
  if (props.replyMode) {
    batchMode.value = props.replyMode
    batchSchedule.value = { inherit: true, times: [] }
    batchReady.value = false
    busy.value = false
  } else void load()
})
</script>

<template>
  <el-dialog v-model="visible" class="comment-reply-schedule-dialog" :title="replyMode ? '批量设置回复方式' : '集中回复时间'" width="min(480px, calc(100vw - 32px))" align-center :close-on-click-modal="false">
    <el-form label-position="top" :disabled="busy">
      <template v-if="replyMode">
        <el-form-item :label="`所选账号：${accounts.length}`">
          <el-segmented v-model="batchMode" :options="[
            { label: '自动回复', value: 'automatic' }, { label: '审核后回复', value: 'review' },
          ]" class="w-full" />
        </el-form-item>
        <CommentReplyTimeSettings v-model="batchSchedule" :active="visible" :accounts="accounts.filter(account => account.monitor_setting_id)" @ready="batchReady = $event" />
      </template>
      <template v-else>
      <el-form-item label="App">
        <el-select v-model="platform" :disabled="accounts.length > 0" @change="load">
          <el-option label="Threads" value="threads" />
          <el-option label="X (Twitter)" value="x" />
          <el-option label="Facebook" value="facebook" />
        </el-select>
      </el-form-item>
      <el-alert v-if="mixed" type="error" title="请选择同一 App 下的账号" :closable="false" />
      <el-form-item v-if="accounts.length" :label="`所选账号：${accounts.length}`">
        <el-switch v-model="inherit" active-text="继承 App 默认时间" />
      </el-form-item>
      <el-form-item v-if="!accounts.length || !inherit" label="每日触发时间（北京时间）">
        <div class="reply-times">
          <div v-for="(_, index) in times" :key="index" class="reply-time">
            <el-time-picker v-model="times[index]" format="HH:mm" value-format="HH:mm" :clearable="false" />
            <el-tooltip content="删除时间"><el-button :icon="Trash2" aria-label="删除时间" @click="times.splice(index, 1)" /></el-tooltip>
          </div>
          <el-button :icon="Plus" :disabled="times.length >= 24" @click="times.push('09:00')">添加时间</el-button>
          <el-tag v-if="!times.length" type="info">未设置触发时间</el-tag>
        </div>
      </el-form-item>
      </template>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :icon="Save" :loading="busy" :disabled="replyMode ? !batchReady : mixed || !loaded" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
:global(.comment-reply-schedule-dialog) { display: flex; flex-direction: column; max-height: calc(100dvh - 32px); }
:global(.comment-reply-schedule-dialog .el-dialog__body) { min-height: 0; overflow-y: auto; }
:global(.comment-reply-schedule-dialog .el-dialog__header),
:global(.comment-reply-schedule-dialog .el-dialog__footer) { flex-shrink: 0; }
.reply-times { display: flex; flex-direction: column; gap: 12px; width: 100%; }
.reply-time { display: flex; gap: 8px; align-items: center; }
.reply-time :deep(.el-date-editor) { min-width: 0; flex: 1; }
</style>
