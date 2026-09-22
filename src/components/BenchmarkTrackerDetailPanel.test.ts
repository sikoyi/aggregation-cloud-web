import { describe, expect, it } from 'vitest'

import source from './BenchmarkTrackerDetailPanel.vue?raw'

describe('对标账号详情资料同步失败处理', () => {
  it('展示失败阶段、原始错误和失败时间，并提供有权限的原地重试', () => {
    expect(source).toContain('账号资料同步失败')
    expect(source).toContain('profileSyncAction.error_message')
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
})
