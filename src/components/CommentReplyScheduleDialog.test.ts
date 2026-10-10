import { describe, expect, it, vi } from 'vitest'
import ts from 'typescript'
import source from './CommentReplyScheduleDialog.vue?raw'

function batchSave() {
  const script = source.split('<script setup lang="ts">')[1]!.split('</script>')[0]!
  const ast = ts.createSourceFile('Schedule.ts', script, ts.ScriptTarget.Latest, true)
  const handler = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'save')!.getText(ast)
  const state = {
    props: { replyMode: 'automatic' }, busy: { value: false }, batchReady: { value: true },
    mixed: { value: true }, loaded: { value: false }, accountIds: { value: ['a', 'b'] },
    batchMode: { value: 'automatic' }, batchSchedule: { value: { inherit: true, times: [] as string[] } },
    visible: { value: true }, http: { put: vi.fn().mockResolvedValue({ updated_count: 2, skipped_count: 0 }) },
    ElNotification: { success: vi.fn() }, emit: vi.fn(), notifyError: vi.fn(), endpoint: '',
  }
  const compiled = ts.transpileModule(handler, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const save = new Function(...Object.keys(state), `${compiled}; return save;`)(...Object.values(state))
  return { ...state, save }
}

describe('集中回复时间设置', () => {
  it('批量开启将回复方式与时间合并为一次请求，允许混合 App', async () => {
    const s = batchSave()
    await s.save()
    expect(s.http.put).toHaveBeenCalledOnce()
    expect(s.http.put).toHaveBeenCalledWith('/api/accounts/data-overview/comment-reply-mode/batch', {
      account_ids: ['a', 'b'], comment_reply_mode: 'automatic', comment_reply_schedule: { inherit: true, times: [] },
    })
    expect(s.visible.value).toBe(false)
    expect(s.emit).toHaveBeenCalledWith('saved')
  })

  it('回复时间未就绪时不提交批量开启', async () => {
    const s = batchSave()
    s.batchReady.value = false
    await s.save()
    expect(s.http.put).not.toHaveBeenCalled()
    expect(s.visible.value).toBe(true)
  })

  it('保存失败保留窗口与自定义时间，允许重新提交', async () => {
    const s = batchSave()
    s.batchSchedule.value = { inherit: false, times: ['18:30'] }
    s.http.put.mockRejectedValueOnce(new Error('保存失败'))
    await s.save()
    expect(s.visible.value).toBe(true)
    expect(s.busy.value).toBe(false)
    expect(s.batchSchedule.value.times).toEqual(['18:30'])
    await s.save()
    expect(s.http.put).toHaveBeenCalledTimes(2)
    expect(s.visible.value).toBe(false)
  })
  it('提供多时间点、账号继承以及批量目标', () => {
    expect(source).toContain('account_ids: accountIds.value')
    expect(source).toContain('继承 App 默认时间')
    expect(source).toContain('每日评论回复范围（北京时间）')
    expect(source).toContain('<CommentReplyWindowEditor v-model="windows"')
    expect(source).toContain('validReplyWindows(windows)')
    expect(source).toContain('请选择同一 App 下的账号')
  })
  it('使用现有 HTTP 客户端查询参数约定', () => {
    expect(source).not.toContain('{ params: {')
    expect(source).toContain('account_id: accountIds.value.length === 1')
    expect(source).toContain('if (current !== revision) return')
  })
})
