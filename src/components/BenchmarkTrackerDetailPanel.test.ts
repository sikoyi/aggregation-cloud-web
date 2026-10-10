import { describe, expect, it } from 'vitest'

import source from './BenchmarkTrackerDetailPanel.vue?raw'

describe('对标账号详情资料同步失败处理', () => {
  it('区分翻译等待重试、已取消和耗尽状态', () => {
    expect(source).toContain("translation_retry: { label: '翻译重试中'")
    expect(source).toContain("translation_canceled: { label: '翻译重试已取消'")
    expect(source).toContain("translation_exhausted: { label: '翻译重试已结束'")
  })

  it('展示失败阶段、原始错误和失败时间，并提供有权限的原地重试', () => {
    expect(source).toContain('账号资料同步失败')
    expect(source).toContain('profileSyncAction.value.error_message')
    expect(source).toContain('formatDate(profileSyncAction.finished_at)')
    expect(source).toContain("auth.can('operations.retry')")
    expect(source).toContain('retryProfileSync')
    expect(source).toContain('/profile-sync/retry')
  })

  it('重试期间禁止重复提交并刷新最新状态', () => {
    expect(source).toContain(':loading="profileSyncRetrying"')
    expect(source).toContain(':disabled="profileSyncRetrying"')
    expect(source).toContain('await loadTracker()')
  })

  it('兼容仅保留历史错误的资料同步失败记录', () => {
    expect(source).toContain('legacyProfileSyncFailed')
    expect(source).toContain('tracker.value?.last_error_message')
    expect(source).toContain('profileSyncErrorMessage')
  })
})
