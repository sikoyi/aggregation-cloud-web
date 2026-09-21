<script setup lang="ts">
import { computed, ref } from 'vue'
import { ClipboardCheck, Download, RefreshCw } from 'lucide-vue-next'

import { accountExportStateLabel } from '@/api/accountExport'
import { useAccountExportPreflight } from '@/composables/useAccountExportPreflight'
import { ACCOUNT_EXPORT_PERMISSION, type AccountExportSource } from '@/config/accountExport'
import { businessPlatformLabel } from '@/config/options'
import { useAuthStore } from '@/stores/auth'
import type { AnyRecord } from '@/types/api'

const props = defineProps<{ source: AccountExportSource; records: AnyRecord[] }>()
const emit = defineEmits<{ close: []; changed: []; records: [recordId?: string] }>()
const auth = useAuthStore()
const allowed = computed(() => auth.can(ACCOUNT_EXPORT_PERMISSION))
const {
  platforms, options, result, receipt, record, error, checking, submitting, statusLoading, downloading,
  downloaded, outcomeUnknown, acknowledgeLock, acknowledgeEmail, submitted, busy, canSubmit,
  check, submit, refreshStatus, download,
} = useAccountExportPreflight(() => props, () => allowed.value, () => emit('changed'))
const detailPage = ref(1)
const pageItems = computed(() => result.value?.items.slice((detailPage.value - 1) * 20, detailPage.value * 20) || [])
const platformNames = (values: string[]) => values.map(businessPlatformLabel).join('、') || '无'
function close() { if (!submitting.value && !downloading.value) emit('close') }
async function preflight() { detailPage.value = 1; await check() }
</script>

<template>
  <el-dialog :model-value="true" title="账号导出预检" width="min(960px, 94vw)" top="5vh" append-to-body destroy-on-close
    :close-on-click-modal="false" :close-on-press-escape="!submitting && !downloading"
    :show-close="!submitting && !downloading" @close="close">
    <div class="export-preflight">
      <el-alert v-if="!allowed" title="当前账号没有导出权限" type="error" :closable="false" />
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <template v-if="receipt">
        <dl class="export-preflight__record">
          <dt>导出记录 ID</dt><dd data-testid="export-record-id">{{ receipt.export_record_id }}</dd>
          <dt>当前状态</dt><dd>{{ accountExportStateLabel(record || receipt) }}</dd>
        </dl>
        <el-alert v-if="!record || record.pending" title="导出记录已保存，邮箱正在后台确认，账号导出锁保留。请勿重复导出。" type="warning" :closable="false" />
        <el-alert v-if="record?.recovery_overdue" title="邮箱确认已超过 10 分钟，请联系管理员核对原批次；不要重新导出或解除导出锁。" type="warning" :closable="false" />
        <el-alert v-if="record?.expired" title="原文件已过 30 天保留期，无法继续下载。" type="info" :closable="false" />
      </template>
      <el-alert v-else-if="downloaded" title="导出文件已下载；30 天内可从导出记录再次下载原文件。" type="success" :closable="false" />
      <template v-else-if="!outcomeUnknown">
        <el-form label-position="top" @submit.prevent="preflight">
          <el-form-item label="所选账号的平台">
            <el-select v-model="platforms" multiple aria-label="所选账号的平台" :disabled="busy || !allowed" placeholder="请选择业务平台">
              <el-option v-for="option in options" :key="String(option.value)" :label="option.label" :value="String(option.value)" />
            </el-select>
          </el-form-item>
        </el-form>
        <template v-if="result">
          <p class="export-preflight__summary" role="status">
            选中 {{ result.selected_count }} 项 · 本地条件满足 {{ result.local_eligible_count }} 项 ·
            阻断 {{ result.blocked_count }} 项 · 邮箱未验证 {{ result.unverified_count }} 项 ·
            {{ result.file_format.toUpperCase() }} {{ result.file_row_count }} 行
          </p>
          <el-alert v-for="limitation in result.limitations" :key="limitation" :title="limitation" type="warning" :closable="false" />
          <el-table :data="pageItems" border max-height="360" table-layout="fixed" row-key="selected_id" class="export-preflight__table">
            <el-table-column label="所选记录 / 身份" width="145">
              <template #default="{ row }">{{ row.selected_id }}<span v-if="row.identity_id && row.identity_id !== row.selected_id"> / {{ row.identity_id }}</span></template>
            </el-table-column>
            <el-table-column label="文件平台 / 锁定范围" min-width="210">
              <template #default="{ row }">
                <div>文件：{{ platformNames(row.export_platforms) }}</div>
                <div>身份锁：{{ platformNames(row.lock_platforms) }}</div>
                <div v-if="row.hidden_locked_account_count">另有 {{ row.hidden_locked_account_count }} 个不可见关联账号参与锁定</div>
              </template>
            </el-table-column>
            <el-table-column label="预检结果" min-width="320">
              <template #default="{ row }">
                <div v-for="(issue, index) in row.blocking_reasons" :key="`block-${index}`" class="export-preflight__blocking">{{ issue.business_platform ? `${businessPlatformLabel(issue.business_platform)}：` : '' }}{{ issue.message }}</div>
                <div v-for="(issue, index) in row.warnings" :key="`warn-${index}`" class="export-preflight__warning">{{ issue.business_platform ? `${businessPlatformLabel(issue.business_platform)}：` : '' }}{{ issue.message }}</div>
                <div v-if="row.email_check === 'unverified'" class="export-preflight__warning">邮箱资源、验证码记录和凭据未验证</div>
                <span v-if="row.local_eligible">{{ row.email_check === 'unverified' ? '本地条件满足，邮箱待验证' : '本地条件满足' }}</span>
              </template>
            </el-table-column>
          </el-table>
          <div class="export-preflight__mobile-items">
            <section v-for="item in pageItems" :key="item.selected_id" class="export-preflight__mobile-item">
              <h4>记录 {{ item.selected_id }}<span v-if="item.identity_id && item.identity_id !== item.selected_id"> / 身份 {{ item.identity_id }}</span></h4>
              <p>文件：{{ platformNames(item.export_platforms) }}<br>身份锁：{{ platformNames(item.lock_platforms) }}</p>
              <p v-if="item.hidden_locked_account_count">另有 {{ item.hidden_locked_account_count }} 个不可见关联账号参与锁定</p>
              <div v-for="(issue, index) in item.blocking_reasons" :key="`block-${index}`" class="export-preflight__blocking">{{ issue.business_platform ? `${businessPlatformLabel(issue.business_platform)}：` : '' }}{{ issue.message }}</div>
              <div v-for="(issue, index) in item.warnings" :key="`warn-${index}`" class="export-preflight__warning">{{ issue.business_platform ? `${businessPlatformLabel(issue.business_platform)}：` : '' }}{{ issue.message }}</div>
              <div v-if="item.email_check === 'unverified'" class="export-preflight__warning">邮箱资源、验证码记录和凭据未验证</div>
              <span v-if="item.local_eligible">{{ item.email_check === 'unverified' ? '本地条件满足，邮箱待验证' : '本地条件满足' }}</span>
            </section>
          </div>
          <el-pagination v-if="result.selected_count > 20" v-model:current-page="detailPage" :page-size="20" :total="result.selected_count" layout="total, prev, pager, next" />
          <div class="export-preflight__confirm">
            <el-checkbox v-model="acknowledgeLock" :disabled="busy || !allowed || !result.can_submit">确认 Instagram / Threads 按完整登录身份导出，包含全部关联平台；导出将锁定整个身份，不能重复导出或再次上号。</el-checkbox>
            <el-checkbox v-if="result.email_check === 'unverified'" v-model="acknowledgeEmail" :disabled="busy || !allowed || !result.can_submit">已知邮箱尚未验证，正式提交仍可能因邮箱资料或验证记录缺失而失败。</el-checkbox>
          </div>
        </template>
      </template>
    </div>
    <template #footer>
      <div class="export-preflight__footer">
        <el-button v-if="receipt || outcomeUnknown || downloaded" @click="emit('records', receipt?.export_record_id)">查看导出记录</el-button>
        <el-button v-if="receipt" :icon="RefreshCw" :loading="statusLoading" :disabled="!allowed" @click="refreshStatus">刷新状态</el-button>
        <el-button :disabled="submitting || downloading" @click="close">关闭</el-button>
        <el-button v-if="!submitted" :icon="ClipboardCheck" :loading="checking" :disabled="busy || !allowed || !platforms.length" @click="preflight">{{ result ? '重新预检' : '只读预检' }}</el-button>
        <el-button v-if="!submitted" type="primary" :icon="Download" :loading="submitting" :disabled="!canSubmit" @click="submit">确认导出</el-button>
        <el-button v-if="receipt" type="primary" :icon="Download" :loading="downloading" :disabled="!allowed || !record?.download_available" @click="download">下载原文件</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.export-preflight { min-width: 0; max-height: calc(86dvh - 160px); overflow-y: auto; }
.export-preflight .el-alert { margin-bottom: 12px; }
.export-preflight .el-select { width: 100%; }
.export-preflight__summary { margin: 0 0 12px; line-height: 1.7; }
.export-preflight__record { display: grid; grid-template-columns: 110px minmax(0, 1fr); gap: 8px; }
.export-preflight__record dd { margin: 0; overflow-wrap: anywhere; }
.export-preflight__blocking { color: var(--el-color-danger-dark-2); }
.export-preflight__warning { color: var(--el-color-warning-dark-2); }
.export-preflight__confirm { display: grid; gap: 8px; margin-top: 16px; }
.export-preflight__confirm .el-checkbox { height: auto; align-items: flex-start; margin-right: 0; }
.export-preflight__confirm :deep(.el-checkbox__input) { margin-top: 4px; }
.export-preflight__confirm :deep(.el-checkbox__label) { white-space: normal; line-height: 1.6; }
.export-preflight__footer { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.export-preflight__footer :deep(.el-button + .el-button) { margin-left: 0; }
.export-preflight .el-pagination { justify-content: flex-end; margin-top: 12px; }
.export-preflight__mobile-items { display: none; }
@media (max-width: 600px) {
  .export-preflight__record { grid-template-columns: minmax(0, 1fr); }
  .export-preflight__table { display: none; }
  .export-preflight__mobile-items { display: block; }
  .export-preflight__mobile-item { border-bottom: 1px solid var(--el-border-color); padding: 12px 0; line-height: 1.7; overflow-wrap: anywhere; }
  .export-preflight__mobile-item h4 { font-size: 14px; margin: 0 0 4px; }
  .export-preflight__mobile-item p { margin: 0 0 8px; }
}
</style>
