<script setup lang="ts">
import { ArrowLeft, Check, Pencil, Plus, Search, Trash2, Users, X } from 'lucide-vue-next'
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { http } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import AccountTagMemberEditor from '@/components/AccountTagMemberEditor.vue'
interface Tag { id: string; name: string; description?: string; member_count: number }
const emit = defineEmits<{ changed: []; members: [tag: Tag] }>()
const auth = useAuthStore()
const rows = ref<Tag[]>([])
const keyword = ref('')
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const editing = ref<string | null>(null)
const name = ref('')
const description = ref('')
const activeTag = ref<Tag | null>(null)
const memberEditor = ref<InstanceType<typeof AccountTagMemberEditor> | null>(null)
async function returnToTags() {
  if (memberEditor.value?.isBusy()) return
  if (memberEditor.value?.hasPendingSelection()) {
    try { await ElMessageBox.confirm('尚有未添加的账号，返回后将清空选择，确认返回？', '返回标签列表', { confirmButtonText: '返回', cancelButtonText: '继续添加' }) }
    catch { return }
  }
  activeTag.value = null
  await load()
}
function membersChanged() { emit('changed') }
let sequence = 0
async function load() {
  const request = ++sequence
  loading.value = true
  error.value = ''
  try {
    const data = await http.get<{ items: Tag[]; total: number }>('/api/account-tags', { keyword: keyword.value, page: page.value, page_size: 20 })
    if (request === sequence) { rows.value = data.items; total.value = data.total }
  } catch (e) { if (request === sequence) error.value = e instanceof Error ? e.message : '标签加载失败' }
  finally { if (request === sequence) loading.value = false }
}
function edit(tag?: Tag) { editing.value = tag?.id || ''; name.value = tag?.name || ''; description.value = tag?.description || '' }
async function save() {
  if (busy.value || editing.value === null) return
  if (!auth.can(editing.value ? 'accounts.edit' : 'accounts.create')) return
  if (!name.value.trim()) { ElMessage.warning('请填写标签名称'); return }
  busy.value = true
  try {
    const body = { name: name.value.trim(), description: description.value.trim() }
    if (editing.value) await http.put(`/api/account-tags/${encodeURIComponent(editing.value)}`, body)
    else await http.post('/api/account-tags', body)
    editing.value = null
    emit('changed')
    ElMessage.success('标签已保存')
    await load()
  } catch (e) { ElMessage.error(e instanceof Error ? e.message : '保存失败') }
  finally { busy.value = false }
}
async function remove(tag: Tag) {
  if (busy.value || !auth.can('accounts.delete')) return
  busy.value = true
  try {
    await ElMessageBox.confirm(`确认删除标签“${tag.name}”？将解除账号与该标签的关联，不会删除账号。`, '删除标签', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
    await http.delete(`/api/account-tags/${encodeURIComponent(tag.id)}`)
    if (editing.value === tag.id) editing.value = null
    emit('changed')
    if (rows.value.length === 1 && page.value > 1) page.value -= 1
    await load()
  } catch (e) { if (e !== 'cancel' && e !== 'close') ElMessage.error(e instanceof Error ? e.message : '删除失败') }
  finally { busy.value = false }
}
function search() { page.value = 1; void load() }
onMounted(load)
onBeforeUnmount(() => { ++sequence })
defineExpose({ hasUnsavedChanges: () => editing.value !== null || Boolean(memberEditor.value?.hasPendingSelection()), isBusy: () => busy.value || Boolean(memberEditor.value?.isBusy()) })
</script>

<template>
  <div class="tag-manager">
    <template v-if="activeTag">
      <div class="tag-manager__toolbar">
        <el-button :icon="ArrowLeft" @click="returnToTags">返回标签列表</el-button>
        <strong>{{ activeTag.name }}</strong>
      </div>
      <AccountTagMemberEditor ref="memberEditor" :tag="activeTag" embedded @changed="membersChanged" />
    </template>
    <div v-show="!activeTag" class="tag-manager">
    <div class="tag-manager__toolbar">
      <el-input v-model="keyword" placeholder="搜索标签名称 / 说明" clearable @keyup.enter="search" @clear="search" />
      <el-tooltip content="查询"><el-button :icon="Search" aria-label="查询标签" @click="search" /></el-tooltip>
      <el-button v-if="auth.can('accounts.create')" :icon="Plus" :disabled="busy || editing !== null" @click="edit()">新增标签</el-button>
    </div>
    <el-form v-if="editing !== null" label-position="top" class="tag-manager__form" @submit.prevent="save">
      <el-form-item label="标签名称" required><el-input v-model="name" maxlength="80" :disabled="busy" /></el-form-item>
      <el-form-item label="说明"><el-input v-model="description" type="textarea" maxlength="500" :disabled="busy" /></el-form-item>
      <el-button type="primary" :icon="Check" :loading="busy" @click="save">保存</el-button>
      <el-button :icon="X" :disabled="busy" @click="editing = null">取消</el-button>
    </el-form>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-table v-loading="loading" :data="rows" border stripe table-layout="fixed" empty-text="暂无标签">
      <el-table-column prop="name" label="标签名称" min-width="160" show-overflow-tooltip />
      <el-table-column prop="description" label="说明" min-width="150" show-overflow-tooltip />
      <el-table-column label="关联账号数" width="110" align="center"><template #default="{ row }"><el-button link type="primary" :disabled="busy || editing !== null" @click="emit('members', row as Tag)">{{ row.member_count }}</el-button></template></el-table-column>
      <el-table-column label="操作" width="130" align="center"><template #default="{ row }">
        <el-tooltip content="管理标签成员"><el-button link :icon="Users" aria-label="管理标签成员" :disabled="busy || editing !== null" @click="activeTag = row as Tag" /></el-tooltip>
        <el-tooltip v-if="auth.can('accounts.edit')" content="编辑标签"><el-button link :icon="Pencil" aria-label="编辑标签" :disabled="busy || editing !== null" @click="edit(row as Tag)" /></el-tooltip>
        <el-tooltip v-if="auth.can('accounts.delete')" content="删除标签"><el-button link type="danger" :icon="Trash2" aria-label="删除标签" :disabled="busy || editing !== null" @click="remove(row as Tag)" /></el-tooltip>
      </template></el-table-column>
    </el-table>
    <el-pagination v-model:current-page="page" :page-size="20" :total="total" layout="total, prev, pager, next" @current-change="load" />
    </div>
  </div>
</template>

<style scoped>
.tag-manager { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.tag-manager__toolbar { display: flex; align-items: center; gap: 8px; }
.tag-manager__toolbar .el-input { flex: 1; min-width: 100px; }
.tag-manager__toolbar .el-button + .el-button { margin-left: 0; }
.tag-manager__form { padding-bottom: 16px; border-bottom: 1px solid var(--app-border, #e6edf3); }
</style>
