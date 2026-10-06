<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Plus, Save, Trash2 } from 'lucide-vue-next'
import { ElNotification } from 'element-plus'
import { http } from '@/api/http'
import { notifyError } from '@/utils/notify'
import type { AnyRecord } from '@/types/api'

const props = defineProps<{ modelValue: boolean; accounts: AnyRecord[] }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()
const visible = computed({ get: () => props.modelValue, set: value => emit('update:modelValue', value) })
const platform = ref('threads')
const inherit = ref(false)
const times = ref<string[]>([])
const busy = ref(false)
const loaded = ref(false)
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
  if (mixed.value || !loaded.value) return
  busy.value = true
  try {
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
  void load()
})
</script>

<template>
  <el-dialog v-model="visible" title="集中回复时间" width="min(480px, calc(100vw - 32px))" :close-on-click-modal="false">
    <el-form label-position="top" :disabled="busy">
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
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :icon="Save" :loading="busy" :disabled="mixed || !loaded" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.reply-times { display: flex; flex-direction: column; gap: 12px; width: 100%; }
.reply-time { display: flex; gap: 8px; align-items: center; }
.reply-time :deep(.el-date-editor) { min-width: 0; flex: 1; }
</style>
