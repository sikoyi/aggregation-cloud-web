import { describe, expect, it, vi } from 'vitest'
import ts from 'typescript'
import source from './ExternalAccountMonitors.vue?raw'
import routes from '../router/accountDataRoutes.ts?raw'

const ast = ts.createSourceFile('ExternalMonitor.ts', source.split('<script setup lang="ts">')[1]!.split('</script>')[0]!, ts.ScriptTarget.Latest, true)
const functions = ast.statements.filter(ts.isFunctionDeclaration).map(node => node.getText(ast)).join('\n')
function setup() {
  const state = {
    platforms: { value: [{ value: 'x' }] },
    canEdit: { value: true }, saving: { value: false }, editing: { value: null as Record<string, unknown> | null },
    form: { business_platform: 'x', profile_url: 'https://x.com/source', country: '', remark: 'note', interval_minutes: 60, enabled: true, tag_ids: [] as string[] },
    formVisible: { value: true }, rows: { value: [] as Record<string, unknown>[] }, total: { value: 0 }, page: { value: 1 }, pageSize: { value: 20 },
    refreshing: { value: false }, detailVisible: { value: false }, document: { hidden: false },
    metricSort: { value: null as { prop: string; order: string } | null },
    loading: { value: false }, error: { value: '' }, appliedFilters: { tag_ids: [] as string[] }, filters: { tag_ids: [] as string[] }, busy: { value: '' }, deleting: { value: '' },
    detailId: { value: 'external' }, detailPage: { value: 1 }, detailLoading: { value: false },
    detailError: { value: '' }, detail: { value: null as unknown },
    batchBusy: { value: false }, selected: { value: [] as unknown[] }, table: { value: { clearSelection: vi.fn(), sort: vi.fn() } },
    countries: { value: [] as string[] },
    managedCountries: { countries: [] as string[], version: 1 },
    summary: { value: null as unknown }, groups: { value: [] as { id: string; name: string; member_count: number }[] },
    http: { post: vi.fn().mockResolvedValue({}), put: vi.fn().mockResolvedValue({ id: 'external', version: 2 }), get: vi.fn().mockImplementation(async (path: string) => path.endsWith('/tags') ? [] : path.endsWith('/countries') ? ['日本', '韩国'] : { items: [], total: 0 }), delete: vi.fn().mockResolvedValue({}) },
    ElMessageBox: { confirm: vi.fn().mockResolvedValue('confirm') },
    ElNotification: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
  }
  const get = state.http.get.getMockImplementation()!
  state.http.get.mockImplementation(async (path: string) => path.endsWith('/country-options') ? state.managedCountries : get(path))
  const compiled = ts.transpileModule(`let disposed = false; let sequence = 0; let groupsSequence = 0; let detailSequence = 0; ${functions};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const actions = new Function(...Object.keys(state), `${compiled}; return {openForm, save, toggle, remove, safeUrl, load, loadGroups, loadDetail, search, reset, sortMetrics, filterCountry};`)(...Object.values(state)) as {
    filterCountry: (country?: string, unset?: boolean) => void
    openForm: (row?: Record<string, unknown>) => void
    loadGroups: () => Promise<void>
    sortMetrics: (value: { prop: string | null; order: 'ascending' | 'descending' | null }) => void
    search: () => void; reset: () => void
    save: () => Promise<void>; toggle: (row: Record<string, unknown>) => Promise<void>; safeUrl: (url: string) => string; load: (background?: boolean) => Promise<void>
    remove: (row: Record<string, unknown>) => Promise<void>; loadDetail: () => Promise<void>
  }
  return { ...state, ...actions }
}

describe('外部账号只读监听', () => {
  it('国家独占一行且合并常用和已用国家，未使用的常用国家也显示并去重', async () => {
    const s = setup()
    s.managedCountries.countries = ['加蓬', '日本']
    await s.load()
    expect(s.countries.value).toEqual(['加蓬', '日本', '韩国'])
    expect(source).toContain('label="国家" class="external-monitors__group-filter"')
    expect(source).toContain('v-for="country in countries"')
    expect(source).toContain('v-model="form.country"')
    expect(source).toContain('<ExternalCountrySelect')
    expect(source).not.toContain('v-for="option in accountCountryOptions"')
    expect(s.http.get).toHaveBeenCalledWith('/api/external-account-monitors/countries')
  })
  it('国家、未设置、全部互斥，切换回第一页且批量操作时禁用', async () => {
    const s = setup()
    s.page.value = 3
    s.filterCountry('日本')
    expect(s.page.value).toBe(1)
    expect(s.appliedFilters).toEqual(expect.objectContaining({ country: '日本', country_unset: false }))
    s.filterCountry('', true)
    await s.load()
    expect(s.http.get).toHaveBeenCalledWith('/api/external-account-monitors/summary', expect.objectContaining({ country: '', country_unset: true }))
    s.filterCountry()
    expect(s.appliedFilters).toEqual(expect.objectContaining({ country: '', country_unset: false }))
    s.batchBusy.value = true
    s.filterCountry('韩国')
    expect(s.appliedFilters).toEqual(expect.objectContaining({ country: '', country_unset: false }))
  })
  it('管理国家变更后刷新，新国家无账号也能筛选且保持零结果', async () => {
    const s = setup()
    await s.load()
    s.managedCountries.countries = ['加蓬']
    await s.load()
    expect(s.countries.value).toEqual(['加蓬', '日本', '韩国'])
    Object.assign(s.filters, { country: '加蓬' })
    Object.assign(s.appliedFilters, { country: '加蓬' })
    s.http.get.mockClear()
    await s.load()
    expect(s.total.value).toBe(0)
    expect(s.appliedFilters).toMatchObject({ country: '加蓬' })
    expect(s.http.get).toHaveBeenCalledTimes(4)
    expect(s.http.get).toHaveBeenCalledWith('/api/external-account-monitors/summary', expect.objectContaining({ country: '加蓬' }))
    expect(source).toContain(':disabled="batchBusy" @changed="load()"')
  })
  it('移除常用国家保留历史已使用国家，未使用的移除后清理筛选', async () => {
    const s = setup()
    s.managedCountries.countries = ['加蓬', '日本']
    await s.load()
    s.managedCountries.countries = []
    Object.assign(s.filters, { country: '日本' })
    Object.assign(s.appliedFilters, { country: '日本' })
    await s.load()
    expect(s.countries.value).toEqual(['日本', '韩国'])
    expect(s.appliedFilters).toMatchObject({ country: '日本' })
    Object.assign(s.filters, { country: '加蓬', keyword: 'draft' })
    Object.assign(s.appliedFilters, { country: '加蓬', keyword: 'applied' })
    await s.load()
    expect(s.filters).toMatchObject({ country: '', keyword: 'draft' })
    expect(s.appliedFilters).toMatchObject({ country: '', keyword: 'applied' })
  })
  it('只读用户也展示常用国家，请求失败保留当前国家筛选', async () => {
    const s = setup()
    s.canEdit.value = false
    s.managedCountries.countries = ['加蓬']
    await s.load()
    expect(s.countries.value).toContain('加蓬')
    Object.assign(s.filters, { country: '加蓬' })
    Object.assign(s.appliedFilters, { country: '加蓬' })
    const get = s.http.get.getMockImplementation()!
    s.http.get.mockImplementation(async (path: string) => {
      if (path.endsWith('/country-options')) throw new Error('offline')
      return get(path)
    })
    await s.load()
    expect(s.countries.value).toContain('加蓬')
    expect(s.appliedFilters).toMatchObject({ country: '加蓬' })
    expect(s.error.value).toBe('offline')
  })
  it('迟到的常用国家响应不能覆盖新的管理结果', async () => {
    const s = setup()
    const get = s.http.get.getMockImplementation()!
    let resolve!: (value: { countries: string[] }) => void
    s.http.get.mockImplementation(async (path: string) => path.endsWith('/country-options') ? new Promise<{ countries: string[] }>(done => { resolve = done }) : get(path))
    const old = s.load()
    s.managedCountries.countries = ['加蓬']
    s.http.get.mockImplementation(get)
    await s.load()
    resolve({ countries: ['美国'] })
    await old
    expect(s.countries.value).toEqual(['加蓬', '日本', '韩国'])
  })
  it('国家消失时仅清除该筛选，保留其他已应用条件，不提交草稿', async () => {
    const s = setup()
    Object.assign(s.appliedFilters, { country: '美国', keyword: 'applied', tag_ids: ['a'] })
    Object.assign(s.filters, { country: '美国', keyword: 'draft', tag_ids: ['b'] })
    await s.load()
    expect(s.appliedFilters).toEqual({ country: '', keyword: 'applied', tag_ids: ['a'] })
    expect(s.filters).toEqual({ country: '', keyword: 'draft', tag_ids: ['b'] })
    expect(s.http.get).toHaveBeenCalledTimes(8)
  })
  it('空国家列表和请求失败不产生虚假国家或重复请求', async () => {
    const s = setup()
    s.http.get.mockImplementation(async (path: string) => path.endsWith('/country-options') ? { countries: [] } : path.endsWith('/countries') ? [] : { items: [], total: 0 })
    await s.load()
    expect(s.countries.value).toEqual([])
    expect(s.http.get).toHaveBeenCalledTimes(4)
    s.countries.value = ['日本']
    s.http.get.mockImplementation(async (path: string) => { if (path.endsWith('/countries')) throw new Error('offline'); return { items: [], total: 0 } })
    await s.load()
    expect(s.countries.value).toEqual(['日本'])
    expect(s.error.value).toBe('offline')
  })
  it('旧请求迟到不能覆盖新国家选项', async () => {
    const s = setup()
    let resolve!: (value: string[]) => void
    s.http.get.mockImplementation(async (path: string) => path.endsWith('/country-options') ? { countries: [] } : path.endsWith('/countries') ? new Promise<string[]>(done => { resolve = done }) : { items: [], total: 0 })
    const old = s.load()
    s.http.get.mockImplementation(async (path: string) => path.endsWith('/country-options') ? { countries: [] } : path.endsWith('/countries') ? ['韩国'] : { items: [], total: 0 })
    await s.load()
    resolve(['日本'])
    await old
    expect(s.countries.value).toEqual(['韩国'])
  })
  it('国家单选、连续添加保留国家、重新打开清空并在编辑时回填', async () => {
    const s = setup()
    s.form.country = '日本'
    await s.save()
    expect(s.http.post).toHaveBeenCalledWith('/api/external-account-monitors', expect.objectContaining({ country: '日本' }))
    expect(s.form.country).toBe('日本')
    s.openForm()
    expect(s.form.country).toBe('')
    s.openForm({ id: 'one', country: '韩国', version: 2, profile_url: 'https://x.com/source' })
    expect(s.form.country).toBe('韩国')
    s.form.country = ''
    await s.save()
    expect(s.http.put).toHaveBeenCalledWith('/api/external-account-monitors/one', expect.objectContaining({ country: '', expected_version: 2 }))
    expect(source).toContain('v-if="row.country"')
    expect(source).toContain('v-for="country in countries"')
    expect(source).not.toContain('v-model="filters.country"')
  })
  it('国家筛选同时传给列表和统计，清空时移除国家', async () => {
    const s = setup()
    Object.assign(s.filters, { country: '日本' })
    s.search()
    await s.load()
    expect(s.http.get).toHaveBeenCalledWith('/api/external-account-monitors', expect.objectContaining({ country: '日本', page: 1 }))
    expect(s.http.get).toHaveBeenCalledWith('/api/external-account-monitors/summary', expect.objectContaining({ country: '日本' }))
    s.reset()
    expect(s.appliedFilters).toEqual(expect.objectContaining({ country: '' }))
  })
  it('新增及重新打开默认六小时，编辑和连续添加保留自定义间隔', async () => {
    const s = setup()
    expect(source).toContain("remark: '', interval_minutes: 360, enabled: true, tag_ids:")
    s.openForm()
    expect(s.form.interval_minutes).toBe(360)
    s.form.profile_url = 'https://x.com/source'
    await s.save()
    expect(s.http.post).toHaveBeenCalledWith('/api/external-account-monitors', expect.objectContaining({ interval_minutes: 360 }))

    s.form.interval_minutes = 45
    s.form.profile_url = 'https://x.com/second'
    await s.save()
    expect(s.form.interval_minutes).toBe(45)
    s.openForm({ id: 'external', version: 1, business_platform: 'x', profile_url: 'https://x.com/source', remark: '', interval_minutes: 60, enabled: true })
    expect(s.form.interval_minutes).toBe(60)
    await s.save()
    expect(s.http.put).toHaveBeenCalledWith('/api/external-account-monitors/external', expect.objectContaining({ interval_minutes: 60 }))
    s.openForm()
    expect(s.form.interval_minutes).toBe(360)
  })
  it('标签旧响应不能覆盖最新成员数量', async () => {
    const s = setup()
    let resolve!: (value: unknown) => void
    s.http.get.mockReturnValueOnce(new Promise(done => { resolve = done }))
    const old = s.loadGroups()
    s.http.get.mockResolvedValueOnce([{ id: 'a', name: 'A', member_count: 3 }] as never)
    await s.loadGroups()
    resolve([{ id: 'a', name: 'A', member_count: 1 }])
    await old
    expect(s.groups.value[0]?.member_count).toBe(3)
  })
  it('刷新标签清理失效筛选，不提交尚未查询的关键词', async () => {
    const s = setup()
    Object.assign(s.filters, { tag_ids: ['gone', 'a'], keyword: 'draft' })
    Object.assign(s.appliedFilters, { tag_ids: ['gone', 'a'], keyword: 'applied' })
    s.http.get.mockResolvedValueOnce([{ id: 'a', name: 'A', member_count: 2 }] as never)
    await s.loadGroups()
    expect(s.filters.tag_ids).toEqual(['a'])
    expect(s.appliedFilters).toEqual({ tag_ids: ['a'], keyword: 'applied' })
    expect(s.http.get).toHaveBeenCalledWith('/api/external-account-monitors', expect.objectContaining({ tag_ids: ['a'], keyword: 'applied', page: 1 }))
  })
  it('标签加载失败不清空筛选，旧失败不覆盖新成功', async () => {
    const s = setup()
    s.filters.tag_ids = ['a']
    s.appliedFilters.tag_ids = ['a']
    let reject!: (error: Error) => void
    s.http.get.mockReturnValueOnce(new Promise((_, fail) => { reject = fail }))
    const old = s.loadGroups()
    s.http.get.mockResolvedValueOnce([{ id: 'a', name: 'A', member_count: 2 }] as never)
    await s.loadGroups()
    reject(new Error('old request failed'))
    await old
    expect(s.ElNotification.error).not.toHaveBeenCalled()
    expect(s.appliedFilters.tag_ids).toEqual(['a'])
  })
  it('筛选标签全部失效后回到第一页', async () => {
    const s = setup()
    s.page.value = 3
    s.appliedFilters.tag_ids = ['gone']
    s.filters.tag_ids = ['gone']
    s.http.get.mockResolvedValueOnce([] as never)
    await s.loadGroups()
    expect(s.page.value).toBe(1)
    expect(s.appliedFilters.tag_ids).toEqual([])
  })
  it('添加时一并保存多个标签，连续添加保留选择', async () => {
    const s = setup()
    s.form.tag_ids = ['one', 'two']
    await s.save()
    expect(s.http.post).toHaveBeenCalledWith('/api/external-account-monitors', expect.objectContaining({ tag_ids: ['one', 'two'] }))
    expect(s.form.tag_ids).toEqual(['one', 'two'])
    expect(s.form.profile_url).toBe('')
  })
  it('标签失效时保留账号和标签供修改后重试', async () => {
    const s = setup()
    s.form.tag_ids = ['deleted']
    s.http.post.mockRejectedValueOnce(new Error('所选标签不存在'))
    await s.save()
    expect(s.form.profile_url).toBe('https://x.com/source')
    expect(s.form.tag_ids).toEqual(['deleted'])
    expect(s.ElNotification.error).toHaveBeenCalled()
  })
  it('前日指标增量使用简写并保留完整数值提示', () => {
    expect(source).toContain('formatCompactSignedCount(value)')
    expect(source).toContain(':title="metricDelta(row.day_deltas?.[metric.key], metric.key).fullLabel"')
  })
  it('上涨红色、下跌绿色，持平保持中性色', () => {
    expect(source).toContain('.external-metric-delta.is-up { color: var(--app-red, #cf4f4f); }')
    expect(source).toContain('.external-metric-delta.is-down { color: var(--app-green, #238457); }')
    expect(source).toContain("label: '较前一日 持平', fullLabel: '较前一日 持平', tone: 'flat'")
  })
  it('帖子总数使用平台指标，不以已采集数量替代', () => {
    expect(source).toContain("{ key: 'posts_count', label: '帖子总数' }")
    expect(source).not.toContain('帖子总浏览量')
    expect(source).not.toContain('collected_post_count')
    expect(source).toContain(':value="row.profile[metric.key]"')
    expect(source).not.toContain('定时汇总')
    expect(source).not.toContain('等待汇总')
    expect(source).not.toContain('post_views_updated_at')
  })

  it.each(['followers_count', 'posts_count', 'total_likes_count'])('指标排序与筛选一起发送到服务端：%s', async prop => {
    const s = setup()
    s.metricSort.value = { prop, order: 'asc' }
    Object.assign(s.appliedFilters, { platform: 'x', status: 'active', tag_ids: ['one','two'] })
    await s.load()
    expect(s.http.get).toHaveBeenCalledWith('/api/external-account-monitors', { platform: 'x', status: 'active', tag_ids: ['one','two'], sort_by: prop, sort_order: 'asc', page: 1, page_size: 20 })
    s.reset()
    expect(s.metricSort.value).toBeNull()
    expect(s.table.value.sort).toHaveBeenCalledWith('created_at', 'descending')
  })
  it.each(['ascending', 'descending'] as const)('帖子总数表头支持%s排序', order => {
    const s = setup()
    s.sortMetrics({ prop: 'posts_count', order })
    expect(s.http.get).toHaveBeenCalledWith('/api/external-account-monitors', expect.objectContaining({ sort_by: 'posts_count', sort_order: order === 'ascending' ? 'asc' : 'desc' }))
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
    expect(s.http.get).toHaveBeenCalledTimes(4)
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
    Object.assign(s.appliedFilters, { platform: 'x', tag_ids: ['one'], untagged: false, status: 'paused', keyword: 'source' })
    s.selected.value = [{ id: 'old' }]
    await s.load()
    expect(s.http.get).toHaveBeenCalledWith('/api/external-account-monitors/summary', { platform: 'x', tag_ids: ['one'], untagged: false, keyword: 'source' })
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
    expect(s.http.get).toHaveBeenCalledWith('/api/external-account-monitors', { sort_order: 'asc', tag_ids: [], page: 1, page_size: 20 })
    s.reset()
    expect(s.filters).toMatchObject({ sort_order: 'desc' })
    expect(s.appliedFilters).toMatchObject({ sort_order: 'desc' })
    expect(source).not.toContain('label="监听排序"')
    expect(source).toContain('prop="created_at" label="添加时间"')
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
    expect(s.http.post).toHaveBeenCalledWith('/api/external-account-monitors', { business_platform: 'x', country: '', profile_url: 'https://x.com/source', remark: 'note', interval_minutes: 60, tag_ids: [] })
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
    expect(s.http.put).toHaveBeenCalledWith('/api/external-account-monitors/external', { country: '', remark: 'note', interval_minutes: 60, enabled: true, expected_version: 1, tag_ids: [] })
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
  it('添加时间排序走服务端，切换方向与清空都回到第一页', async () => {
    const s = setup()
    s.page.value = 3
    s.sortMetrics({ prop: 'created_at', order: 'ascending' })
    expect(s.page.value).toBe(1)
    expect(s.metricSort.value).toEqual({ prop: 'created_at', order: 'asc' })
    await s.load()
    expect(s.http.get).toHaveBeenCalledWith('/api/external-account-monitors', expect.objectContaining({ sort_by: 'created_at', sort_order: 'asc' }))
    s.sortMetrics({ prop: 'created_at', order: 'descending' })
    expect(s.metricSort.value).toBeNull()
    s.sortMetrics({ prop: 'total_likes_count', order: 'ascending' })
    s.sortMetrics({ prop: null, order: null })
    expect(s.metricSort.value).toBeNull()
    expect(s.table.value.sort).toHaveBeenCalledWith('created_at', 'descending')
  })
  it('关键词在标签前，排序表头保持单行', () => {
    const filters = source.split('<div class="external-monitors__filters">')[1]!.split('</el-form>')[0]!
    expect(filters.indexOf('label="关键词"')).toBeLessThan(filters.indexOf('label="账号标签"'))
    expect(source).toContain('th.is-sortable .cell')
    expect(source).toContain('justify-content: center; white-space: nowrap;')
  })
})
