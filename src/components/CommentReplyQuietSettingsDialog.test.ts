import { describe, expect, it } from 'vitest'

import source from './CommentReplyQuietSettingsDialog.vue?raw'

describe('账号数据评论禁回时段', () => {
  it('在一个弹窗内按支持的平台配置单个北京时间时段', () => {
    for (const platform of ['threads', 'x', 'facebook']) {
      expect(source).toContain(`value: '${platform}'`)
    }
    expect(source).toContain('评论禁回时段')
    expect(source).toContain('北京时间（Asia/Shanghai）')
    expect(source).toContain('v-model="form.enabled"')
    expect(source).toContain('v-model="form.start"')
    expect(source).toContain('v-model="form.end"')
    expect(source).toContain('value-format="HH:mm:ss"')
  })

  it('切换平台时重新加载并只保存禁回规则字段', () => {
    expect(source).toContain('/api/interaction-center/content-monitor/provider-config/${activePlatform.value}')
    expect(source).toContain('@change="loadPolicy"')
    expect(source).toContain('comment_reply_quiet_enabled: form.enabled')
    expect(source).toContain('comment_reply_quiet_start: form.enabled ? form.start : null')
    expect(source).toContain('comment_reply_quiet_end: form.enabled ? form.end : null')
    expect(source).toContain('form.start === form.end')
  })

  it('保留只读角色查看能力且仅向编辑角色展示保存按钮', () => {
    expect(source).toContain('editable?: boolean')
    expect(source).toContain('v-if="!editable"')
    expect(source).toContain('当前角色仅可查看评论禁回时段')
    expect(source).toContain('<el-button v-if="editable"')
  })

  it('开关保持标准紧凑宽度，不继承标题文字的伸展样式', () => {
    expect(source).toContain('class="reply-quiet-dialog__switch"')
    expect(source).toContain('.reply-quiet-dialog__switch { width: auto; flex: 0 0 auto; }')
    expect(source).not.toContain('.reply-quiet-dialog__heading > div')
  })
})
