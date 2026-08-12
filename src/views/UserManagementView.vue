<script setup lang="ts">
import { KeyRound, Pencil, Plus, RefreshCw, Search, ShieldCheck, UserCog } from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'

import {
  assignUserRoles,
  createUser,
  listAllRoles,
  listUsers,
  resetUserPassword,
  updateUser,
  updateUserStatus,
  type Role,
  type SystemUser,
} from '@/api/rbac'
import { useAuthStore } from '@/stores/auth'
import { formatDate } from '@/utils/format'
import { notifyError } from '@/utils/notify'

const auth = useAuthStore()
const loading = ref(false)
const submitting = ref(false)
const users = ref<SystemUser[]>([])
const roles = ref<Role[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const filters = reactive({ keyword: '', status: '', role_id: '' })

const editorVisible = ref(false)
const editorMode = ref<'create' | 'edit'>('create')
const editingUser = ref<SystemUser | null>(null)
const editor = reactive({
  username: '',
  display_name: '',
  password: '',
  role_ids: [] as string[],
})

const passwordVisible = ref(false)
const passwordUser = ref<SystemUser | null>(null)
const passwordForm = reactive({ new_password: '', confirm_password: '' })

const activeRoles = computed(() => roles.value.filter((role) => role.status === 'active'))

async function loadRoles() {
  try {
    roles.value = await listAllRoles()
  } catch (error) {
    notifyError(error, '角色加载失败')
  }
}

async function loadUsers(resetPage = false) {
  if (resetPage) page.value = 1
  loading.value = true
  try {
    const data = await listUsers({
      keyword: filters.keyword.trim() || undefined,
      status: filters.status || undefined,
      role_id: filters.role_id || undefined,
      page: page.value,
      page_size: pageSize.value,
    })
    users.value = data.items
    total.value = data.total
  } catch (error) {
    notifyError(error, '用户加载失败')
  } finally {
    loading.value = false
  }
}

function asSystemUser(row: unknown) {
  return row as SystemUser
}

function resetFilters() {
  filters.keyword = ''
  filters.status = ''
  filters.role_id = ''
  void loadUsers(true)
}

function openCreate() {
  editorMode.value = 'create'
  editingUser.value = null
  editor.username = ''
  editor.display_name = ''
  editor.password = ''
  editor.role_ids = []
  editorVisible.value = true
}

function openEdit(user: SystemUser) {
  editorMode.value = 'edit'
  editingUser.value = user
  editor.username = user.username
  editor.display_name = user.display_name
  editor.password = ''
  editor.role_ids = [...user.role_ids]
  editorVisible.value = true
}

function validatePassword(password: string) {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password)
}

async function submitEditor() {
  if (!editor.display_name.trim()) {
    ElMessage.warning('请填写显示名称')
    return
  }
  if (!editor.role_ids.length) {
    ElMessage.warning('请至少选择一个角色')
    return
  }
  if (editorMode.value === 'create' && (!editor.username.trim() || !validatePassword(editor.password))) {
    ElMessage.warning('请填写用户名，密码至少 8 位且同时包含字母和数字')
    return
  }
  submitting.value = true
  try {
    if (editorMode.value === 'create') {
      await createUser({
        username: editor.username.trim(),
        display_name: editor.display_name.trim(),
        password: editor.password,
        role_ids: editor.role_ids,
      })
      ElMessage.success('用户已创建')
    } else if (editingUser.value) {
      let current = editingUser.value
      if (editor.display_name.trim() !== current.display_name) {
        current = await updateUser(current.id, {
          display_name: editor.display_name.trim(),
          version: current.version,
        })
      }
      const oldRoles = [...current.role_ids].sort().join(',')
      const newRoles = [...editor.role_ids].sort().join(',')
      if (oldRoles !== newRoles) {
        current = await assignUserRoles(current.id, {
          role_ids: editor.role_ids,
          version: current.version,
        })
      }
      editingUser.value = current
      ElMessage.success('用户已更新')
    }
    editorVisible.value = false
    await loadUsers()
  } catch (error) {
    notifyError(error, editorMode.value === 'create' ? '创建用户失败' : '更新用户失败')
  } finally {
    submitting.value = false
  }
}

async function toggleStatus(user: SystemUser) {
  const target = user.status === 'active' ? 'disabled' : 'active'
  const action = target === 'active' ? '启用' : '禁用'
  try {
    await ElMessageBox.confirm(
      target === 'disabled'
        ? `禁用后用户 ${user.username} 的现有登录会话会立即失效，确认继续吗？`
        : `确认启用用户 ${user.username} 吗？`,
      `${action}用户`,
      { type: target === 'disabled' ? 'warning' : 'info', confirmButtonText: action },
    )
    await updateUserStatus(user.id, { status: target, version: user.version })
    ElMessage.success(`用户已${action}`)
    await loadUsers()
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    notifyError(error, `${action}用户失败`)
  }
}

function openPasswordReset(user: SystemUser) {
  passwordUser.value = user
  passwordForm.new_password = ''
  passwordForm.confirm_password = ''
  passwordVisible.value = true
}

async function submitPasswordReset() {
  const user = passwordUser.value
  if (!user) return
  if (!validatePassword(passwordForm.new_password)) {
    ElMessage.warning('密码至少 8 位，且必须同时包含字母和数字')
    return
  }
  if (passwordForm.new_password !== passwordForm.confirm_password) {
    ElMessage.warning('两次输入的密码不一致')
    return
  }
  submitting.value = true
  try {
    await resetUserPassword(user.id, {
      new_password: passwordForm.new_password,
      version: user.version,
    })
    ElMessage.success('密码已重置，用户需要重新登录')
    passwordVisible.value = false
    await loadUsers()
  } catch (error) {
    notifyError(error, '重置密码失败')
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  await loadRoles()
  await loadUsers()
})
</script>

<template>
  <section class="access-page">
    <div class="access-page__header">
      <div class="access-page__title">
        <div class="access-page__icon"><UserCog :size="20" /></div>
        <div>
          <h1>用户管理</h1>
          <p>维护后台登录用户、角色归属和账号状态。</p>
        </div>
      </div>
      <div class="access-page__commands">
        <el-tooltip content="刷新">
          <el-button circle :icon="RefreshCw" :loading="loading" @click="loadUsers()" />
        </el-tooltip>
        <el-button v-if="auth.can('users.create')" type="primary" :icon="Plus" @click="openCreate">新增用户</el-button>
      </div>
    </div>

    <div class="access-page__filters">
      <div class="filter-item filter-item--keyword">
        <label>关键词</label>
        <el-input v-model="filters.keyword" placeholder="用户名 / 显示名称" clearable @keyup.enter="loadUsers(true)" />
      </div>
      <div class="filter-item">
        <label>用户状态</label>
        <el-select v-model="filters.status" clearable placeholder="全部">
          <el-option label="启用" value="active" />
          <el-option label="禁用" value="disabled" />
        </el-select>
      </div>
      <div class="filter-item">
        <label>所属角色</label>
        <el-select v-model="filters.role_id" clearable placeholder="全部角色">
          <el-option v-for="role in roles" :key="role.id" :label="role.name" :value="role.id" />
        </el-select>
      </div>
      <div class="filter-actions">
        <el-button @click="resetFilters">清空</el-button>
        <el-button type="primary" :icon="Search" :loading="loading" @click="loadUsers(true)">查询</el-button>
      </div>
    </div>

    <div class="access-page__table">
      <el-table v-loading="loading" :data="users" border row-key="id">
        <el-table-column prop="id" label="ID" width="80" align="center" />
        <el-table-column label="用户信息" min-width="210">
          <template #default="{ row }">
            <div class="user-cell">
              <el-avatar :size="34">{{ (row.display_name || row.username).slice(0, 1).toUpperCase() }}</el-avatar>
              <div><strong>{{ row.display_name }}</strong><span>{{ row.username }}</span></div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="角色" min-width="210" align="center">
          <template #default="{ row }">
            <div class="tag-list">
              <el-tag v-for="(name, index) in row.role_names" :key="row.role_ids[index]" effect="plain">
                {{ name }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'" effect="light">
              {{ row.status === 'active' ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最后登录" min-width="170" align="center">
          <template #default="{ row }">{{ row.last_login_at ? formatDate(row.last_login_at) : '尚未登录' }}</template>
        </el-table-column>
        <el-table-column label="更新时间" min-width="170" align="center">
          <template #default="{ row }">{{ formatDate(row.updated_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="190" fixed="right" align="center">
          <template #default="{ row }">
            <div class="row-actions">
              <el-tooltip v-if="auth.can('users.edit') || auth.can('users.assign_roles')" content="编辑">
                <el-button circle text :icon="Pencil" @click="openEdit(asSystemUser(row))" />
              </el-tooltip>
              <el-tooltip v-if="auth.can('users.reset_password')" content="重置密码">
                <el-button circle text :icon="KeyRound" @click="openPasswordReset(asSystemUser(row))" />
              </el-tooltip>
              <el-button
                v-if="auth.can('users.disable')"
                link
                :type="row.status === 'active' ? 'danger' : 'success'"
                :disabled="row.id === auth.user?.id"
                @click="toggleStatus(asSystemUser(row))"
              >
                {{ row.status === 'active' ? '禁用' : '启用' }}
              </el-button>
            </div>
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
          @change="loadUsers()"
        />
      </div>
    </div>

    <el-dialog v-model="editorVisible" :title="editorMode === 'create' ? '新增用户' : '编辑用户'" width="560px" destroy-on-close>
      <el-form label-position="top">
        <div class="form-grid">
          <el-form-item label="用户名" required>
            <el-input v-model="editor.username" :disabled="editorMode === 'edit'" placeholder="后台登录用户名" />
          </el-form-item>
          <el-form-item label="显示名称" required>
            <el-input v-model="editor.display_name" placeholder="运营人员可识别的名称" />
          </el-form-item>
        </div>
        <el-form-item v-if="editorMode === 'create'" label="初始密码" required>
          <el-input v-model="editor.password" type="password" show-password autocomplete="new-password" placeholder="至少 8 位，包含字母和数字" />
        </el-form-item>
        <el-form-item label="角色" required>
          <el-select v-model="editor.role_ids" multiple filterable class="w-full" placeholder="至少选择一个角色">
            <el-option v-for="role in activeRoles" :key="role.id" :label="role.name" :value="role.id">
              <div class="role-option"><ShieldCheck :size="14" /><span>{{ role.name }}</span><small>{{ role.description }}</small></div>
            </el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editorVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitEditor">确认</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="passwordVisible" title="重置密码" width="460px" destroy-on-close>
      <el-alert title="重置成功后，该用户当前所有登录会话会立即失效。" type="warning" :closable="false" show-icon />
      <el-form label-position="top" class="mt-4">
        <el-form-item label="新密码" required><el-input v-model="passwordForm.new_password" type="password" show-password /></el-form-item>
        <el-form-item label="确认新密码" required><el-input v-model="passwordForm.confirm_password" type="password" show-password @keyup.enter="submitPasswordReset" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitPasswordReset">确认重置</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.access-page { overflow: hidden; border: 1px solid #d9e2ec; border-radius: 8px; background: #fff; }
.access-page__header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #e6edf3; }
.access-page__title, .access-page__commands, .user-cell, .row-actions, .tag-list, .role-option { display: flex; align-items: center; }
.access-page__title { gap: 10px; }
.access-page__title h1 { margin: 0; color: #1f2933; font-size: 18px; }
.access-page__title p { margin: 3px 0 0; color: #66788a; font-size: 12px; }
.access-page__icon { display: grid; width: 34px; height: 34px; place-items: center; border-radius: 8px; color: #1f668f; background: #eef8ff; }
.access-page__commands, .row-actions, .tag-list { gap: 8px; }
.access-page__filters { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; padding: 14px 16px; border-bottom: 1px solid #e6edf3; background: #f8fafc; }
.filter-item { width: 180px; }
.filter-item--keyword { width: 260px; }
.filter-item label { display: block; margin-bottom: 6px; color: #52606d; font-size: 12px; font-weight: 600; }
.filter-actions { display: flex; gap: 8px; }
.access-page__table { padding: 16px; }
.access-page__pagination { display: flex; align-items: center; justify-content: flex-end; gap: 14px; padding-top: 14px; color: #66788a; font-size: 13px; }
.user-cell { gap: 10px; }
.user-cell strong, .user-cell span { display: block; }
.user-cell strong { color: #1f2933; font-size: 13px; }
.user-cell span { margin-top: 3px; color: #7b8794; font-size: 12px; }
.tag-list { flex-wrap: wrap; justify-content: center; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.role-option { gap: 7px; }
.role-option small { margin-left: auto; color: #9aa5b1; }
@media (max-width: 720px) { .access-page__header { align-items: flex-start; } .form-grid { grid-template-columns: 1fr; } .filter-item, .filter-item--keyword { width: 100%; } }
</style>
