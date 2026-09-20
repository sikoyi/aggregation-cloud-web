<script setup lang="ts">
import { computed, ref } from 'vue'
import { Clock3, Layers3, Pause, Play, Trash2 } from 'lucide-vue-next'
import { ElMessageBox, ElNotification } from 'element-plus'
import { http } from '@/api/http'

type Action = 'enable' | 'disable' | 'interval' | 'group' | 'delete'
interface Result { succeeded: number; skipped: number; failed: number; items: { id: string; status: string; message: string }[] }
const props = defineProps<{ selected: { id: string; version: number }[]; groups: { id: string; name: string }[]; disabled: boolean }>()
const emit = defineEmits<{ completed: []; busy: [value: boolean] }>()
const busy = ref(false)
const dialog = ref<'interval' | 'group' | null>(null)
const interval = ref(60)
const group = ref('')
const result = ref<Result | null>(null)
const resultVisible = ref(false)
const disabled = computed(() => busy.value || props.disabled || !props.selected.length)
async function run(action: Action) {
  if (disabled.value) return
  const items = props.selected.map(row => ({ id: row.id, expected_version: row.version }))
  busy.value = true
  emit('busy', true)
  try {
    if (action === 'delete') await ElMessageBox.confirm(`确认删除选中的 ${items.length} 个外部账号监听及其已采集帖子、历史指标？操作日志仍会保留。`, '批量删除监听', { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' })
    result.value = await http.post<Result>('/api/external-account-monitors/batch', { action, items,
      ...(action === 'interval' ? { interval_minutes: interval.value } : {}),
      ...(action === 'group' ? { group_id: group.value || null } : {}),
    })
    dialog.value = null
    const message = `成功 ${result.value.succeeded}，跳过 ${result.value.skipped}，失败 ${result.value.failed}`
    ElNotification({ title: '批量操作完成', message, type: result.value.failed ? 'warning' : 'success' })
    resultVisible.value = result.value.failed > 0
    emit('completed')
  } catch (e) { if (e !== 'cancel' && e !== 'close') ElNotification.error({ title: '批量操作失败', message: e instanceof Error ? e.message : '请刷新后重试' }) }
  finally { busy.value = false; emit('busy', false) }
}
</script>

<template>
  <div class="external-batch-bar">
    <span>已选择 <strong>{{ selected.length }}</strong> 个账号</span>
    <div class="external-batch-bar__actions">
      <el-button :icon="Play" :disabled="disabled" @click="run('enable')">批量开启监听</el-button>
      <el-button :icon="Pause" :disabled="disabled" @click="run('disable')">批量关闭监听</el-button>
      <el-button :icon="Clock3" :disabled="disabled" @click="dialog = 'interval'">批量修改间隔</el-button>
      <el-button :icon="Layers3" :disabled="disabled" @click="dialog = 'group'">批量分组</el-button>
      <el-button :icon="Trash2" type="danger" plain :disabled="disabled" @click="run('delete')">批量删除</el-button>
    </div>
  </div>
  <el-dialog :model-value="!!dialog" :title="dialog === 'interval' ? '批量修改监听间隔' : '批量设置分组'" width="min(440px, 96vw)" append-to-body :close-on-click-modal="false" @update:model-value="value => { if (!value && !busy) dialog = null }">
    <el-form label-position="top">
      <el-form-item v-if="dialog === 'interval'" label="监听间隔（分钟）"><el-input-number v-model="interval" :min="1" :max="1440" :disabled="busy" /></el-form-item>
      <el-form-item v-else label="账号分组"><el-select v-model="group" :disabled="busy" style="width: 100%"><el-option label="未分组" value="" /><el-option v-for="item in groups" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item>
    </el-form>
    <template #footer><el-button :disabled="busy" @click="dialog = null">取消</el-button><el-button type="primary" :loading="busy" :disabled="disabled" @click="dialog && run(dialog)">确认修改</el-button></template>
  </el-dialog>
  <el-dialog v-model="resultVisible" title="批量操作结果" width="min(600px, 96vw)" append-to-body>
    <p v-if="result">成功 {{ result.succeeded }}，跳过 {{ result.skipped }}，失败 {{ result.failed }}</p>
    <el-table :data="result?.items.filter(item => item.status === 'failed') || []" max-height="360"><el-table-column prop="id" label="记录 ID" min-width="180" /><el-table-column prop="message" label="失败原因" min-width="250" /></el-table>
    <template #footer><el-button @click="resultVisible = false">关闭</el-button></template>
  </el-dialog>
</template>

<style scoped>
.external-batch-bar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding: 12px 14px; border: 1px solid var(--app-border, #dce5ed); border-bottom: 0; background: var(--app-surface-muted, #f7fafc); font-size: 13px; }
.external-batch-bar strong { color: var(--app-blue, #316589); }
.external-batch-bar__actions { display: flex; flex-wrap: wrap; gap: 8px; }
.external-batch-bar__actions :deep(.el-button) { margin-left: 0; }
</style>
