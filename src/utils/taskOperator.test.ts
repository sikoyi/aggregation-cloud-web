import { describe, expect, it } from 'vitest'
import { taskOperator } from './taskOperator'

describe('taskOperator', () => {
  const owner = { created_by: 'owner', creator_display_name: '监听创建人', creator_username: 'owner' }
  it('does not attribute automatic dispatch to the monitoring owner', () => {
    expect(taskOperator({ ...owner, dispatch_source: 'system' })).toEqual({ name: '系统自动下发', secondary: '' })
  })
  it('shows the actual reviewer', () => {
    expect(taskOperator({ ...owner, dispatch_source: 'review', dispatched_by: 'reviewer', dispatcher_display_name: '审核员', dispatcher_username: 'reviewer' }))
      .toEqual({ name: '审核员', secondary: '@reviewer' })
  })
  it('does not fall back to owner when the dispatcher is deleted', () => {
    expect(taskOperator({ ...owner, dispatch_source: 'review', dispatched_by: 'reviewer' }).name).toBe('ID reviewer')
  })
  it.each(['benchmark_content_publish', 'benchmark_content_delete', 'account_profile_sync'])('does not guess historical attribution for %s', (task_type) => {
    expect(taskOperator({ ...owner, task_type }).name).toBe('下发来源未记录')
  })
  it('preserves ordinary task attribution', () => {
    expect(taskOperator({ ...owner, task_type: 'manual' })).toEqual({ name: '监听创建人', secondary: '@owner' })
  })
})
