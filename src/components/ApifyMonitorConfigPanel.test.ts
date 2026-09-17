import { describe, expect, it } from 'vitest'

import source from './ApifyMonitorConfigPanel.vue?raw'

describe('平台评论禁回时段', () => {
  it('仅为已实现账号评论回复的平台展示一段北京时间配置', () => {
    expect(source).toContain("['threads', 'x', 'facebook'].includes(businessPlatform.value)")
    expect(source).toContain('评论禁回时段')
    expect(source).toContain('北京时间（Asia/Shanghai）')
    expect(source).toContain('v-model="replyQuietForm.enabled"')
    expect(source).toContain('v-model="replyQuietForm.start"')
    expect(source).toContain('v-model="replyQuietForm.end"')
    expect(source).toContain('value-format="HH:mm:ss"')
  })

  it('加载和保存时携带平台级禁回配置', () => {
    expect(source).toContain('comment_reply_quiet_enabled: replyQuietForm.enabled')
    expect(source).toContain('comment_reply_quiet_start: replyQuietForm.enabled ? replyQuietForm.start : null')
    expect(source).toContain('comment_reply_quiet_end: replyQuietForm.enabled ? replyQuietForm.end : null')
    expect(source).toContain('async function saveReplyQuietPolicy()')
    expect(source).toContain('replyQuietForm.start === replyQuietForm.end')
  })
})
