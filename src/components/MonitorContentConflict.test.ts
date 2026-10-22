import { describe, expect, it, vi } from 'vitest'
import ts from 'typescript'
import source from './MonitorContentConflict.vue?raw'
import tags from './ExternalAccountTagSelect.vue?raw'
import external from './ExternalAccountMonitors.vue?raw'
import internal from '../views/AccountDataView.vue?raw'

function setup() {
  const ast = ts.createSourceFile('component.ts', source.split('<script setup lang="ts">')[1]!.split('</script>')[0]!, ts.ScriptTarget.Latest, true)
  const code = ast.statements.filter(n => !ts.isImportDeclaration(n)).map(n => n.getText(ast)).join('\n')
  const props = { accountId: 'one', errorMessage: '采集帖子已关联其他系统账号' }
  const http = { get: vi.fn() }
  let callback: (a: unknown, b: unknown, cleanup: (fn: () => void) => void) => Promise<void>
  const compiled = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const state = new Function('defineProps', 'ref', 'computed', 'watch', 'http', `${compiled}; return { result, loading, failed, profileUrl, accountUrl }`)(
    () => props, (value: unknown) => ({ value }), (get: () => unknown) => ({ get value() { return get() } }),
    (_: unknown, fn: typeof callback) => { callback = fn }, http)
  return { props, http, state, run: (cleanup: (fn: () => void) => void = () => {}) => callback!(null, null, cleanup) }
}

describe('监听关联账号提示', () => {
  it('仅给可见关联账号生成精确系统入口并编码 ID', async () => {
    const s = setup()
    s.http.get.mockResolvedValue({ status: 'available', account: { id: '946&other=1' } })
    await s.run()
    expect(s.state.accountUrl.value).toBe('/account-data/social?account_id=946%26other%3D1')
    s.http.get.mockResolvedValue({ status: 'unavailable' })
    await s.run()
    expect(s.state.accountUrl.value).toBe('')
    expect(source).toContain('打开系统账号')
  })
  it('加载时清理旧账号，忽略过期请求', async () => {
    const s = setup()
    let resolve!: (value: unknown) => void
    let cleanup!: () => void
    s.http.get.mockReturnValueOnce(new Promise(r => { resolve = r }))
    const first = s.run(fn => { cleanup = fn })
    cleanup()
    s.props.accountId = 'two'
    s.http.get.mockResolvedValueOnce({ status: 'unavailable', message: '无权查看' })
    await s.run()
    resolve({ status: 'available', account: { id: 'old' } })
    await first
    expect(s.state.result.value.status).toBe('unavailable')
    expect(s.state.loading.value).toBe(false)
  })
  it('失败后支持重新加载，拒绝非 HTTP 主页链接', async () => {
    const s = setup()
    s.http.get.mockRejectedValueOnce(new Error('network'))
    await s.run()
    expect(s.state.failed.value).toBe(true)
    s.http.get.mockResolvedValueOnce({ status: 'available', account: { profile_url: 'javascript:alert(1)' } })
    await s.run()
    expect(s.state.failed.value).toBe(false)
    expect(s.state.profileUrl.value).toBe('')
  })
  it('非归属冲突不发请求', async () => {
    const s = setup()
    s.props.errorMessage = ''
    await s.run()
    expect(s.http.get).not.toHaveBeenCalled()
  })
  it('仅外部标签使用展开多选，内部设备分组保留下拉', () => {
    expect(tags).toContain('<el-checkbox-group')
    expect(tags).toContain(':disabled="disabled"')
    expect(tags).toContain('overflow-wrap: anywhere')
    expect(external).toContain('v-model="filters.tag_ids" label="外部账号标签筛选"')
    expect(external).toContain('<el-form-item label="账号标签"><ExternalAccountTagEditor v-model="form.tag_ids"')
    expect(internal).toContain('<el-select v-model="filters.slot_group_id"')
  })
})
