<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Plus, RefreshCw, Trash2 } from 'lucide-vue-next'
import { http } from '@/api/http'
import type { CommentReplyScheduleOptions, CommentReplySchedulePolicy } from '@/api/commentReplySchedule'
import { businessPlatformOptions } from '@/config/options'
import type { AnyRecord } from '@/types/api'
import { getErrorMessage } from '@/utils/notify'

const props = defineProps<{
  modelValue: CommentReplyScheduleOptions
  active: boolean
  businessPlatform?: string
  accountId?: string
  accounts?: AnyRecord[]
}>()
const emit = defineEmits<{
  'update:modelValue': [CommentReplyScheduleOptions]
  ready: [boolean]
}>()
const endpoint = '/api/interaction-center/comment-reply-schedules'
const busy = ref(false)
const loaded = ref(false)
const error = ref('')
const defaults = ref<Record<string, string[]>>({})
const targets = computed(() => props.accounts?.length ? props.accounts.map(account => ({
  account_id: String(account.account_id), business_platform: String(account.business_platform),
})) : props.accountId ? [{ account_id: props.accountId, business_platform: props.businessPlatform || '' }] : [])
const platforms = computed(() => [...new Set(targets.value.map(account => account.business_platform))])
const inherit = computed({
  get: () => props.modelValue.inherit,
  set: value => emit('update:modelValue', { ...props.modelValue, inherit: value }),
})
const validTimes = (times: string[]) => times.length > 0 && times.length <= 24
  && times.every(time => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))
const ready = computed(() => props.active && loaded.value && !busy.value && !error.value
  && (inherit.value ? platforms.value.every(platform => validTimes(defaults.value[platform] || []))
    : validTimes(props.modelValue.times)))
let revision = 0

async function load() {
  const current = ++revision
  loaded.value = false
  error.value = ''
  if (!props.active || !targets.value.length) { busy.value = false; return }
  busy.value = true
  const accounts = [...targets.value]
  try {
    const appDefaults = await Promise.all(platforms.value.map(async platform => {
      const policy = await http.get<CommentReplySchedulePolicy>(endpoint, { business_platform: platform })
      return [platform, policy.times] as const
    }))
    if (current !== revision) return
    const accountPolicy = accounts.length === 1 ? await http.get<CommentReplySchedulePolicy>(endpoint, {
      business_platform: accounts[0]!.business_platform, account_id: accounts[0]!.account_id,
    }) : null
    if (current !== revision) return
    defaults.value = Object.fromEntries(appDefaults)
    emit('update:modelValue', { inherit: accountPolicy?.inherit ?? true, times: [...(accountPolicy?.times || [])] })
    loaded.value = true
  } catch (err) {
    if (current === revision) error.value = getErrorMessage(err, '回复时间加载失败')
  } finally {
    if (current === revision) busy.value = false
  }
}

function updateTime(index: number, value: string) {
  const times = [...props.modelValue.times]
  times[index] = value
  emit('update:modelValue', { ...props.modelValue, times })
}

function removeTime(index: number) {
  emit('update:modelValue', { ...props.modelValue, times: props.modelValue.times.filter((_, i) => i !== index) })
}

function addTime() {
  const times = props.modelValue.times
  if (times.length >= 24) return
  const time = ['09:00', '12:00', '18:00', '21:00'].find(time => !times.includes(time)) || '09:00'
  emit('update:modelValue', { ...props.modelValue, times: [...times, time] })
}

watch(() => JSON.stringify([props.active, targets.value]), load, { immediate: true, flush: 'sync' })
watch(ready, value => emit('ready', value), { immediate: true, flush: 'sync' })
onBeforeUnmount(() => { revision++; emit('ready', false) })
</script>

<template>
  <el-form-item label="回复时间（北京时间）" class="reply-time-settings">
    <div class="reply-time-settings__body">
      <el-segmented v-model="inherit" :disabled="busy || !loaded" :options="[
        { label: '继承 App 默认时间', value: true },
        { label: '自定义时间', value: false },
      ]" class="w-full" />
      <span v-if="busy" class="reply-time-settings__status">正在读取回复时间</span>
      <div v-else-if="error" class="reply-time-settings__error">
        <span>{{ error }}</span>
        <el-button link :icon="RefreshCw" @click="load">重新加载</el-button>
      </div>
      <template v-else-if="loaded">
        <template v-if="inherit">
          <div v-for="platform in platforms" :key="platform" class="reply-time-settings__defaults">
            <span v-if="platforms.length > 1">{{ businessPlatformOptions.find(option => option.value === platform)?.label || platform }}</span>
            <el-tag v-for="time in defaults[platform]" :key="time" type="info">{{ time }}</el-tag>
            <span v-if="!defaults[platform]?.length" class="reply-time-settings__error">App 未配置回复时间</span>
          </div>
        </template>
        <template v-else>
          <div v-for="(time, index) in modelValue.times" :key="index" class="reply-time-settings__row">
            <el-time-picker :model-value="time" format="HH:mm" value-format="HH:mm" :clearable="false"
              :aria-label="`回复时间 ${index + 1}`" @update:model-value="updateTime(index, $event)" />
            <el-tooltip content="删除时间"><el-button :icon="Trash2" :aria-label="`删除回复时间 ${index + 1}`" @click="removeTime(index)" /></el-tooltip>
          </div>
          <el-button :icon="Plus" :disabled="modelValue.times.length >= 24" @click="addTime">添加时间</el-button>
          <span v-if="!modelValue.times.length" class="reply-time-settings__error">请至少设置一个回复时间</span>
        </template>
      </template>
    </div>
  </el-form-item>
</template>

<style scoped>
.reply-time-settings__body { display: grid; gap: 10px; width: 100%; min-width: 0; }
.reply-time-settings__row { display: flex; align-items: center; gap: 8px; }
.reply-time-settings__row :deep(.el-date-editor) { flex: 1; width: 0; min-width: 0; }
.reply-time-settings__row :deep(.el-button) { flex: 0 0 32px; width: 32px; padding: 0; }
.reply-time-settings__defaults { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.reply-time-settings__status { color: var(--app-text-muted, #66788a); font-size: 13px; }
.reply-time-settings__error { display: flex; align-items: center; gap: 8px; color: var(--el-color-warning); font-size: 13px; }
</style>
