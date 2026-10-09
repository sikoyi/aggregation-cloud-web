import { describe, expect, it } from 'vitest'
import { commentReplyStatusOptions, operatorReplyStatus, operatorReplyStatusMeta, processingReplyStatuses } from './commentReplyStatus'

describe('评论审核运营状态', () => {
  it.each(processingReplyStatuses)('将 %s 归入处理中并迁移旧筛选', status => {
    expect(operatorReplyStatus(status)).toBe('operator_processing')
    expect(operatorReplyStatusMeta(status).label).toBe('处理中')
  })
  it('合并失败和阻塞，不混淆取消与忽略', () => {
    expect(operatorReplyStatusMeta('blocked').label).toBe('失败')
    expect(operatorReplyStatusMeta('failed').label).toBe('失败')
    expect(operatorReplyStatusMeta('canceled').label).toBe('已取消')
    expect(operatorReplyStatusMeta('ignored').label).toBe('已忽略')
    expect(operatorReplyStatus('')).toBe('')
    expect(operatorReplyStatusMeta('future_status').label).toBe('future_status')
  })
  it('筛选不暴露设备和调度状态', () => {
    expect(commentReplyStatusOptions.some(option => processingReplyStatuses.includes(option.value))).toBe(false)
  })
})
