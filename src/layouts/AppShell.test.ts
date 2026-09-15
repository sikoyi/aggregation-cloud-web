import { describe, expect, it } from 'vitest'

import source from './AppShell.vue?raw'

describe('评论回复全局通知', () => {
  it('交由 TG 机器人通知且不再显示系统弹窗', () => {
    expect(source).toContain("if (payload?.topic === 'comment_reply') return")
    expect(source).not.toContain('评论回复处理异常')
    expect(source).not.toContain('有新的评论回复待审核')
  })
})
