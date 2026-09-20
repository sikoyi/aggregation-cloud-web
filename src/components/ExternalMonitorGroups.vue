<script setup lang="ts">
import { ref } from 'vue'
import { Layers3, Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { ElMessageBox, ElNotification } from 'element-plus'
import { http } from '@/api/http'

interface Group { id: string; name: string; version: number }
defineProps<{ groups: Group[] }>()
const emit = defineEmits<{ changed: [] }>()
const visible = ref(false)
const busy = ref(false)
const name = ref('')
const editing = ref<Group | null>(null)
function edit(group?: Group) { editing.value = group || null; name.value = group?.name || '' }
async function save() {
  if (busy.value || !name.value.trim()) return
  busy.value = true
  try {
    if (editing.value) await http.put(`/api/external-account-monitors/groups/${editing.value.id}`, { name: name.value.trim(), expected_version: editing.value.version })
    else await http.post('/api/external-account-monitors/groups', { name: name.value.trim() })
    edit()
    emit('changed')
    ElNotification.success({ title: '分组已保存' })
  } catch (e) { ElNotification.error({ title: '保存分组失败', message: e instanceof Error ? e.message : '请重试' }) }
  finally { busy.value = false }
}
async function remove(group: Group) {
  if (busy.value) return
  busy.value = true
  try {
    await ElMessageBox.confirm(`删除“${group.name}”后，账号回到未分组，监听和采集数据保留。`, '删除分组', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
    await http.delete(`/api/external-account-monitors/groups/${group.id}?expected_version=${group.version}`)
    if (editing.value?.id === group.id) edit()
    emit('changed')
    ElNotification.success({ title: '分组已删除' })
  } catch (e) { if (e !== 'cancel' && e !== 'close') ElNotification.error({ title: '删除分组失败', message: e instanceof Error ? e.message : '请重试' }) }
  finally { busy.value = false }
}
</script>

<template>
  <el-button :icon="Layers3" @click="visible = true">管理分组</el-button>
  <el-dialog v-model="visible" title="外部账号分组" width="min(560px, 96vw)" append-to-body destroy-on-close>
    <el-form inline @submit.prevent="save">
      <el-form-item :label="editing ? '修改名称' : '新建分组'"><el-input v-model="name" maxlength="80" :disabled="busy" /></el-form-item>
      <el-button type="primary" :icon="editing ? Pencil : Plus" :disabled="!name.trim()" :loading="busy" @click="save">{{ editing ? '保存' : '新建' }}</el-button>
      <el-button v-if="editing" :disabled="busy" @click="edit()">取消编辑</el-button>
    </el-form>
    <el-table :data="groups" max-height="380" empty-text="暂无分组">
      <el-table-column prop="name" label="分组名称" min-width="200" show-overflow-tooltip />
      <el-table-column label="操作" width="100"><template #default="{ row }">
        <el-tooltip content="修改名称"><el-button text circle :icon="Pencil" aria-label="修改分组名称" :disabled="busy" @click="edit(row as Group)" /></el-tooltip>
        <el-tooltip content="删除分组"><el-button text circle type="danger" :icon="Trash2" aria-label="删除分组" :disabled="busy" @click="remove(row as Group)" /></el-tooltip>
      </template></el-table-column>
    </el-table>
    <template #footer><el-button @click="visible = false">关闭</el-button></template>
  </el-dialog>
</template>
