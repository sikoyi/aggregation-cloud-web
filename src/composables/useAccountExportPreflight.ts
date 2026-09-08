import { computed, onScopeDispose, ref, watch } from 'vue'

import { ApiError } from '@/api/http'
import {
  downloadAccountExport, getAccountExportStatus, preflightAccountExport, submitAccountExport,
  type AccountExportPreflight, type AccountExportReceipt, type AccountExportRecordStatus,
} from '@/api/accountExport'
import { accountExportPlatformOptions, accountExportPreflightPayload, type AccountExportPayload, type AccountExportSource } from '@/config/accountExport'
import type { AnyRecord } from '@/types/api'
import { saveDownload } from '@/utils/download'

export function useAccountExportPreflight(
  selection: () => { source: AccountExportSource; records: AnyRecord[] },
  canExport: () => boolean,
  onCommitted: () => void = () => {},
) {
  const platforms = ref<string[]>([])
  const result = ref<AccountExportPreflight | null>(null)
  const receipt = ref<AccountExportReceipt | null>(null)
  const record = ref<AccountExportRecordStatus | null>(null)
  const error = ref('')
  const checking = ref(false)
  const submitting = ref(false)
  const statusLoading = ref(false)
  const downloading = ref(false)
  const downloaded = ref(false)
  const outcomeUnknown = ref(false)
  const acknowledgeLock = ref(false)
  const acknowledgeEmail = ref(false)
  const options = computed(() => accountExportPlatformOptions(selection().records, selection().source))
  let checkedPayload: AccountExportPayload | null = null
  let revision = 0
  let disposed = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const submitted = computed(() => !!receipt.value || downloaded.value || outcomeUnknown.value)
  const busy = computed(() => checking.value || submitting.value || downloading.value)
  const canSubmit = computed(() => canExport() && !busy.value && !submitted.value && result.value?.can_submit === true
    && acknowledgeLock.value && (result.value.email_check !== 'unverified' || acknowledgeEmail.value))

  function invalidate() {
    ++revision
    checking.value = false
    checkedPayload = null
    result.value = null
    acknowledgeLock.value = false
    acknowledgeEmail.value = false
  }
  watch(() => JSON.stringify([selection().source, selection().records.map(row => String(row.id))]), () => {
    invalidate()
    if (!submitting.value && !submitted.value) {
      platforms.value = options.value.length === 1 ? [String(options.value[0]!.value)] : []
    }
  }, { immediate: true, flush: 'sync' })
  watch(platforms, invalidate, { deep: true, flush: 'sync' })
  watch(canExport, allowed => {
    if (!allowed) { invalidate(); clearTimeout(timer) }
  }, { flush: 'sync' })

  async function check() {
    if (busy.value || submitted.value || !canExport()) return
    invalidate()
    error.value = ''
    const current = revision
    checking.value = true
    try {
      const selected = selection()
      const payload = accountExportPreflightPayload(selected.source, selected.records, platforms.value)
      const data = await preflightAccountExport(payload)
      if (disposed || current !== revision || !canExport()) return
      result.value = data
      checkedPayload = payload
    } catch (e) {
      if (!disposed && current === revision) error.value = e instanceof Error ? e.message : '导出预检失败'
    } finally {
      if (current === revision) checking.value = false
    }
  }

  async function refreshStatus() {
    clearTimeout(timer)
    if (disposed || !receipt.value || statusLoading.value || !canExport()) return
    statusLoading.value = true
    error.value = ''
    let poll = true
    try {
      const data = await getAccountExportStatus(receipt.value.export_record_id)
      if (disposed || !canExport()) return
      if (data.id !== receipt.value.export_record_id) throw new Error('导出记录不匹配，请从导出记录列表核对')
      record.value = data
      poll = data.state === 'confirming'
    } catch (e) {
      if (!disposed) error.value = e instanceof Error ? e.message : '确认状态查询失败'
      poll = !(e instanceof ApiError && [401, 403, 404, 410].includes(e.status))
    } finally {
      statusLoading.value = false
      if (poll && !disposed && canExport()) timer = setTimeout(() => void refreshStatus(), 5000)
    }
  }

  async function submit() {
    if (!canSubmit.value || !checkedPayload) return false
    const payload = checkedPayload
    submitting.value = true
    error.value = ''
    try {
      const outcome = await submitAccountExport(payload)
      if (disposed) return false
      if (outcome.receipt) {
        receipt.value = outcome.receipt
        onCommitted()
        void refreshStatus()
      } else {
        saveDownload(outcome.file.blob, outcome.file.filename)
        downloaded.value = true
        onCommitted()
      }
      return true
    } catch (e) {
      if (disposed) return false
      const definiteRejection = e instanceof ApiError && [401, 403, 404, 409, 422].includes(e.status)
      outcomeUnknown.value = !definiteRejection
      error.value = outcomeUnknown.value
        ? '导出响应未能确认，请先查看导出记录核对结果；不要重复提交导出。'
        : e instanceof Error ? e.message : '导出失败，请重新预检'
      invalidate()
      return false
    } finally {
      submitting.value = false
    }
  }

  async function download() {
    if (!receipt.value || !record.value?.download_available || downloading.value || !canExport()) return
    downloading.value = true
    error.value = ''
    try {
      const file = await downloadAccountExport(receipt.value.export_record_id)
      if (!disposed && canExport()) { saveDownload(file.blob, file.filename); downloaded.value = true }
    } catch (e) {
      if (!disposed) error.value = e instanceof Error ? e.message : '下载原文件失败'
    } finally {
      downloading.value = false
    }
  }

  onScopeDispose(() => { disposed = true; ++revision; clearTimeout(timer) })
  return { platforms, options, result, receipt, record, error, checking, submitting, statusLoading, downloading,
    downloaded, outcomeUnknown, acknowledgeLock, acknowledgeEmail, submitted, busy, canSubmit,
    check, submit, refreshStatus, download }
}
