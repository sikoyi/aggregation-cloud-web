import { describe, expect, it } from 'vitest'

import {
  businessEventTrendMaximum,
  flattenBusinessEventStatistics,
} from '@/utils/businessEvents'

describe('业务事件统计展示', () => {
  it('把项目和事件类型展开成稳定的表格行', () => {
    const rows = flattenBusinessEventStatistics([
      {
        project_internal_id: 'project-1',
        project_id: 'threads_registration',
        project_name: 'Threads 注册',
        event_count: 5,
        affected_task_count: 4,
        event_types: [
          {
            event_type_internal_id: 'type-1',
            event_id: 'sms_code_timeout',
            event_name: '验证码超时',
            event_count: 5,
            affected_task_count: 4,
          },
        ],
      },
    ])

    expect(rows).toEqual([
      {
        key: 'project-1:type-1',
        projectId: 'threads_registration',
        projectName: 'Threads 注册',
        eventId: 'sms_code_timeout',
        eventName: '验证码超时',
        eventCount: 5,
        affectedTaskCount: 4,
      },
    ])
  })

  it('空趋势也保留可计算的基准高度', () => {
    expect(businessEventTrendMaximum(null)).toBe(1)
  })
})
