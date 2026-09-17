import { describe, expect, it } from 'vitest'

import source from './ApifyMonitorConfigPanel.vue?raw'

describe('账号内容采集配置', () => {
  it('不再承载评论禁回时段入口', () => {
    expect(source).not.toContain('评论禁回时段')
    expect(source).not.toContain('replyQuietForm')
    expect(source).not.toContain('saveReplyQuietPolicy')
  })
})
