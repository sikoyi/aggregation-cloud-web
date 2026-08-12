<script setup lang="ts">
import { LockKeyhole, Pencil, Plus, RefreshCw, Search, ShieldCheck, Trash2 } from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'

import {
  createRole,
  deleteRole,
  listPermissions,
  listRoles,
  updateRole,
  updateRoleStatus,
  type PermissionGroup,
  type Role,
} from '@/api/rbac'
import { useAuthStore } from '@/stores/auth'
import { formatDate } from '@/utils/format'
import { notifyError } from '@/utils/notify'

const auth = useAuthStore()
const loading = ref(false)
const submitting = ref(false)
const roles = ref<Role[]>([])
const permissionGroups = ref<PermissionGroup[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const filters = reactive({ keyword: '', status: '' })

const editorVisible = ref(false)
const editorMode = ref<'create' | 'edit'>('create')
const editingRole = ref<Role | null>(null)
const editor = reactive({
  name: '',
  description: '',
  permission_codes: [] as string[],
})

const allPermissionCodes = computed(() =>
  permissionGroups.value.flatMap((group) => group.items.map((item) => item.code)),
)
const selectedCount = computed(() => editor.permission_codes.length)

async function loadPermissionCatalog() {
  try {
    permissionGroups.value = await listPermissions()
  } catch (error) {
    notifyError(error, '权限目录加载失败')
  }
}

async function loadRoles(resetPage = false) {
  if (resetPage) page.value = 1
  loading.value = true
  try {
    const data = await listRoles({
      keyword: filters.keyword.trim() || undefined,
      status: filters.status || undefined,
      page: page.value,
      page_size: pageSize.value,
    })
    roles.value = data.items
    total.value = data.total
  } catch (error) {
    notifyError(error, '角色加载失败')
  } finally {
    loading.value = false
  }
}

function asRole(row: unknown) {
  return row as Role
}

function resetFilters() {
  filters.keyword = ''
  filters.status = ''
  void loadRoles(true)
}

function openCreate() {
  editorMode.value = 'create'
  editingRole.value = null
  editor.name = ''
  editor.description = ''
  editor.permission_codes = []
  editorVisible.value = true
}

function openEdit(role: Role) {
  editorMode.value = 'edit'
  editingRole.value = role
  editor.name = role.name
  editor.description = role.description || ''
  editor.permission_codes = [...role.permission_codes]
  editorVisible.value = true
}

function groupChecked(group: PermissionGroup) {
  return group.items.every((item) => editor.permission_codes.includes(item.code))
}

function groupIndeterminate(group: PermissionGroup) {
  const count = group.items.filter((item) => editor.permission_codes.includes(item.code)).length
  return count > 0 && count < group.items.length
}

function setGroup(group: PermissionGroup, checked: boolean) {
  const codes = new Set(editor.permission_codes)
  group.items.forEach((item) => checked ? codes.add(item.code) : codes.delete(item.code))
  editor.permission_codes = [...codes]
}

function selectAllPermissions() {
  editor.permission_codes = [...allPermissionCodes.value]
}

function clearPermissions() {
  editor.permission_codes = []
}

async function submitEditor() {
  if (!editor.name.trim()) {
    ElMessage.warning('请填写角色名称')
    return
  }
  submitting.value = true
  try {
    if (editorMode.value === 'create') {
      await createRole({
        name: editor.name.trim(),
        description: editor.description.trim() || undefined,
        permission_codes: editor.permission_codes,
      })
      ElMessage.success('角色已创建')
    } else if (editingRole.value) {
      await updateRole(editingRole.value.id, {
        name: editor.name.trim(),
        description: editor.description.trim() || undefined,
        permission_codes: editor.permission_codes,
        version: editingRole.value.version,
      })
      ElMessage.success('角色已更新，相关用户需要重新登录')
    }
    editorVisible.value = false
    await loadRoles()
  } catch (error) {
    notifyError(error, editorMode.value === 'create' ? '创建角色失败' : '更新角色失败')
  } finally {
    submitting.value = false
  }
}

async function toggleStatus(role: Role) {
  const target = role.status === 'active' ? 'disabled' : 'active'
  const action = target === 'active' ? '启用' : '禁用'
  try {
    await ElMessageBox.confirm(
      target === 'disabled'
        ? '禁用后角色权限立即失效，系统会检查是否有用户因此失去全部可用角色。确认继续吗？'
        : `确认启用角色“${role.name}”吗？`,
      `${action}角色`,
      { type: target === 'disabled' ? 'warning' : 'info', confirmButtonText: action },
    )
    await updateRoleStatus(role.id, { status: target, version: role.version })
    ElMessage.success(`角色已${action}`)
    await loadRoles()
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    notifyError(error, `${action}角色失败`)
  }
}

async function removeRole(role: Role) {
  try {
    await ElMessageBox.confirm(
      `确认删除角色“${role.name}”吗？已分配给用户的角色不能删除。`,
      '删除角色',
      { type: 'warning', confirmButtonText: '删除', confirmButtonClass: 'el-button--danger' },
    )
    await deleteRole(role.id)
    ElMessage.success('角色已删除')
    await loadRoles()
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    notifyError(error, '删除角色失败')
  }
}

onMounted(async () => {
  await Promise.all([loadPermissionCatalog(), loadRoles()])
})
</script>

<template>
  <section class="access-page">
    <div class="access-page__header">
      <div class="access-page__title">
        <div class="access-page__icon"><ShieldCheck :size="20" /></div>
        <div>
          <h1>角色管理</h1>
          <p>通过角色组合业务权限，内置角色由系统统一维护。</p>
        </div>
      </div>
      <div class="access-page__commands">
        <el-tooltip content="刷新">
          <el-button circle :icon="RefreshCw" :loading="loading" @click="loadRoles()" />
        </el-tooltip>
        <el-button v-if="auth.can('roles.create')" type="primary" :icon="Plus" @click="openCreate">新增角色</el-button>
      </div>
    </div>

    <div class="access-page__filters">
      <div class="filter-item filter-item--keyword">
        <label>关键词</label>
        <el-input v-model="filters.keyword" placeholder="角色名称 / 编码 / 说明" clearable @keyup.enter="loadRoles(true)" />
      </div>
      <div class="filter-item">
        <label>角色状态</label>
        <el-select v-model="filters.status" clearable placeholder="全部">
          <el-option label="启用" value="active" />
          <el-option label="禁用" value="disabled" />
        </el-select>
      </div>
      <div class="filter-actions">
        <el-button @click="resetFilters">清空</el-button>
        <el-button type="primary" :icon="Search" :loading="loading" @click="loadRoles(true)">查询</el-button>
      </div>
    </div>

    <div class="access-page__table">
      <el-table v-loading="loading" :data="roles" border row-key="id">
        <el-table-column prop="id" label="ID" width="80" align="center" />
        <el-table-column label="角色信息" min-width="240">
          <template #default="{ row }">
            <div class="role-cell">
              <div class="role-cell__icon"><LockKeyhole :size="16" /></div>
              <div>
                <strong>{{ row.name }}</strong>
                <span>{{ row.description || '暂无说明' }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="角色编码" min-width="160" align="center">
          <template #default="{ row }"><el-tag effect="plain">{{ row.code }}</el-tag></template>
        </el-table-column>
        <el-table-column label="类型" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="row.is_system ? 'primary' : 'info'" effect="light">{{ row.is_system ? '系统内置' : '自定义' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="权限数量" width="110" align="center">
          <template #default="{ row }">{{ row.code === 'super_admin' ? '全部' : row.permission_codes.length }}</template>
        </el-table-column>
        <el-table-column prop="user_count" label="用户数" width="100" align="center" />
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'">{{ row.status === 'active' ? '启用' : '禁用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" min-width="170" align="center">
          <template #default="{ row }">{{ formatDate(row.updated_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right" align="center">
          <template #default="{ row }">
            <div v-if="!row.is_system" class="row-actions">
              <el-tooltip v-if="auth.can('roles.edit')" content="编辑">
                <el-button circle text :icon="Pencil" @click="openEdit(asRole(row))" />
              </el-tooltip>
              <el-button v-if="auth.can('roles.disable')" link :type="row.status === 'active' ? 'warning' : 'success'" @click="toggleStatus(asRole(row))">
                {{ row.status === 'active' ? '禁用' : '启用' }}
              </el-button>
              <el-tooltip v-if="auth.can('roles.delete')" content="删除">
                <el-button circle text type="danger" :icon="Trash2" @click="removeRole(asRole(row))" />
              </el-tooltip>
            </div>
            <span v-else class="immutable-hint">系统维护</span>
          </template>
        </el-table-column>
      </el-table>
      <div class="access-page__pagination">
        <span>共 {{ total }} 条</span>
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          layout="sizes, prev, pager, next"
          :page-sizes="[20, 50, 100]"
          :total="total"
          @change="loadRoles()"
        />
      </div>
    </div>

    <el-dialog v-model="editorVisible" :title="editorMode === 'create' ? '新增角色' : '编辑角色'" width="760px" destroy-on-close>
      <el-form label-position="top">
        <div class="form-grid">
          <el-form-item label="角色名称" required><el-input v-model="editor.name" maxlength="80" /></el-form-item>
          <el-form-item label="角色说明"><el-input v-model="editor.description" maxlength="500" /></el-form-item>
        </div>
        <el-form-item required>
          <template #label>
            <div class="permission-heading">
              <span>权限范围</span>
              <span>已选 {{ selectedCount }} 项</span>
              <el-button link type="primary" @click="selectAllPermissions">全选</el-button>
              <el-button link @click="clearPermissions">清空</el-button>
            </div>
          </template>
          <div class="permission-grid">
            <div v-for="group in permissionGroups" :key="group.module" class="permission-group">
              <div class="permission-group__header">
                <el-checkbox
                  :model-value="groupChecked(group)"
                  :indeterminate="groupIndeterminate(group)"
                  @change="setGroup(group, Boolean($event))"
                >
                  {{ group.module_name }}
                </el-checkbox>
              </div>
              <el-checkbox-group v-model="editor.permission_codes" class="permission-group__items">
                <el-checkbox v-for="item in group.items" :key="item.code" :value="item.code">{{ item.name }}</el-checkbox>
              </el-checkbox-group>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editorVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitEditor">确认</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.access-page { overflow: hidden; border: 1px solid #d9e2ec; border-radius: 8px; background: #fff; }
.access-page__header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #e6edf3; }
.access-page__title, .access-page__commands, .role-cell, .row-actions, .permission-heading { display: flex; align-items: center; }
.access-page__title { gap: 10px; }
.access-page__title h1 { margin: 0; color: #1f2933; font-size: 18px; }
.access-page__title p { margin: 3px 0 0; color: #66788a; font-size: 12px; }
.access-page__icon { display: grid; width: 34px; height: 34px; place-items: center; border-radius: 8px; color: #1f668f; background: #eef8ff; }
.access-page__commands, .row-actions { gap: 8px; }
.access-page__filters { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; padding: 14px 16px; border-bottom: 1px solid #e6edf3; background: #f8fafc; }
.filter-item { width: 180px; }
.filter-item--keyword { width: 300px; }
.filter-item label { display: block; margin-bottom: 6px; color: #52606d; font-size: 12px; font-weight: 600; }
.filter-actions { display: flex; gap: 8px; }
.access-page__table { padding: 16px; }
.access-page__pagination { display: flex; align-items: center; justify-content: flex-end; gap: 14px; padding-top: 14px; color: #66788a; font-size: 13px; }
.role-cell { gap: 10px; }
.role-cell__icon { display: grid; width: 34px; height: 34px; place-items: center; border: 1px solid #cfe3f2; border-radius: 8px; color: #1f668f; background: #f3f9fd; }
.role-cell strong, .role-cell span { display: block; }
.role-cell strong { color: #1f2933; font-size: 13px; }
.role-cell span, .immutable-hint { margin-top: 3px; color: #7b8794; font-size: 12px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.permission-heading { width: 100%; gap: 10px; }
.permission-heading span:nth-child(2) { margin-left: auto; color: #7b8794; font-size: 12px; }
.permission-grid { display: grid; width: 100%; max-height: 440px; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; overflow-y: auto; }
.permission-group { overflow: hidden; border: 1px solid #dbe4ed; border-radius: 6px; }
.permission-group__header { padding: 9px 11px; border-bottom: 1px solid #e6edf3; background: #f8fafc; }
.permission-group__items { display: flex; min-height: 74px; flex-direction: column; align-items: flex-start; gap: 5px; padding: 10px 12px; }
.permission-group__items :deep(.el-checkbox) { height: 24px; margin-right: 0; }
@media (max-width: 900px) { .permission-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 620px) { .permission-grid, .form-grid { grid-template-columns: 1fr; } .filter-item, .filter-item--keyword { width: 100%; } }
</style>
