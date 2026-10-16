import { describe, expect, it, vi } from 'vitest'
import { transpile } from 'typescript'
import { ref } from 'vue'
import rawSource from './AccountDataView.vue?raw'
import { accountGroupKey, accountOverviewRows, accountOverviewRowKey, nextSelectedAccount, selectedPlatformAccounts, updateExpandedAccountKeys } from '@/utils/accountDataGroups'
import { accountDataFocus, accountDataQuery } from '@/utils/accountDataFocus'

const source = rawSource.replace(/\r\n/g, '\n')
const getFunction = (start: string, end: string, context: Record<string, unknown>, name: string) => new Function(
  ...Object.keys(context), `${transpile(source.slice(source.indexOf(start), source.indexOf(end)))}; return ${name};`,
)(...Object.values(context))

describe('多平台账号数据视图', () => {
  it('总览与目录直接使用服务端分组行，详情平台切换使用独立账号 ID', () => {
    expect(source).toContain(':row-key="accountOverviewRowKey"')
    expect(source).toContain(':data="overviewRows"')
    expect(source).toContain(':expand-row-keys="expandedAccountKeys"')
    expect(source).toContain(':key="accountGroupKey(account)"')
    expect(source).toContain('v-model="selectedPlatformId"')
    expect(source).toContain('aria-label="账号平台"')
    expect(source).toContain('v-for="platformAccount in accountPlatforms(scope.row)"')
    expect(source).toContain(':account="accountPanelRecord(selectedAccount)"')
    expect(source).toContain(":key=\"'contents-' + String(selectedAccount.account_id)\"")
  })
  it('切换平台会重置详情标签页，监听与帖子使用新平台数据', () => {
    const a = { account_id: '1', login_identity_id: 'i', business_platform: 'instagram' }
    const b = { account_id: '2', login_identity_id: 'i', business_platform: 'threads' }
    const selectedAccount = { value: a }
    const detailTab = { value: 'contents' }
    const select = getFunction('function selectAccount(', '\nfunction openAccountDetail(', {
      selectedAccount, detailTab, rows: { value: [{ ...a, platform_accounts: [a, b] }] }, nextSelectedAccount,
    }, 'selectAccount')
    select(b)
    expect(selectedAccount.value).toEqual(b)
    expect(detailTab.value).toBe('overview')
  })
  it('返回总览清除精确定位但保留普通筛选，不会再次自动打开详情', () => {
    const state = { focusedAccountId: { value: '2' }, viewMode: { value: 'detail' },
      accountDataRoute: { query: { account_id: '2', view: 'detail', other: 'keep' } },
      accountDataRouter: { replace: vi.fn() }, searchRows: vi.fn() }
    const show = getFunction('function clearAccountFocusQuery()', '\nwatch(() => accountDataRoute.query.account_id', state, 'showAccountOverview')
    show()
    expect(state.focusedAccountId.value).toBe('')
    expect(state.viewMode.value).toBe('overview')
    expect(state.accountDataRouter.replace).toHaveBeenCalledWith({ query: { other: 'keep' } })
    expect(state.searchRows).toHaveBeenCalledOnce()
    show()
    expect(state.searchRows).toHaveBeenCalledOnce()
  })
  it('批量操作收到全部可见平台 ID，而非仅代表行', () => {
    const selectedAccounts = { value: [] }
    const handler = getFunction('function handleOverviewSelectionChange(', '\nfunction handleOverviewExpandChange(', {
      selectedAccounts, selectedPlatformAccounts,
    }, 'handleOverviewSelectionChange')
    const platforms = [{ account_id: '1' }, { account_id: '2' }]
    handler([{ ...platforms[0], group_key: accountGroupKey({ account_id: '1' }), platform_accounts: platforms }])
    expect(selectedAccounts.value).toEqual(platforms)
    expect(source).toContain('个平台账号')
  })
  it('点击身份只展开，不进入详情；单个平台仍可查看详情', () => {
    const row = { is_identity_group: true, account_id: '1' }
    const overviewTableRef = { value: { toggleRowExpansion: vi.fn() } }
    const openAccountDetail = vi.fn()
    const handler = getFunction('function openOverviewRow(', '\nwatch(rows,', { overviewTableRef, openAccountDetail }, 'openOverviewRow')
    handler(row)
    expect(overviewTableRef.value.toggleRowExpansion).toHaveBeenCalledWith(row)
    expect(openAccountDetail).not.toHaveBeenCalled()
    const leaf = { is_identity_group: false, account_id: '2' }
    handler(leaf)
    expect(openAccountDetail).toHaveBeenCalledWith(leaf)
  })
  it('树形展开事件同步稳定键，兼容普通展开事件但不误更新状态', () => {
    const expandedAccountKeys = { value: [] }
    const handler = getFunction('function handleOverviewExpandChange(', '\nfunction openOverviewRow(', {
      expandedAccountKeys, updateExpandedAccountKeys,
    }, 'handleOverviewExpandChange')
    const row = { account_id: '1', login_identity_id: 'a', is_identity_group: true }
    handler(row, true)
    expect(expandedAccountKeys.value).toEqual(['identity:a'])
    handler(row, [])
    expect(expandedAccountKeys.value).toEqual(['identity:a'])
    handler(row, false)
    expect(expandedAccountKeys.value).toEqual([])
  })
  it('筛选和翻页清理失效展开项，刷新保留当前页仍可展开的身份', () => {
    let callback: (records: unknown[]) => void = () => undefined
    const expandedAccountKeys = { value: ['identity:a', 'identity:b'] }
    getFunction('watch(rows,', '\nfunction clearOverviewSelection()', {
      rows: {}, expandedAccountKeys, accountOverviewRows, accountOverviewRowKey,
      watch: (_source: unknown, cb: typeof callback) => { callback = cb },
    }, 'undefined')
    callback([{ account_id: '1', login_identity_id: 'a', platform_accounts: [{ account_id: '1' }, { account_id: '2' }] }])
    expect(expandedAccountKeys.value).toEqual(['identity:a'])
    callback([{ account_id: '1', login_identity_id: 'a', platform_accounts: [{ account_id: '1' }] }])
    expect(expandedAccountKeys.value).toEqual([])
  })
  it('深链接选中非首个平台，后续后台刷新不强制切回定位平台', async () => {
    const a = { account_id: '1', login_identity_id: 'i', business_platform: 'instagram' }
    const b = { account_id: '2', login_identity_id: 'i', business_platform: 'threads' }
    const result = { items: [{ ...a, group_key: 'identity:i', platform_accounts: [a, b] }], total: 1, summary: {} }
    const state = {
      ref, useRoute: () => ({ query: { account_id: '2' } }), useRouter: () => ({}), accountDataFocus, accountDataQuery,
      nextSelectedAccount, rows: { value: [] }, total: { value: 0 }, summary: {}, selectedAccount: { value: null as unknown },
      filters: {}, page: { value: 1 }, pageSize: { value: 20 }, monitorVisible: { value: false },
      batchUpdating: { value: false }, batchIntervalVisible: { value: false }, selectedAccountIds: { value: [] },
      document: { hidden: false }, loading: { value: false }, http: { get: vi.fn().mockResolvedValue(result) },
      openAccountDetail: vi.fn(), notifyError: vi.fn(), ElNotification: { warning: vi.fn() },
    }
    const load = getFunction('let rowsRequest =', '\nfunction searchRows()', state, 'loadRows')
    await load()
    expect(state.selectedAccount.value).toEqual(b)
    expect(state.openAccountDetail).toHaveBeenCalledWith(b)
    expect(state.http.get).toHaveBeenCalledWith('/api/accounts/data-overview', {
      account_id: '2', group_by_identity: true, page: 1, page_size: 20,
    })
    state.selectedAccount.value = a
    await load(true)
    expect(state.selectedAccount.value).toEqual(a)
    expect(state.openAccountDetail).toHaveBeenCalledTimes(1)
    expect(state.ElNotification.warning).not.toHaveBeenCalled()
  })
  it('普通菜单进入时移除详情定位并恢复总览', () => {
    const callbacks: Array<(value: unknown) => void> = []
    const state = {
      watch: (_source: unknown, callback: (value: unknown) => void) => callbacks.push(callback),
      accountDataRoute: { query: {} }, focusedAccountId: { value: '2' }, viewMode: { value: 'detail' },
      selectedAccount: { value: { account_id: '2' } as unknown }, clearOverviewSelection: vi.fn(),
      page: { value: 9 }, loadRows: vi.fn(), accountDataFocus,
    }
    getFunction('watch(() => accountDataRoute.query.account_id', '\nfunction useMonitorFilter(', state, 'undefined')
    callbacks[0]!(undefined)
    expect(state.focusedAccountId.value).toBe('')
    expect(state.viewMode.value).toBe('overview')
    expect(state.selectedAccount.value).toBeNull()
    expect(state.page.value).toBe(1)
    expect(state.loadRows).toHaveBeenCalledOnce()
  })
  it('窄屏标题与操作栏换行，视图切换不压缩重叠，长昵称可换行', () => {
    expect(source.split('.account-data__header {')[1]?.split('}')[0]).toContain('flex-wrap: wrap')
    expect(source).toContain('.account-data__mode { min-width: 184px; flex: 0 0 auto; }')
    expect(source).toContain('.account-data__title { flex: 0 1 auto; }')
    expect(source).toContain('.account-profile__identity { width: 100%; flex: 0 1 auto; }')
    const heading = source.split('.account-profile__name-row h2 {')[1]?.split('}')[0]
    expect(heading).toContain('overflow-wrap: anywhere')
    expect(heading).toContain('white-space: normal')
  })
})
