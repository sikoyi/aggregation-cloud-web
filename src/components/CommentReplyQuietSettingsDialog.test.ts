import { describe, expect, it, vi } from 'vitest'
import ts from 'typescript'

import source from './CommentReplyQuietSettingsDialog.vue?raw'

function scheduleSave() {
  const script = source.split('<script setup lang="ts">')[1]!.split('</script>')[0]!
  const ast = ts.createSourceFile('Settings.ts', script, ts.ScriptTarget.Latest, true)
  const handler = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'savePolicy')!.getText(ast)
  const state = {
    props: { editable: true }, loading: { value: false }, saving: { value: false }, loaded: { value: true },
    activeTab: { value: 'schedule' }, activePlatform: { value: 'x' }, activePlatformLabel: { value: 'X' },
    times: { value: ['09:00', '18:00'] }, scheduleEndpoint: '/api/interaction-center/comment-reply-schedules',
    http: { put: vi.fn().mockResolvedValue({}) }, ElNotification: { success: vi.fn() }, notifyError: vi.fn(),
  }
  const compiled = ts.transpileModule(handler, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  return { ...state, save: new Function(...Object.keys(state), `${compiled}; return savePolicy;`)(...Object.values(state)) }
}

describe('账号数据忽略时间段', () => {
  it('回复时间只更新平台默认配置，不覆盖账号配置', async () => {
    const s = scheduleSave()
    await s.save()
    expect(s.http.put).toHaveBeenCalledWith(s.scheduleEndpoint, {
      business_platform: 'x', account_ids: [], inherit: false, times: ['09:00', '18:00'],
    })
    expect(s.saving.value).toBe(false)
  })

  it('只读、未加载或重复保存均不发送写请求', async () => {
    const s = scheduleSave()
    s.props.editable = false
    await s.save()
    s.props.editable = true
    s.loaded.value = false
    await s.save()
    s.loaded.value = true
    s.saving.value = true
    await s.save()
    expect(s.http.put).not.toHaveBeenCalled()
  })

  it('保存失败保留时间供重试', async () => {
    const s = scheduleSave()
    s.http.put.mockRejectedValueOnce(new Error('offline'))
    await s.save()
    expect(s.times.value).toEqual(['09:00', '18:00'])
    expect(s.saving.value).toBe(false)
    expect(s.notifyError).toHaveBeenCalledOnce()
    await s.save()
    expect(s.http.put).toHaveBeenCalledTimes(2)
  })

  it('在一个弹窗内按支持的平台配置单个北京时间时段', () => {
    for (const platform of ['threads', 'x', 'facebook']) {
      expect(source).toContain(`value: '${platform}'`)
    }
    expect(source).toContain('忽略时间段')
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
    expect(source).toContain('当前角色仅可查看忽略时间段')
    expect(source).toContain('<el-button v-if="editable"')
  })

  it('开关保持标准紧凑宽度，不继承标题文字的伸展样式', () => {
    expect(source).toContain('class="reply-quiet-dialog__switch"')
    expect(source).toContain('.reply-quiet-dialog__switch { width: auto; flex: 0 0 auto; }')
    expect(source).not.toContain('.reply-quiet-dialog__heading > div')
  })
})
