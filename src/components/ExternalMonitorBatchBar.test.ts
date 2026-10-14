import { describe, expect, it, vi } from 'vitest'
import ts from 'typescript'
import source from './ExternalMonitorBatchBar.vue?raw'

function setup() {
  const ast = ts.createSourceFile('batch.ts', source.split('<script setup lang="ts">')[1]!.split('</script>')[0]!, ts.ScriptTarget.Latest, true)
  const functions = ast.statements.filter(ts.isFunctionDeclaration).map(n => n.getText(ast)).join('\n')
  const state = {
    props: { selected: [{ id: 'one', version: 3 }], groups: [{ id: 'a', name: '韩国' }, { id: 'b', name: '生活' }] },
    disabled: { value: false }, busy: { value: false }, tags: { value: ['a','b'] }, interval: { value: 60 },
    dialog: { value: 'tags' }, result: { value: null }, resultVisible: { value: false }, emit: vi.fn(),
    http: { post: vi.fn().mockResolvedValue({ succeeded: 1, skipped: 0, failed: 0, items: [] }) },
    ElMessageBox: { confirm: vi.fn().mockResolvedValue('confirm') },
    ElNotification: Object.assign(vi.fn(), { error: vi.fn() }),
  }
  const compiled = ts.transpileModule(functions, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const run = new Function(...Object.keys(state), `${compiled}; return run;`)(...Object.values(state)) as (action: string) => Promise<void>
  return { ...state, run }
}

describe('外部账号批量标签', () => {
  it('确认覆盖后提交全部标签和当前版本', async () => {
    const s = setup()
    await s.run('tags')
    expect(s.ElMessageBox.confirm).toHaveBeenCalledWith(expect.stringContaining('替换为'), '替换账号标签', expect.anything())
    expect(s.http.post).toHaveBeenCalledWith('/api/external-account-monitors/batch', { action: 'tags', items: [{ id: 'one', expected_version: 3 }], tag_ids: ['a','b'] })
    expect(s.emit).toHaveBeenCalledWith('completed')
    expect(s.busy.value).toBe(false)
  })
  it('清空标签有明确确认，取消不提交', async () => {
    const s = setup()
    s.tags.value = []
    s.ElMessageBox.confirm.mockRejectedValueOnce('cancel')
    await s.run('tags')
    expect(s.ElMessageBox.confirm).toHaveBeenCalledWith(expect.stringContaining('清空'), '清空账号标签', expect.anything())
    expect(s.http.post).not.toHaveBeenCalled()
    expect(s.busy.value).toBe(false)
    await s.run('tags')
    expect(s.http.post).toHaveBeenCalledWith('/api/external-account-monitors/batch', expect.objectContaining({ tag_ids: [] }))
  })
  it('失败保留选择以便重试，只读或空选择禁用时不提交', async () => {
    const s = setup()
    s.http.post.mockRejectedValueOnce(new Error('network'))
    await s.run('tags')
    expect(s.tags.value).toEqual(['a','b'])
    expect(s.dialog.value).toBe('tags')
    expect(s.ElNotification.error).toHaveBeenCalled()
    s.http.post.mockClear()
    s.disabled.value = true
    await s.run('tags')
    expect(s.http.post).not.toHaveBeenCalled()
  })
})
