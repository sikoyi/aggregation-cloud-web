import { describe, expect, it, vi } from 'vitest'
import ts from 'typescript'
import source from './ExternalMonitorBatchBar.vue?raw'

function setup() {
  const ast = ts.createSourceFile('batch.ts', source.split('<script setup lang="ts">')[1]!.split('</script>')[0]!, ts.ScriptTarget.Latest, true)
  const functions = ast.statements.filter(ts.isFunctionDeclaration).map(n => n.getText(ast)).join('\n')
  const state = {
    props: { selected: [{ id: 'one', version: 3 }], groups: [{ id: 'a', name: '韩国' }, { id: 'b', name: '生活' }] },
    disabled: { value: false }, busy: { value: false }, tags: { value: ['a','b'] }, interval: { value: 60 },
    country: { value: '日本' }, countryMode: { value: 'set' },
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

describe('外部账号批量国家', () => {
  it('确认数量和目标后提交国家及版本，不夹带标签和监听设置', async () => {
    const s = setup()
    s.dialog.value = 'country'
    await s.run('country')
    expect(s.ElMessageBox.confirm).toHaveBeenCalledWith(expect.stringContaining('1 个外部账号的国家统一修改为：日本'), '批量修改国家', expect.anything())
    expect(s.http.post).toHaveBeenCalledWith('/api/external-account-monitors/batch', { action: 'country', country: '日本', items: [{ id: 'one', expected_version: 3 }] })
    expect(s.emit).toHaveBeenCalledWith('completed')
    expect(s.dialog.value).toBeNull()
  })
  it('未选择国家不能提交，不会意外清空', async () => {
    const s = setup()
    s.country.value = ''
    await s.run('country')
    expect(s.http.post).not.toHaveBeenCalled()
    expect(s.ElMessageBox.confirm).not.toHaveBeenCalled()
  })
  it('明确清空并确认后才发送空字符串，取消不提交', async () => {
    const s = setup()
    s.countryMode.value = 'clear'
    s.ElMessageBox.confirm.mockRejectedValueOnce('cancel')
    await s.run('country')
    expect(s.ElMessageBox.confirm).toHaveBeenCalledWith(expect.stringContaining('清空为“未设置”'), '清空国家', expect.anything())
    expect(s.http.post).not.toHaveBeenCalled()
    expect(s.busy.value).toBe(false)
    await s.run('country')
    expect(s.http.post).toHaveBeenCalledWith('/api/external-account-monitors/batch', expect.objectContaining({ country: '' }))
  })
  it('提交中重复点击不产生第二个请求', async () => {
    const s = setup()
    let resolve!: (value: string) => void
    s.ElMessageBox.confirm.mockImplementationOnce(() => new Promise<string>(done => { resolve = done }))
    const first = s.run('country')
    await s.run('country')
    expect(s.ElMessageBox.confirm).toHaveBeenCalledTimes(1)
    resolve('confirm')
    await first
    expect(s.http.post).toHaveBeenCalledTimes(1)
  })
  it('网络错误保留国家，部分失败展示结果并通知父组件刷新筛选', async () => {
    const s = setup()
    s.dialog.value = 'country'
    s.http.post.mockRejectedValueOnce(new Error('network'))
    await s.run('country')
    expect(s.country.value).toBe('日本')
    expect(s.dialog.value).toBe('country')
    expect(s.emit).not.toHaveBeenCalledWith('completed')
    s.http.post.mockResolvedValueOnce({ succeeded: 0, skipped: 0, failed: 1, items: [] })
    await s.run('country')
    expect(s.resultVisible.value).toBe(true)
    expect(s.emit).toHaveBeenCalledWith('completed')
  })
  it('无选择或只读时不提交', async () => {
    const s = setup()
    s.disabled.value = true
    await s.run('country')
    expect(s.http.post).not.toHaveBeenCalled()
  })
})
