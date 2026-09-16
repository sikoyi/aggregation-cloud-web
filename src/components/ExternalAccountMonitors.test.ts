import { describe, expect, it, vi } from 'vitest'
import ts from 'typescript'
import source from './ExternalAccountMonitors.vue?raw'
import routes from '../router/accountDataRoutes.ts?raw'

const ast = ts.createSourceFile('ExternalMonitor.ts', source.split('<script setup lang="ts">')[1]!.split('</script>')[0]!, ts.ScriptTarget.Latest, true)
const functions = ast.statements.filter(ts.isFunctionDeclaration).map(node => node.getText(ast)).join('\n')
function setup() {
  const state = {
    canEdit: { value: true }, saving: { value: false }, editing: { value: null as Record<string, unknown> | null },
    form: { business_platform: 'x', profile_url: 'https://x.com/source', remark: 'note', interval_minutes: 60, enabled: true },
    formVisible: { value: true }, rows: { value: [] }, total: { value: 0 }, page: { value: 1 }, pageSize: { value: 20 },
    loading: { value: false }, error: { value: '' }, appliedFilters: {}, filters: {}, busy: { value: '' }, deleting: { value: '' },
    detailId: { value: 'external' }, detailPage: { value: 1 }, detailLoading: { value: false },
    detailError: { value: '' }, detail: { value: null as unknown },
    http: { post: vi.fn().mockResolvedValue({}), put: vi.fn().mockResolvedValue({ id: 'external', version: 2 }), get: vi.fn().mockResolvedValue({ items: [], total: 0 }), delete: vi.fn().mockResolvedValue({}) },
    ElMessageBox: { confirm: vi.fn().mockResolvedValue('confirm') },
    ElNotification: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
  }
  const compiled = ts.transpileModule(`let disposed = false; let sequence = 0; let detailSequence = 0; ${functions};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const actions = new Function(...Object.keys(state), `${compiled}; return {save, toggle, remove, safeUrl, load, loadDetail, search, reset};`)(...Object.values(state)) as {
    search: () => void; reset: () => void
    save: () => Promise<void>; toggle: (row: Record<string, unknown>) => Promise<void>; safeUrl: (url: string) => string; load: () => Promise<void>
    remove: (row: Record<string, unknown>) => Promise<void>; loadDetail: () => Promise<void>
  }
  return { ...state, ...actions }
}

describe('外部账号只读监听', () => {
  it('排序随请求提交，切换回第一页，清空恢复最新优先', async () => {
    const s = setup()
    s.page.value = 3
    Object.assign(s.filters, { sort_order: 'asc' })
    s.search()
    expect(s.page.value).toBe(1)
    await s.load()
    expect(s.http.get).toHaveBeenLastCalledWith('/api/external-account-monitors', { sort_order: 'asc', page: 1, page_size: 20 })
    s.reset()
    expect(s.filters).toMatchObject({ sort_order: 'desc' })
    expect(s.appliedFilters).toMatchObject({ sort_order: 'desc' })
    expect(source).toContain('v-model="filters.sort_order" @change="search"')
  })
  it('详情翻页使用对应页码，较早的响应不能覆盖新页', async () => {
    const s = setup()
    let resolveFirst!: (value: unknown) => void
    s.http.get.mockReturnValueOnce(new Promise(resolve => { resolveFirst = resolve }))
    const first = s.loadDetail()
    s.detailPage.value = 2
    const result = { monitor: { id: 'external' }, posts: [{ source_key: 'page-2' }], total: 21, snapshots: [] }
    s.http.get.mockResolvedValueOnce(result as never)
    await s.loadDetail()
    resolveFirst({ posts: [{ source_key: 'stale-page-1' }] })
    await first
    expect(s.detail.value).toEqual(result)
    expect(s.http.get).toHaveBeenLastCalledWith('/api/external-account-monitors/external', { page: 2, page_size: 20 })
    expect(s.detailLoading.value).toBe(false)
  })
  it('详情加载失败显示错误并保留当前数据供重试', async () => {
    const s = setup()
    s.detail.value = { posts: [] }
    s.http.get.mockRejectedValueOnce(new Error('加载失败'))
    await s.loadDetail()
    expect(s.detailError.value).toBe('加载失败')
    expect(s.detail.value).toEqual({ posts: [] })
    expect(s.detailLoading.value).toBe(false)
  })
  it('独立入口，不使用账号管理或任务接口', () => {
    expect(routes).toContain("name: 'account-data-external', component: () => import('@/components/ExternalAccountMonitors.vue')")
    expect(source).not.toContain('/api/accounts')
    expect(source).not.toContain('/api/tasks')
    expect(source).not.toContain('comment_reply_mode')
    expect(source).toContain("auth.can('operations.edit')")
    expect(source).toContain('useScopedBusinessPlatformOptions')
  })
  it('添加后继续输入下一账号，保留平台与间隔', async () => {
    const s = setup()
    await s.save()
    expect(s.http.post).toHaveBeenCalledWith('/api/external-account-monitors', { business_platform: 'x', profile_url: 'https://x.com/source', remark: 'note', interval_minutes: 60 })
    expect(s.form.profile_url).toBe('')
    expect(s.formVisible.value).toBe(true)
    expect(s.form.business_platform).toBe('x')
    expect(s.form.interval_minutes).toBe(60)
  })
  it('只读权限和重复点击不会提交', async () => {
    const s = setup()
    s.canEdit.value = false
    await s.save()
    expect(s.http.post).not.toHaveBeenCalled()
    s.canEdit.value = true
    s.saving.value = true
    await s.save()
    expect(s.http.post).not.toHaveBeenCalled()
  })
  it('编辑提交版本，不允许更换采集主体', async () => {
    const s = setup()
    s.editing.value = { id: 'external', version: 1 }
    await s.save()
    expect(s.http.put).toHaveBeenCalledWith('/api/external-account-monitors/external', { remark: 'note', interval_minutes: 60, enabled: true, expected_version: 1 })
    expect(s.editing.value?.version).toBe(2)
    expect(s.http.post).not.toHaveBeenCalled()
  })
  it('失败时保留表单，暂停只改监听配置', async () => {
    const s = setup()
    s.http.post.mockRejectedValueOnce(new Error('duplicate'))
    await s.save()
    expect(s.form.profile_url).toBe('https://x.com/source')
    expect(s.ElNotification.error).toHaveBeenCalled()
    await s.toggle({ id: 'external', version: 4, remark: 'note', enabled: true, interval_minutes: 60 })
    expect(s.http.put).toHaveBeenCalledWith('/api/external-account-monitors/external', { enabled: false, interval_minutes: 60, remark: 'note', expected_version: 4 })
  })
  it('删除前确认并携带当前版本，取消时不调用接口', async () => {
    const s = setup()
    const row = { id: 'external', version: 4, profile_url: 'https://x.com/source', profile: { display_name: 'Source' } }
    await s.remove(row)
    expect(s.ElMessageBox.confirm).toHaveBeenCalledWith(
      expect.stringContaining('已采集帖子和历史指标快照'),
      '删除外部账号监听',
      expect.objectContaining({ confirmButtonText: '确认删除' }),
    )
    expect(s.http.delete).toHaveBeenCalledWith('/api/external-account-monitors/external?expected_version=4')
    expect(s.ElNotification.success).toHaveBeenCalledWith({ title: '外部账号监听已删除' })

    s.http.delete.mockClear()
    s.ElMessageBox.confirm.mockRejectedValueOnce('cancel')
    await s.remove(row)
    expect(s.http.delete).not.toHaveBeenCalled()
    expect(s.ElNotification.error).not.toHaveBeenCalled()
  })
  it('禁止脚本链接及带凭据的外部链接', () => {
    const s = setup()
    expect(s.safeUrl('javascript:alert(1)')).toBe('')
    expect(s.safeUrl('https://user:password@x.com/source')).toBe('')
    expect(s.safeUrl('https://x.com/source')).toBe('https://x.com/source')
  })
})
