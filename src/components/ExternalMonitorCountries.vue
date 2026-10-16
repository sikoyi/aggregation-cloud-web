<script setup lang="ts">
import { computed, ref } from 'vue'
import { Globe, Plus, RefreshCw, Trash2 } from 'lucide-vue-next'
import { ElMessageBox, ElNotification } from 'element-plus'
import { accountCountryOptions } from '@/config/options'
import { http } from '@/api/http'

defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const visible = ref(false)
const busy = ref(false)
const loading = ref(false)
const error = ref('')
const selected = ref('')
const config = ref<{ countries: string[]; version: number } | null>(null)
const available = computed(() => accountCountryOptions.filter(option => !config.value?.countries.includes(String(option.value))))
async function load() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try { config.value = await http.get('/api/external-account-monitors/country-options') }
  catch (e) { config.value = null; error.value = e instanceof Error ? e.message : '加载常用国家失败' }
  finally { loading.value = false }
}
async function open() { visible.value = true; selected.value = ''; await load() }
async function save(remove?: string) {
  if (busy.value || loading.value || !config.value || (!remove && !selected.value)) return
  busy.value = true
  try {
    if (remove) await ElMessageBox.confirm(`从常用国家移除“${remove}”？已有账号的国家信息和筛选保持不变。`, '移除常用国家', { confirmButtonText: '移除', cancelButtonText: '取消', type: 'warning' })
    const countries = remove ? config.value.countries.filter(value => value !== remove) : [...config.value.countries, selected.value]
    config.value = await http.put('/api/external-account-monitors/country-options', { countries, expected_version: config.value.version })
    selected.value = ''
    emit('changed')
    ElNotification.success({ title: remove ? '已移除常用国家' : '已添加常用国家' })
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') {
      ElNotification.error({ title: '修改常用国家失败', message: e instanceof Error ? e.message : '请刷新后重试' })
      await load()
    }
  } finally { busy.value = false }
}
</script>

<template>
  <el-button :icon="Globe" :disabled="disabled" @click="open">管理国家</el-button>
  <el-dialog v-model="visible" title="外部账号常用国家" width="min(560px, 96vw)" append-to-body :close-on-click-modal="false" :close-on-press-escape="!busy" :show-close="!busy">
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-form class="external-countries__form" @submit.prevent="save()">
      <el-form-item label="国家"><el-select v-model="selected" placeholder="选择系统国家" filterable clearable :disabled="busy || loading || !config"><el-option v-for="option in available" :key="String(option.value)" :value="String(option.value)" :label="option.label" /></el-select></el-form-item>
      <el-button type="primary" :icon="Plus" :disabled="busy || loading || !config || !selected" @click="save()">添加</el-button>
      <el-tooltip content="刷新"><el-button :icon="RefreshCw" circle aria-label="刷新常用国家" :disabled="busy || loading" @click="load" /></el-tooltip>
    </el-form>
    <el-table v-loading="loading" :data="config?.countries.map(country => ({ country })) || []" max-height="380" empty-text="暂无常用国家">
      <el-table-column prop="country" label="国家" min-width="160" />
      <el-table-column label="操作" width="80" align="center"><template #default="{ row }"><el-tooltip content="移出常用国家"><el-button :icon="Trash2" text circle type="danger" :aria-label="`移除${row.country}`" :disabled="busy || loading" @click="save(row.country)" /></el-tooltip></template></el-table-column>
    </el-table>
    <template #footer><el-button :disabled="busy" @click="visible = false">关闭</el-button></template>
  </el-dialog>
</template>

<style scoped>
.external-countries__form { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 12px 0; }
.external-countries__form :deep(.el-form-item) { flex: 1 1 240px; margin: 0; }
.external-countries__form :deep(.el-button) { margin-left: 0; }
</style>
