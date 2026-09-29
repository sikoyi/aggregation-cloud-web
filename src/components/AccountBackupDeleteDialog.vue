<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import { RefreshCw, Trash2 } from 'lucide-vue-next'
import { http } from '@/api/http'
import { businessPlatformLabel } from '@/config/options'
import { getErrorMessage } from '@/utils/notify'

const props = defineProps<{ accountIds: string[] }>()
const emit = defineEmits<{ close: []; changed: [] }>()
interface Preview { account_id: string; name: string; platform: string; version: string; count: number; blocked_reason: string }
interface Result { account_id: string; status: string; message: string }
const rows = ref<Preview[]>([])
const results = ref<Result[]>([])
const loading = ref(false)
const saving = ref(false)
const ready = ref(false)
const confirmed = ref(false)
const error = ref('')
// Submit every selected account so shared multi-platform packages keep their full scope.
const canDelete = computed(() => ready.value && rows.value.some(row => row.count > 0) && !rows.value.some(row => row.blocked_reason))

async function preview() {
  loading.value = true
  ready.value = false
  confirmed.value = false
  error.value = ''
  try {
    rows.value = await http.post<Preview[]>('/api/accounts/backup-delete/preview', { account_ids: props.accountIds })
    ready.value = rows.value.length === props.accountIds.length
    results.value = []
  } catch (err) { error.value = getErrorMessage(err, '预检失败，请重试') }
  finally { loading.value = false }
}

async function remove() {
  if (!canDelete.value || !confirmed.value || saving.value || loading.value) return
  saving.value = true
  const items = rows.value.map(({ account_id, version }) => ({ account_id, version }))
  try {
    await ElMessageBox.confirm('备份文件删除后无法恢复。账号、凭证和业务历史将保留，确认继续？', '删除备份包',
      { type: 'warning', confirmButtonText: '永久删除备份', cancelButtonText: '取消', confirmButtonClass: 'el-button--danger' })
    ready.value = false
    results.value = await http.post<Result[]>('/api/accounts/backup-delete/batch', { items })
    emit('changed')
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') {
      ready.value = false
      error.value = getErrorMessage(err, '删除未完成，请重新预检后重试')
      emit('changed')
    }
  } finally { saving.value = false }
}
onMounted(preview)
</script>

<template>
  <el-dialog :model-value="true" title="删除账号备份包" width="min(94vw, 820px)" align-center
    :close-on-click-modal="false" :close-on-press-escape="!saving && !loading" :show-close="!saving && !loading" @close="emit('close')">
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-alert v-if="results.length" :type="results.some(row => row.status === 'failed') ? 'warning' : 'success'" :closable="false"
      :title="`已删除 ${results.filter(row => row.status === 'deleted').length} 个账号的备份，失败 ${results.filter(row => row.status === 'failed').length} 个，无备份 ${results.filter(row => row.status === 'empty').length} 个`"
      :description="results.some(row => row.status === 'failed') ? '有文件尚未清理，请重新预检后重试。' : undefined" />
    <el-table v-loading="loading" :data="rows" border max-height="400" row-key="account_id">
      <el-table-column prop="name" label="账号" min-width="160" show-overflow-tooltip />
      <el-table-column label="平台" width="105"><template #default="{ row }">{{ businessPlatformLabel(row.platform) }}</template></el-table-column>
      <el-table-column prop="count" label="备份文件" width="95" align="center" />
      <el-table-column label="状态" min-width="280"><template #default="{ row }">
        <span :class="{ 'backup-error': row.blocked_reason || results.find(r => r.account_id === row.account_id)?.status === 'failed' }">
          {{ results.find(r => r.account_id === row.account_id)?.message || row.blocked_reason || (row.count ? '可删除' : '无备份，跳过') }}
        </span>
      </template></el-table-column>
    </el-table>
    <el-checkbox v-model="confirmed" class="backup-confirm" :disabled="!canDelete || saving || loading">我确认永久删除所选账号的备份文件，保留账号及业务数据</el-checkbox>
    <template #footer>
      <div class="backup-footer">
        <el-button :disabled="saving || loading" @click="emit('close')">关闭</el-button>
        <el-button :icon="RefreshCw" :disabled="saving || loading" @click="preview">重新预检</el-button>
        <el-button type="danger" :icon="Trash2" :loading="saving" :disabled="!canDelete || !confirmed || loading" @click="remove">删除备份包</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.backup-error { color: var(--el-color-danger); }
.backup-confirm { height: auto; margin-top: 16px; align-items: flex-start; }
.backup-confirm :deep(.el-checkbox__label) { white-space: normal; line-height: 20px; }
.backup-confirm :deep(.el-checkbox__input) { margin-top: 3px; }
.backup-footer { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.backup-footer :deep(.el-button) { margin: 0; }
</style>
