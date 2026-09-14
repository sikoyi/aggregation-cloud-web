import { describe, expect, it } from 'vitest'
import { taskResultCounts } from './taskResultCounts'

describe('任务执行结果数量', () => {
  it.each(['failed', 'expired', 'lost'])('107381 类单任务 %s 计一次失败', status => {
    expect(taskResultCounts({ task_type: 'comment_reply_task', status, child_total: 0, child_failed: 0 })).toEqual({ succeeded: 0, failed: 1, canceled: 0 })
  })
  it.each(['queued', 'waiting_runtime', 'dispatching', 'running', 'retry_wait'])('未结束 %s 不提前计数', status => {
    expect(taskResultCounts({ status })).toEqual({ succeeded: 0, failed: 0, canceled: 0 })
  })
  it('成功和取消的单任务各计一次，子任务也按自身结果显示', () => {
    expect(taskResultCounts({ status: 'succeeded', parent_task_run_id: 'parent' })).toEqual({ succeeded: 1, failed: 0, canceled: 0 })
    expect(taskResultCounts({ status: 'canceled' })).toEqual({ succeeded: 0, failed: 0, canceled: 1 })
  })
  it.each(['template_batch', 'interaction_session', 'publish_content_batch', 'account_registration_batch', 'account_warmup_batch'])('父任务 %s 保留汇总，不重复计算父任务失败', task_type => {
    expect(taskResultCounts({ task_type, status: 'failed', child_total: 4, child_succeeded: 2, child_failed: 1, child_canceled: 1 })).toEqual({ succeeded: 2, failed: 1, canceled: 1 })
    expect(taskResultCounts({ task_type, status: 'failed', child_total: 0 })).toEqual({ succeeded: 0, failed: 0, canceled: 0 })
  })
  it('扩展类型已有子任务时沿用汇总', () => {
    expect(taskResultCounts({ task_type: 'future_batch', status: 'failed', child_total: 2, child_failed: 2 })).toEqual({ succeeded: 0, failed: 2, canceled: 0 })
  })
})
