<script setup lang="ts">
import { Clock3, Plus, Save, Trash2 } from 'lucide-vue-next'
import { ElNotification } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'

import { http } from '@/api/http'
import type { AnyRecord } from '@/types/api'
import { notifyError } from '@/utils/notify'

const props = defineProps<{
  modelValue: boolean
  editable?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const platformOptions = [
  { label: 'Threads', value: 'threads' },
  { label: 'X(Twitter)', value: 'x' },
  { label: 'Facebook', value: 'facebook' },
]

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})
const activePlatform = ref('threads')
const loading = ref(false)
const saving = ref(false)
const loaded = ref(false)
const activeTab = ref('schedule')
const times = ref<string[]>([])
const scheduleEndpoint = '/api/interaction-center/comment-reply-schedules'
const form = reactive({
  enabled: false,
  start: '22:00:00',
  end: '08:00:00',
})
let requestRevision = 0

const activePlatformLabel = computed(() => (
  platformOptions.find((option) => option.value === activePlatform.value)?.label || activePlatform.value
))
const platformLocked = computed(() => loading.value || saving.value)

function endpoint() {
  return `/api/interaction-center/content-monitor/provider-config/${activePlatform.value}`
}

function resetForm() {
  form.enabled = false
  form.start = '22:00:00'
  form.end = '08:00:00'
}

async function loadPolicy() {
  const revision = ++requestRevision
  resetForm()
  loading.value = true
  loaded.value = false
  try {
    const data = activeTab.value === 'schedule'
      ? await http.get<AnyRecord>(scheduleEndpoint, { business_platform: activePlatform.value })
      : await http.get<AnyRecord>(endpoint())
    if (revision !== requestRevision) return
    times.value = Array.isArray(data.times) ? data.times.map(String) : []
    form.enabled = data.comment_reply_quiet_enabled === true
    form.start = String(data.comment_reply_quiet_start || '22:00:00')
    form.end = String(data.comment_reply_quiet_end || '08:00:00')
    loaded.value = true
  } catch (err) {
    if (revision === requestRevision) notifyError(err, '加载失败', '评论回复设置加载失败')
  } finally {
    if (revision === requestRevision) loading.value = false
  }
}

async function savePolicy() {
  if (!props.editable || loading.value || saving.value || !loaded.value) return
  if (activeTab.value === 'schedule') {
    saving.value = true
    try {
      await http.put(scheduleEndpoint, {
        business_platform: activePlatform.value, account_ids: [], inherit: false, times: times.value,
      })
      ElNotification.success({ title: '保存成功', message: `${activePlatformLabel.value} 评论回复时间已更新` })
    } catch (err) {
      notifyError(err, '保存失败', '评论回复时间保存失败')
    } finally { saving.value = false }
    return
  }
  if (form.enabled && (!form.start || !form.end)) {
    ElNotification.warning({ title: '请完善配置', message: '请选择忽略开始和结束时间' })
    return
  }
  if (form.enabled && form.start === form.end) {
    ElNotification.warning({ title: '时间无效', message: '忽略开始和结束时间不能相同' })
    return
  }
  saving.value = true
  try {
    const data = await http.put<AnyRecord>(endpoint(), {
      comment_reply_quiet_enabled: form.enabled,
      comment_reply_quiet_start: form.enabled ? form.start : null,
      comment_reply_quiet_end: form.enabled ? form.end : null,
    })
    form.enabled = data.comment_reply_quiet_enabled === true
    form.start = String(data.comment_reply_quiet_start || form.start || '22:00:00')
    form.end = String(data.comment_reply_quiet_end || form.end || '08:00:00')
    ElNotification.success({
      title: '保存成功',
      message: `${activePlatformLabel.value} 忽略时间段已更新`,
    })
  } catch (err) {
    notifyError(err, '保存失败', '忽略时间段保存失败')
  } finally {
    saving.value = false
  }
}

watch(visible, (value) => {
  if (!value) { requestRevision++; return }
  activeTab.value = 'schedule'
  activePlatform.value = 'threads'
  void loadPolicy()
})
</script>

<template>
  <el-dialog
    v-model="visible"
    title="评论回复设置"
    width="min(92vw, 640px)"
    align-center
    destroy-on-close
    :close-on-click-modal="!saving"
    :close-on-press-escape="!saving"
    :show-close="!saving"
  >
    <div class="reply-quiet-dialog">
      <div class="reply-quiet-dialog__platforms">
        <span>业务 App</span>
        <el-segmented
          v-model="activePlatform"
          :options="platformOptions"
          :disabled="platformLocked"
          @change="loadPolicy"
        />
      </div>

      <el-tabs v-model="activeTab" @tab-change="loadPolicy">
        <el-tab-pane label="评论回复时间" name="schedule" :disabled="platformLocked" />
        <el-tab-pane label="评论忽略时间段" name="quiet" :disabled="platformLocked" />
      </el-tabs>
      <section v-if="activeTab === 'schedule'" v-loading="loading" class="reply-schedule-policy">
        <div class="reply-quiet-dialog__copy"><strong>{{ activePlatformLabel }} 默认评论回复时间</strong><small>北京时间（Asia/Shanghai）</small></div>
        <div v-for="(_, index) in times" :key="index" class="reply-schedule-time">
          <el-time-picker v-model="times[index]" format="HH:mm" value-format="HH:mm" :clearable="false" :disabled="platformLocked || !editable || !loaded" />
          <el-tooltip content="删除时间"><el-button v-if="editable" :icon="Trash2" aria-label="删除时间" :disabled="platformLocked || !loaded" @click="times.splice(index, 1)" /></el-tooltip>
        </div>
        <el-empty v-if="!loading && loaded && !times.length" description="未设置评论回复时间" :image-size="48" />
        <el-button v-if="editable" :icon="Plus" :disabled="platformLocked || !loaded || times.length >= 24" @click="times.push('09:00')">添加时间</el-button>
      </section>
      <section v-else v-loading="loading" class="reply-quiet-dialog__policy">
        <div class="reply-quiet-dialog__heading">
          <span class="reply-quiet-dialog__icon"><Clock3 :size="18" /></span>
          <div class="reply-quiet-dialog__copy">
            <strong>{{ activePlatformLabel }} 评论回复</strong>
            <small>北京时间（Asia/Shanghai）</small>
          </div>
          <el-switch
            v-model="form.enabled"
            :disabled="platformLocked || !loaded || !editable"
            class="reply-quiet-dialog__switch"
          />
        </div>

        <div class="reply-quiet-dialog__fields">
          <label>
            <span>开始时间</span>
            <el-time-picker
              v-model="form.start"
              format="HH:mm"
              value-format="HH:mm:ss"
              :disabled="!form.enabled || platformLocked || !loaded || !editable"
              placeholder="选择开始时间"
            />
          </label>
          <label>
            <span>结束时间</span>
            <el-time-picker
              v-model="form.end"
              format="HH:mm"
              value-format="HH:mm:ss"
              :disabled="!form.enabled || platformLocked || !loaded || !editable"
              placeholder="选择结束时间"
            />
          </label>
        </div>

        <el-alert
          title="时段内产生的新评论不会创建自动回复或审核工单，时段结束后也不会补发。"
          type="info"
          :closable="false"
          show-icon
        />
        <el-alert
          v-if="!editable"
          title="当前角色仅可查看忽略时间段"
          type="info"
          :closable="false"
          show-icon
          class="reply-quiet-dialog__readonly"
        />
      </section>
    </div>

    <template #footer>
      <el-button :disabled="saving" @click="visible = false">关闭</el-button>
      <el-button v-if="editable" type="primary" :icon="Save" :loading="saving" :disabled="loading || !loaded" @click="savePolicy">
        {{ activeTab === 'schedule' ? '保存评论回复时间' : '保存评论忽略时间段' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.reply-quiet-dialog { display: grid; gap: 16px; }
.reply-schedule-policy { display: grid; gap: 14px; max-height: 50dvh; overflow-y: auto; }
.reply-schedule-time { display: flex; align-items: center; gap: 8px; }
.reply-schedule-time :deep(.el-date-editor) { flex: 1; min-width: 0; }
.reply-quiet-dialog__platforms {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.reply-quiet-dialog__platforms > span {
  color: var(--app-text, #52606d);
  font-size: 13px;
  font-weight: 600;
}
.reply-quiet-dialog__policy {
  min-height: 214px;
  padding: 16px;
  border: 1px solid var(--app-border, #dbe4ed);
  border-radius: 6px;
  background: var(--app-surface-muted, #f8fafc);
}
.reply-quiet-dialog__heading {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-bottom: 18px;
}
.reply-quiet-dialog__copy { display: grid; min-width: 0; flex: 1; gap: 2px; }
.reply-quiet-dialog__heading strong { color: var(--app-text, #25384a); font-size: 14px; }
.reply-quiet-dialog__heading small,
.reply-quiet-dialog__fields label > span { color: var(--app-text-muted, #7b8b9b); font-size: 11px; }
.reply-quiet-dialog__icon {
  display: inline-flex;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  color: var(--app-blue, #236b97);
  background: var(--app-surface, #eaf5fc);
}
.reply-quiet-dialog__switch { width: auto; flex: 0 0 auto; }
.reply-quiet-dialog__fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}
.reply-quiet-dialog__fields label { display: grid; min-width: 0; gap: 6px; }
.reply-quiet-dialog__fields :deep(.el-date-editor) { width: 100%; }
.reply-quiet-dialog__readonly { margin-top: 10px; }

@media (max-width: 560px) {
  .reply-quiet-dialog__platforms { align-items: stretch; flex-direction: column; }
  .reply-quiet-dialog__platforms :deep(.el-segmented) { width: 100%; }
  .reply-quiet-dialog__fields { grid-template-columns: 1fr; }
}
</style>
