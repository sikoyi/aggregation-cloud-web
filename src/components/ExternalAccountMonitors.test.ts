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
    formVisible: { value: true }, rows: { value: [] as Record<string, unknown>[] }, total: { value: 0 }, page: { value: 1 }, pageSize: { value: 20 },
    refreshing: { value: false }, detailVisible: { value: false }, document: { hidden: false },
    metricSort: { value: null as { prop: string; order: string } | null },
    loading: { value: false }, error: { value: '' }, appliedFilters: {}, filters: {}, busy: { value: '' }, deleting: { value: '' },
    detailId: { value: 'external' }, detailPage: { value: 1 }, detailLoading: { value: false },
    detailError: { value: '' }, detail: { value: null as unknown },
    batchBusy: { value: false }, selected: { value: [] as unknown[] }, table: { value: { clearSelection: vi.fn(), clearSort: vi.fn() } },
    summary: { value: null as unknown }, groups: { value: [] },
    http: { post: vi.fn().mockResolvedValue({}), put: vi.fn().mockResolvedValue({ id: 'external', version: 2 }), get: vi.fn().mockResolvedValue({ items: [], total: 0 }), delete: vi.fn().mockResolvedValue({}) },
    ElMessageBox: { confirm: vi.fn().mockResolvedValue('confirm') },
    ElNotification: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
  }
  const compiled = ts.transpileModule(`let disposed = false; let sequence = 0; let detailSequence = 0; ${functions};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const actions = new Function(...Object.keys(state), `${compiled}; return {save, toggle, remove, safeUrl, load, loadDetail, search, reset};`)(...Object.values(state)) as {
    search: () => void; reset: () => void
    save: () => Promise<void>; toggle: (row: Record<string, unknown>) => Promise<void>; safeUrl: (url: string) => string; load: (background?: boolean) => Promise<void>
    remove: (row: Record<string, unknown>) => Promise<void>; loadDetail: () => Promise<void>
  }
  return { ...state, ...actions }
}

describe('外部账号只读监听', () => {
  it('前日指标增量使用简写并保留完整数值提示', () => {
    expect(source).toContain('formatCompactSignedCount(value)')
    expect(source).toContain(':title="metricDelta(row.day_deltas?.[metric.key], metric.key).fullLabel"')
  })
  it('浏览量列只展示缓存值和日增量，不暴露汇总状态', () => {
    expect(source).toContain(':value="row.profile[metric.key]"')
    expect(source).not.toContain('定时汇总')
    expect(source).not.toContain('等待汇总')
    expect(source).not.toContain('post_views_updated_at')
  })

  it.each(['followers_count', 'total_post_views_count', 'total_likes_count'])('指标排序与筛选一起发送到服务端：%s', async prop => {
    const s = setup()
    s.metricSort.value = { prop, order: 'asc' }
    Object.assign(s.appliedFilters, { platform: 'x', status: 'active', group_id: 'group' })
    await s.load()
    expect(s.http.get).toHaveBeenCalledWith('/api/external-account-monitors', { platform: 'x', status: 'active', group_id: 'group', sort_by: prop, sort_order: 'asc', page: 1, page_size: 20 })
    s.reset()
    expect(s.metricSort.value).toBeNull()
    expect(s.table.value.clearSort).toHaveBeenCalled()
  })
  it('后台刷新不显示遮罩、不清除选择、未变化的行保持引用', async () => {
    const s = setup()
    s.formVisible.value = false
    s.rows.value = [{ id: 'one', version: 1 }]
    const previous = s.rows.value
    s.http.get.mockResolvedValueOnce({ items: [{ id: 'one', version: 1 }], total: 1 } as never)
    const pending = s.load(true)
    expect(s.loading.value).toBe(false)
    expect(s.refreshing.value).toBe(true)
    await pending
    expect(s.table.value.clearSelection).not.toHaveBeenCalled()
    expect(s.rows.value).toBe(previous)
    expect(s.refreshing.value).toBe(false)
  })
  it('后台请求不重叠，响应期间开始勾选时不覆盖列表', async () => {
    const s = setup()
    s.formVisible.value = false
    let resolve!: (value: unknown) => void
    s.http.get.mockReturnValueOnce(new Promise(done => { resolve = done }))
    const pending = s.load(true)
    await s.load(true)
    expect(s.http.get).toHaveBeenCalledTimes(2)
    s.selected.value = [{ id: 'one' }]
    resolve({ items: [{ id: 'two' }], total: 1 })
    await pending
    expect(s.rows.value).toEqual([])
    expect(s.selected.value).toEqual([{ id: 'one' }])
  })
  it.each(['formVisible', 'detailVisible', 'loading', 'saving', 'batchBusy'] as const)('操作中不自动刷新：%s', async key => {
    const s = setup()
    s.formVisible.value = false
    s[key].value = true
    await s.load(true)
    expect(s.http.get).not.toHaveBeenCalled()
  })
  it('旧后台响应不能覆盖手动刷新结果', async () => {
    const s = setup()
    s.formVisible.value = false
    let resolve!: (value: unknown) => void
    s.http.get.mockReturnValueOnce(new Promise(done => { resolve = done }))
    const pending = s.load(true)
    s.http.get.mockResolvedValueOnce({ items: [{ id: 'new' }], total: 1 } as never)
    await s.load()
    resolve({ items: [{ id: 'old' }], total: 1 })
    await pending
    expect(s.rows.value).toEqual([{ id: 'new' }])
    expect(s.loading.value).toBe(false)
  })
  it('后台失败保留现有数据且不弹出遮罩或错误横幅', async () => {
    const s = setup()
    s.formVisible.value = false
    s.rows.value = [{ id: 'one' }]
    s.http.get.mockRejectedValueOnce(new Error('offline'))
    await s.load(true)
    expect(s.rows.value).toEqual([{ id: 'one' }])
    expect(s.error.value).toBe('')
    expect(s.refreshing.value).toBe(false)
  })
  it('统计不受状态和分页限制，刷新清除旧选择', async () => {
    const s = setup()
    Object.assign(s.appliedFilters, { platform: 'x', group_id: 'group', status: 'paused', keyword: 'source' })
    s.selected.value = [{ id: 'old' }]
    await s.load()
    expect(s.http.get).toHaveBeenCalledWith('/api/external-account-monitors/summary', { platform: 'x', group_id: 'group', keyword: 'source' })
    expect(s.selected.value).toEqual([])
    expect(s.table.value.clearSelection).toHaveBeenCalled()
    s.http.get.mockClear()
    s.batchBusy.value = true
    await s.load()
    expect(s.http.get).not.toHaveBeenCalled()
  })
  it('排序随请求提交，切换回第一页，清空恢复最新优先', async () => {
    const s = setup()
    s.page.value = 3
    Object.assign(s.filters, { sort_order: 'asc' })
    s.search()
    expect(s.page.value).toBe(1)
    await s.load()
    expect(s.http.get).toHaveBeenCalledWith('/api/external-account-monitors', { sort_order: 'asc', page: 1, page_size: 20 })
    s.reset()
    expect(s.filters).toMatchObject({ sort_order: 'desc' })
    expect(s.appliedFilters).toMatchObject({ sort_order: 'desc' })
    expect(source).toContain('v-model="filters.sort_order" @change="sortByCreated"')
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
