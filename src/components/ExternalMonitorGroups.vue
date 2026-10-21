<script setup lang="ts">
import { ref, watch } from 'vue'
import { Layers3, Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { ElMessageBox, ElNotification } from 'element-plus'
import { http } from '@/api/http'
import ExternalOrderControls from './ExternalOrderControls.vue'

interface Group { id: string; name: string; version: number; member_count: number }
const props = defineProps<{ groups: Group[] }>()
const ordered = ref<Group[]>([])
watch(() => props.groups, groups => { ordered.value = [...groups] }, { immediate: true })
const emit = defineEmits<{ changed: []; refresh: [] }>()
const visible = ref(false)
const busy = ref(false)
const name = ref('')
const editing = ref<Group | null>(null)
function edit(group?: Group) { editing.value = group || null; name.value = group?.name || '' }
async function move(from: number, to: number) {
  if (busy.value || from === to) return
  const groups = [...ordered.value]
  groups.splice(to, 0, groups.splice(from, 1)[0])
  busy.value = true
  try {
    ordered.value = await http.put('/api/external-account-monitors/tags/order', { items: groups.map(group => ({ id: group.id, expected_version: group.version })) })
    edit()
    emit('changed')
  } catch (e) {
    ElNotification.error({ title: '保存标签顺序失败', message: e instanceof Error ? e.message : '请刷新重试' })
    emit('refresh')
  } finally { busy.value = false }
}
async function save() {
  if (busy.value || !name.value.trim()) return
  busy.value = true
  try {
    if (editing.value) await http.put(`/api/external-account-monitors/tags/${editing.value.id}`, { name: name.value.trim(), expected_version: editing.value.version })
    else await http.post('/api/external-account-monitors/tags', { name: name.value.trim() })
    edit()
    emit('changed')
    ElNotification.success({ title: '标签已保存' })
  } catch (e) { ElNotification.error({ title: '保存标签失败', message: e instanceof Error ? e.message : '请重试' }) }
  finally { busy.value = false }
}
async function remove(group: Group) {
  if (busy.value) return
  busy.value = true
  try {
    await ElMessageBox.confirm(`删除“${group.name}”后，仅移除该标签，账号、其他标签、监听和采集数据保留。`, '删除账号标签', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
    await http.delete(`/api/external-account-monitors/tags/${group.id}?expected_version=${group.version}`)
    if (editing.value?.id === group.id) edit()
    emit('changed')
    ElNotification.success({ title: '标签已删除' })
  } catch (e) { if (e !== 'cancel' && e !== 'close') ElNotification.error({ title: '删除标签失败', message: e instanceof Error ? e.message : '请重试' }) }
  finally { busy.value = false }
}
</script>

<template>
  <el-button :icon="Layers3" @click="visible = true; emit('refresh')">管理标签</el-button>
  <el-dialog v-model="visible" title="外部账号标签" width="min(560px, 96vw)" append-to-body destroy-on-close>
    <el-form inline @submit.prevent="save">
      <el-form-item :label="editing ? '修改名称' : '新建标签'"><el-input v-model="name" maxlength="80" :disabled="busy" /></el-form-item>
      <el-button type="primary" :icon="editing ? Pencil : Plus" :disabled="!name.trim()" :loading="busy" @click="save">{{ editing ? '保存' : '新建' }}</el-button>
      <el-button v-if="editing" :disabled="busy" @click="edit()">取消编辑</el-button>
    </el-form>
    <el-table :data="ordered" max-height="380" empty-text="暂无标签">
      <el-table-column label="排序" width="120"><template #default="{ $index }"><ExternalOrderControls :index="$index" :count="ordered.length" scope="external-tags" :disabled="busy" @move="move" /></template></el-table-column>
      <el-table-column prop="name" label="标签名称" min-width="140" show-overflow-tooltip />
      <el-table-column prop="member_count" label="成员数量" width="100" align="center" />
      <el-table-column label="操作" width="100"><template #default="{ row }">
        <el-tooltip content="修改名称"><el-button text circle :icon="Pencil" aria-label="修改标签名称" :disabled="busy" @click="edit(row as Group)" /></el-tooltip>
        <el-tooltip content="删除标签"><el-button text circle type="danger" :icon="Trash2" aria-label="删除标签" :disabled="busy" @click="remove(row as Group)" /></el-tooltip>
      </template></el-table-column>
    </el-table>
    <template #footer><el-button @click="visible = false">关闭</el-button></template>
  </el-dialog>
</template>
