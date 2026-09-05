<script setup lang="ts">
import { Copy, ExternalLink, MapPin, RefreshCw, Scissors, Trash2, Unlink } from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, reactive, ref, watch } from 'vue'

import { http, resolveBackendUrl } from '@/api/http'
import StatusBadge from '@/components/StatusBadge.vue'
import { businessPlatformLabel } from '@/config/options'
import { useAuthStore } from '@/stores/auth'
import type { AnyRecord } from '@/types/api'
import { formatDate } from '@/utils/format'
import { notifyError } from '@/utils/notify'

const props = defineProps<{
  identityId: string
}>()

const emit = defineEmits<{
  changed: []
}>()

const auth = useAuthStore()
const loading = ref(false)
const actionLoading = ref('')
const rows = ref<AnyRecord[]>([])
const healthDialogVisible = ref(false)
const healthForm = reactive({
  accountId: '',
  accountLabel: '',
  businessPlatform: '',
  platformHealthStatus: 'unknown',
  manualHealthOverride: true,
  reason: '',
})

const healthOptions = [
  { label: '未知', value: 'unknown' },
  { label: '正常', value: 'normal' },
  { label: '受限', value: 'restricted' },
  { label: '封禁', value: 'banned' },
  { label: '已停用', value: 'disabled' },
  { label: '已删除', value: 'deleted' },
]

async function loadRows() {
  loading.value = true
  try {
    const data = await http.get<{ identity_id: string; items: AnyRecord[] }>(
      `/api/account-identities/${encodeURIComponent(props.identityId)}/accounts`,
    )
    rows.value = Array.isArray(data.items) ? data.items : []
  } catch (error) {
    notifyError(error, '平台账号加载失败', '平台账号加载失败')
  } finally {
    loading.value = false
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

function openHealthDialog(row: AnyRecord) {
  healthForm.accountId = String(row.id)
  healthForm.accountLabel = accountLabel(row)
  healthForm.businessPlatform = String(row.business_platform || '')
  healthForm.platformHealthStatus = String(row.platform_health_status || 'unknown')
  healthForm.manualHealthOverride = Boolean(row.manual_health_override)
  const metadata = row.metadata && typeof row.metadata === 'object'
    ? row.metadata as AnyRecord
    : {}
  healthForm.reason = String(metadata.manual_health_reason || '')
  healthDialogVisible.value = true
}

async function updateHealth() {
  actionLoading.value = `health:${healthForm.accountId}`
  try {
    await http.put(`/api/account-identities/platform-accounts/${encodeURIComponent(healthForm.accountId)}/health`, {
      platform_health_status: healthForm.platformHealthStatus,
      manual_health_override: healthForm.manualHealthOverride,
      reason: healthForm.reason.trim() || null,
    })
    healthDialogVisible.value = false
    ElMessage.success('平台账号健康状态已更新')
    await loadRows()
    emit('changed')
  } catch (error) {
    notifyError(error, '修改失败', '平台账号健康状态修改失败')
  } finally {
    actionLoading.value = ''
  }
}

async function unbindSession(row: AnyRecord) {
  const sessionId = String(row.account_session_id || '')
  const bindingVersion = Number(row.account_session_binding_version || 0)
  if (!sessionId || bindingVersion < 1) return
  const platform = businessPlatformLabel(row.business_platform)
  try {
    await ElMessageBox.confirm(
      `确认解除 ${platform} 在设备“${row.bound_slot_name || row.bound_slot_provider_id || row.account_session_slot_id}”上的登录会话？不会删除平台账号。`,
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
  if (rows.value.length <= 1) return
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

watch(() => props.identityId, loadRows)
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
      <el-table-column label="平台 / 属性" width="145" align="center">
        <template #default="{ row }">
          <div class="account-attributes">
            <el-tag effect="plain">{{ businessPlatformLabel(row.business_platform) }}</el-tag>
            <span class="account-attributes__country"><MapPin />{{ row.country || '国家未填写' }}</span>
            <StatusBadge :value="row.account_age_type || 'unknown'" />
          </div>
        </template>
      </el-table-column>
      <el-table-column label="平台账号" min-width="210">
        <template #default="{ row }">
          <div class="platform-account">
            <strong>{{ accountLabel(row) }}</strong>
            <small v-if="row.username">@{{ row.username }}</small>
            <small>账号 ID {{ row.id }}<span v-if="row.platform_account_id"> · 平台 ID {{ row.platform_account_id }}</span></small>
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
      <el-table-column label="账号健康" width="120" align="center">
        <template #default="{ row }">
          <div class="status-stack">
            <StatusBadge :value="row.platform_health_status" />
            <small v-if="row.manual_health_override">人工锁定</small>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="设备登录" width="155" align="center">
        <template #default="{ row }">
          <div class="status-stack">
            <StatusBadge :value="row.account_session_login_status || 'not_logged_in'" />
            <small v-if="row.account_session_observed_at">{{ formatDate(row.account_session_observed_at) }}</small>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="绑定设备" min-width="190">
        <template #default="{ row }">
          <div class="bound-device">
            <template v-if="row.account_session_id">
              <strong>{{ row.bound_slot_name || row.bound_slot_provider_id || `设备 #${row.account_session_slot_id}` }}</strong>
              <small v-if="row.bound_slot_provider_id">{{ row.bound_slot_provider_id }}</small>
              <small>绑定版本 {{ row.account_session_binding_version }}</small>
            </template>
            <span v-else class="identity-details__empty">未绑定设备</span>
            <small class="bound-device__group">设备分组：{{ row.bound_slot_group_name || '未分组' }}</small>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="养号状态" width="110" align="center">
        <template #default="{ row }"><StatusBadge :value="row.warmup_status" /></template>
      </el-table-column>
      <el-table-column label="内容监听" width="115" align="center">
        <template #default="{ row }">
          <span v-if="row.content_monitor_enabled === null || row.content_monitor_enabled === undefined" class="identity-details__empty">未配置</span>
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
              <el-tooltip content="修改该平台账号健康状态" placement="top">
                <el-button text type="primary" @click="openHealthDialog(row)">状态</el-button>
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
              <el-tooltip v-if="rows.length > 1" content="从当前登录身份拆分" placement="top">
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

    <el-dialog v-model="healthDialogVisible" title="修改平台账号状态" width="480px" append-to-body>
      <el-form label-position="top">
        <el-form-item label="目标账号">
          <div class="health-target">
            <el-tag effect="plain">{{ businessPlatformLabel(healthForm.businessPlatform) }}</el-tag>
            <strong>{{ healthForm.accountLabel }}</strong>
          </div>
        </el-form-item>
        <el-form-item label="账号健康状态" required>
          <el-select v-model="healthForm.platformHealthStatus" class="w-full">
            <el-option v-for="option in healthOptions" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="人工状态保护">
          <el-switch v-model="healthForm.manualHealthOverride" active-text="锁定人工状态" inactive-text="允许后续明确状态覆盖" />
        </el-form-item>
        <el-form-item label="修改原因">
          <el-input v-model="healthForm.reason" type="textarea" :rows="3" maxlength="500" show-word-limit placeholder="可选，记录本次人工判断依据" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="healthDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="actionLoading.startsWith('health:')" @click="updateHealth">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.identity-details { padding: 14px 18px 18px 48px; background: #f8fafc; }
.identity-details__header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.identity-details__header > div { display: flex; align-items: baseline; gap: 8px; }
.identity-details__header strong { color: #243b53; font-size: 13px; }
.identity-details__header span { color: #8293a5; font-size: 11px; }
.platform-account,
.bound-device,
.status-stack { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
.platform-account strong,
.bound-device strong { overflow: hidden; color: #334e68; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.platform-account small,
.bound-device small,
.status-stack small { overflow: hidden; color: #8494a5; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.status-stack { align-items: center; }
.account-attributes { display: flex; min-width: 0; flex-direction: column; align-items: center; gap: 5px; }
.account-attributes__country { display: inline-flex; max-width: 100%; align-items: center; gap: 3px; overflow: hidden; color: #657b8f; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.account-attributes__country svg { width: 12px; height: 12px; flex: 0 0 12px; }
.platform-tags { display: flex; min-width: 0; flex-wrap: wrap; gap: 4px; }
.bound-device__group { color: #526f86 !important; }
.backup-data { display: flex; align-items: center; justify-content: center; gap: 3px; }
.backup-data__actions { display: inline-flex; align-items: center; gap: 0; }
.backup-data__actions :deep(.el-button + .el-button) { margin-left: 0; }
.backup-data__actions :deep(.el-button) { width: 26px; height: 26px; }
.identity-details__actions { display: flex; align-items: center; justify-content: center; gap: 2px; }
.identity-details__actions :deep(.el-button + .el-button) { margin-left: 0; }
.identity-details__empty { color: #9aa9b8; font-size: 11px; }
.health-target { display: flex; align-items: center; gap: 8px; }
.health-target strong { color: #334e68; font-size: 13px; }
</style>
