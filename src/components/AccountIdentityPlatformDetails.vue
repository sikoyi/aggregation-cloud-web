<script setup lang="ts">
import { AlertTriangle, Copy, ExternalLink, MapPin, Pencil, RefreshCw, Scissors, Trash2, Unlink } from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'

import { http, resolveBackendUrl } from '@/api/http'
import StatusBadge from '@/components/StatusBadge.vue'
import PlatformAccountEditDialog from '@/components/PlatformAccountEditDialog.vue'
import { businessPlatformLabel } from '@/config/options'
import { useAuthStore } from '@/stores/auth'
import type { AnyRecord } from '@/types/api'
import { formatDate } from '@/utils/format'
import { notifyError } from '@/utils/notify'

const props = defineProps<{
  identityId: string
  businessPlatform?: string
  matchedAccountIds?: string[]
  canSplit?: boolean
}>()

const emit = defineEmits<{
  changed: []
  bindingConflicts: [id: string]
}>()

const auth = useAuthStore()
const loading = ref(false)
const actionLoading = ref('')
const rows = ref<AnyRecord[]>([])
const editingAccount = ref<AnyRecord | null>(null)
let requestSequence = 0

async function platformAccountChanged() {
  await loadRows()
  emit('changed')
}

async function loadRows() {
  const request = ++requestSequence
  if (props.matchedAccountIds && !props.matchedAccountIds.length) {
    rows.value = []
    loading.value = false
    return
  }
  loading.value = true
  try {
    const data = await http.get<{ identity_id: string; items: AnyRecord[] }>(
      `/api/account-identities/${encodeURIComponent(props.identityId)}/accounts`,
      { business_platform: props.businessPlatform, account_ids: props.matchedAccountIds?.join(',') },
    )
    if (request !== requestSequence) return
    rows.value = Array.isArray(data.items) ? data.items : []
  } catch (error) {
    if (request === requestSequence) notifyError(error, '平台账号加载失败', '平台账号加载失败')
  } finally {
    if (request === requestSequence) loading.value = false
  }
}

function accountLabel(row: AnyRecord) {
  return String(row.display_name || row.username || row.login_username || `账号 #${row.id}`)
}

function accountTags(row: AnyRecord) {
  return Array.isArray(row.tag_names)
    ? row.tag_names.map((item) => String(item).trim()).filter(Boolean)
    : []
}

async function copyBackupUrl(value: unknown) {
  const backupUrl = String(value || '').trim()
  if (!backupUrl) return
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
    await navigator.clipboard.writeText(backupUrl)
    ElMessage.success('备份地址已复制')
  } catch {
    ElMessage.error('复制失败，请手动打开备份地址')
  }
}

async function unbindSession(row: AnyRecord) {
  const sessionId = String(row.account_session_id || '')
  const bindingVersion = Number(row.account_session_binding_version || 0)
  if (!sessionId || bindingVersion < 1) return
  const platform = businessPlatformLabel(row.business_platform)
  try {
    await ElMessageBox.confirm(
      `确认解除 ${platform} 在设备“${row.bound_slot_name || row.bound_slot_provider_id || row.account_session_slot_id}”上的系统关联？不会删除平台账号，也不会执行浏览器退出登录。`,
      `解除 ${platform} 会话`,
      { type: 'warning', confirmButtonText: '确认解除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }

  actionLoading.value = `unbind:${sessionId}`
  try {
    await http.deleteWithBody(`/api/account-identities/sessions/${encodeURIComponent(sessionId)}`, {
      expected_binding_version: bindingVersion,
      reason: '运营在账号管理中人工解除平台会话',
    })
    ElMessage.success(`${platform} 设备会话已解除`)
    await loadRows()
    emit('changed')
  } catch (error) {
    notifyError(error, '解除失败', `${platform} 设备会话解除失败`)
  } finally {
    actionLoading.value = ''
  }
}

async function splitAccount(row: AnyRecord) {
  if (!props.canSplit) return
  const platform = businessPlatformLabel(row.business_platform)
  try {
    await ElMessageBox.confirm(
      `确认将 ${platform} 账号“${accountLabel(row)}”从当前登录身份拆分？账号、内容和历史数据不会被删除。`,
      '拆分登录身份',
      { type: 'warning', confirmButtonText: '确认拆分', cancelButtonText: '取消' },
    )
  } catch {
    return
  }

  actionLoading.value = `split:${row.id}`
  try {
    await http.post(`/api/account-identities/accounts/${encodeURIComponent(String(row.id))}/split`)
    ElMessage.success(`${platform} 账号已拆分为独立登录身份`)
    emit('changed')
  } catch (error) {
    notifyError(error, '拆分失败', '平台账号拆分失败')
  } finally {
    actionLoading.value = ''
  }
}

async function deleteAccount(row: AnyRecord) {
  const platform = businessPlatformLabel(row.business_platform)
  const label = accountLabel(row)
  try {
    await ElMessageBox.confirm(
      `确认删除 ${platform} 平台账号“${label}”？设备会话、发布内容、评论、指标、监听记录、备份及其他关联数据会一并清理，此操作不可恢复。`,
      `删除 ${platform} 平台账号`,
      {
        type: 'error',
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger',
      },
    )
  } catch {
    return
  }

  actionLoading.value = `delete:${row.id}`
  try {
    await http.delete(`/api/accounts/${encodeURIComponent(String(row.id))}`)
    ElMessage.success(`${platform} 平台账号已删除`)
    await loadRows()
    emit('changed')
  } catch (error) {
    notifyError(error, '删除失败', `${platform} 平台账号删除失败`)
  } finally {
    actionLoading.value = ''
  }
}

watch(() => [props.identityId, props.businessPlatform, props.matchedAccountIds?.join(',')], () => {
  rows.value = []
  editingAccount.value = null
  void loadRows()
})
onBeforeUnmount(() => { ++requestSequence })
onMounted(loadRows)
</script>

<template>
  <section class="identity-details">
    <div class="identity-details__header">
      <div>
        <strong>平台账号与设备会话</strong>
        <span>各业务 App 状态相互独立</span>
      </div>
      <el-tooltip content="刷新平台明细" placement="top">
        <el-button :icon="RefreshCw" circle text :loading="loading" @click="loadRows" />
      </el-tooltip>
    </div>

    <el-table
      v-loading="loading"
      :data="rows"
      border
      stripe
      table-layout="fixed"
      empty-text="暂无可见平台账号"
    >
      <el-table-column label="平台账号" min-width="210">
        <template #default="{ row }">
          <div class="platform-account-identity">
            <el-avatar :size="34" :src="resolveBackendUrl(row.avatar_url) || undefined" fit="cover" class="platform-account-identity__avatar">
              {{ Array.from(accountLabel(row))[0] }}
            </el-avatar>
            <div class="platform-account">
              <span class="platform-account__heading">
                <strong>{{ accountLabel(row) }}</strong>
                <el-tag v-if="row.credentials_exported_at" size="small" type="warning" effect="plain">已导出</el-tag>
              </span>
              <small v-if="row.username">@{{ row.username }}</small>
              <small>账号 ID {{ row.id }}<span v-if="row.platform_account_id"> · 平台 ID {{ row.platform_account_id }}</span></small>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="平台 / 国家" width="145" align="center">
        <template #default="{ row }">
          <div class="account-attributes">
            <el-tag effect="plain">{{ businessPlatformLabel(row.business_platform) }}</el-tag>
            <span class="account-attributes__country"><MapPin />{{ row.country || '国家未填写' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="登录状态" width="155" align="center">
        <template #default="{ row }">
          <div class="status-stack">
            <StatusBadge :value="row.login_status === 'banned' ? 'banned' : row.account_session_login_status || row.login_status || 'unknown'" />
            <small v-if="row.account_session_observed_at">{{ formatDate(row.account_session_observed_at) }}</small>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="账号标签" min-width="165">
        <template #default="{ row }">
          <div class="platform-tags">
            <el-tag
              v-for="tag in accountTags(row).slice(0, 2)"
              :key="tag"
              size="small"
              type="primary"
              effect="plain"
              round
            >
              {{ tag }}
            </el-tag>
            <el-tooltip v-if="accountTags(row).length > 2" :content="accountTags(row).slice(2).join('、')" placement="top">
              <el-tag size="small" type="info" effect="plain" round>+{{ accountTags(row).length - 2 }}</el-tag>
            </el-tooltip>
            <span v-if="!accountTags(row).length" class="identity-details__empty">暂无标签</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="账号类型" width="100" align="center">
        <template #default="{ row }">
          <StatusBadge :value="row.account_age_type || 'unknown'" />
        </template>
      </el-table-column>
      <el-table-column label="绑定设备" min-width="190">
        <template #default="{ row }">
          <div class="bound-device">
            <template v-if="row.account_session_id">
              <strong>{{ row.bound_slot_name || row.bound_slot_provider_id || `设备 #${row.account_session_slot_id}` }}</strong>
              <small v-if="row.bound_slot_provider_id">{{ row.bound_slot_provider_id }}</small>
            </template>
            <span v-else class="identity-details__empty">未绑定设备</span>
            <small class="bound-device__group">设备分组：{{ row.bound_slot_group_name || '未分组' }}</small>
            <el-button v-if="Number(row.binding_conflict_count || 0) > 0" class="bound-device__conflict"
              type="warning" text size="small" :icon="AlertTriangle"
              @click.stop="emit('bindingConflicts', String(row.id))">
              绑定冲突 {{ row.binding_conflict_count }}
            </el-button>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="养号状态" width="110" align="center">
        <template #default="{ row }"><StatusBadge :value="row.warmup_status" /></template>
      </el-table-column>
      <el-table-column label="内容监听" width="115" align="center">
        <template #default="{ row }">
          <template v-if="row.business_platform === 'shopify'">
            <span v-if="row.credentials_exported_at" class="identity-details__empty">已导出，停止</span>
            <span v-else-if="row.login_status === 'banned'">已封号，停止</span>
            <router-link v-else-if="row.profile_url" to="/account-data?view=shopify">店铺监听</router-link>
            <span v-else class="identity-details__empty">缺少店铺链接</span>
          </template>
          <span v-else-if="row.content_monitor_enabled === null || row.content_monitor_enabled === undefined" class="identity-details__empty">未配置</span>
          <StatusBadge v-else :value="row.content_monitor_enabled ? row.content_monitor_status : 'disabled'" />
        </template>
      </el-table-column>
      <el-table-column label="备份数据" width="135" align="center">
        <template #default="{ row }">
          <div v-if="row.account_package_download_url" class="backup-data">
            <el-tag type="success" effect="plain" round>已备份</el-tag>
            <span class="backup-data__actions">
              <el-tooltip content="打开备份地址" placement="top">
                <el-button
                  tag="a"
                  text
                  circle
                  :icon="ExternalLink"
                  :href="row.account_package_download_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="打开备份地址"
                />
              </el-tooltip>
              <el-tooltip content="复制备份地址" placement="top">
                <el-button
                  text
                  circle
                  :icon="Copy"
                  aria-label="复制备份地址"
                  @click.stop="copyBackupUrl(row.account_package_download_url)"
                />
              </el-tooltip>
            </span>
          </div>
          <el-tag v-else type="info" effect="plain" round>未备份</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="190" align="center">
        <template #default="{ row }">
          <div v-if="auth.can('accounts.edit') || auth.can('accounts.delete')" class="identity-details__actions">
            <template v-if="auth.can('accounts.edit')">
              <el-tooltip content="编辑平台账号" placement="top">
                <el-button text :icon="Pencil" aria-label="编辑平台账号" @click="editingAccount = row" />
              </el-tooltip>
              <el-tooltip v-if="row.account_session_id" :content="`仅解除 ${businessPlatformLabel(row.business_platform)} 会话`" placement="top">
                <el-button
                  text
                  type="warning"
                  :icon="Unlink"
                  :loading="actionLoading === `unbind:${row.account_session_id}`"
                  @click="unbindSession(row)"
                />
              </el-tooltip>
              <el-tooltip v-if="canSplit" content="从当前登录身份拆分" placement="top">
                <el-button
                  text
                  :icon="Scissors"
                  :loading="actionLoading === `split:${row.id}`"
                  @click="splitAccount(row)"
                />
              </el-tooltip>
              <el-tooltip v-if="row.profile_url" content="打开账号主页" placement="top">
                <el-button
                  tag="a"
                  text
                  :icon="ExternalLink"
                  :href="resolveBackendUrl(row.profile_url)"
                  target="_blank"
                  rel="noopener noreferrer"
                />
              </el-tooltip>
            </template>
            <el-tooltip v-if="auth.can('accounts.delete')" content="删除该平台账号" placement="top">
              <el-button
                text
                type="danger"
                :icon="Trash2"
                :loading="actionLoading === `delete:${row.id}`"
                aria-label="删除平台账号"
                @click="deleteAccount(row)"
              />
            </el-tooltip>
          </div>
          <span v-else class="identity-details__empty">只读</span>
        </template>
      </el-table-column>
    </el-table>
    <PlatformAccountEditDialog v-if="editingAccount" :key="String(editingAccount.id)"
      :account-id="String(editingAccount.id)" :platform="String(editingAccount.business_platform)"
      @close="editingAccount = null" @changed="platformAccountChanged" />
  </section>
</template>

<style scoped>
.identity-details { padding: 14px 18px 18px 48px; background: var(--app-surface-muted, #f8fafc); }
.identity-details__header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.identity-details__header > div { display: flex; align-items: baseline; gap: 8px; }
.identity-details__header strong { color: var(--app-text, #243b53); font-size: 13px; }
.identity-details__header span { color: var(--app-text-muted, #8293a5); font-size: 11px; }
.platform-account-identity { display: flex; min-width: 0; align-items: center; gap: 8px; }
.platform-account-identity__avatar { width: 34px; height: 34px; flex: 0 0 34px; color: var(--app-blue, #245f87); background: var(--app-surface-muted, #edf6fc); }
.platform-account-identity .platform-account { flex: 1; }
.platform-account,
.bound-device,
.status-stack { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
.platform-account strong,
.bound-device strong { overflow: hidden; color: var(--app-text, #334e68); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.platform-account__heading { display: flex; min-width: 0; align-items: center; gap: 5px; }
.platform-account__heading strong { min-width: 0; }
.platform-account__heading :deep(.el-tag) { flex: 0 0 auto; }
.platform-account small,
.bound-device small,
.status-stack small { overflow: hidden; color: var(--app-text-muted, #8494a5); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.status-stack { align-items: center; }
.account-attributes { display: flex; min-width: 0; flex-direction: column; align-items: center; gap: 5px; }
.account-attributes__country { display: inline-flex; max-width: 100%; align-items: center; gap: 3px; overflow: hidden; color: var(--app-text-muted, #657b8f); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.account-attributes__country svg { width: 12px; height: 12px; flex: 0 0 12px; }
.platform-tags { display: flex; min-width: 0; flex-wrap: wrap; gap: 4px; }
.bound-device__group { color: var(--app-text-muted, #526f86) !important; }
.bound-device__conflict { align-self: flex-start; }
.backup-data { display: flex; align-items: center; justify-content: center; gap: 3px; }
.backup-data__actions { display: inline-flex; align-items: center; gap: 0; }
.backup-data__actions :deep(.el-button + .el-button) { margin-left: 0; }
.backup-data__actions :deep(.el-button) { width: 26px; height: 26px; }
.identity-details__actions { display: flex; align-items: center; justify-content: center; gap: 2px; }
.identity-details__actions :deep(.el-button + .el-button) { margin-left: 0; }
.identity-details__empty { color: var(--app-text-muted, #9aa9b8); font-size: 11px; }
</style>
