import { effectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { http } from '@/api/http'
import platformDetailsSource from '@/components/AccountIdentityPlatformDetails.vue?raw'
import { platformAccountChanges, platformAccountForm, usePlatformAccountEdit } from './usePlatformAccountEdit'

vi.mock('@/api/http', () => ({ http: { get: vi.fn(), put: vi.fn() } }))
vi.mock('@/utils/notify', () => ({ getErrorMessage: (e: Error) => e.message }))
const record = { id: '11', business_platform: 'instagram', display_name: 'Ins', username: 'ins-user',
  country: '美国', account_age_type: 'new', profile_url: 'https://instagram.com/ins-user', tag_ids: ['1'],
  login_username: 'shared', password_secret_ref: 'secret', totp_secret_ref: 'secret2', login_status: 'logged_in' }
const scopes: ReturnType<typeof effectScope>[] = []
function editor(canEdit = () => true, platform = 'instagram') {
  const scope = effectScope(); scopes.push(scope)
  return scope.run(() => usePlatformAccountEdit('11', platform, canEdit))!
}
beforeEach(() => { vi.resetAllMocks(); vi.mocked(http.get).mockResolvedValue({ ...record }); vi.mocked(http.put).mockResolvedValue({}) })
afterEach(() => { scopes.splice(0).forEach(s => s.stop()) })

describe('平台账号编辑', () => {
  it('编辑入口不限制业务平台，仍受账号编辑权限保护', () => {
    expect(platformDetailsSource).toMatch(/<template v-if="auth.can\('accounts.edit'\)">\s*<el-tooltip content="编辑平台账号"/)
  })
  it.each(['threads', 'instagram', 'x', 'shopify'])('%s 平台均可独立保存资料', async platform => {
    vi.mocked(http.get).mockResolvedValueOnce({ ...record, business_platform: platform })
    const state = editor(() => true, platform)
    await state.load()
    state.form.display_name = 'Updated'
    expect(await state.save()).toBe(true)
    expect(http.put).toHaveBeenCalledExactlyOnceWith('/api/accounts/11', { display_name: 'Updated' })
  })
  it('只发送确认的资料字段，不提交共享凭据、登录状态或绑定', () => {
    const form = { ...platformAccountForm(record), display_name: 'New', login_username: 'other', password_secret_ref: 'changed' }
    expect(platformAccountChanges(record, form)).toEqual({ profile: { display_name: 'New' }, tags: null })
  })
  it('标签顺序不构成修改，支持显式清空标签及可选资料', () => {
    expect(platformAccountChanges({ tag_ids: ['1', '2'] }, platformAccountForm({ tag_ids: ['2', '1', '1'] })).tags).toBeNull()
    const form = platformAccountForm(record); form.tag_ids = []; form.display_name = ''
    expect(platformAccountChanges(record, form)).toEqual({ profile: { display_name: null }, tags: [] })
  })
  it('未修改不提交，保存仅针对当前平台账号', async () => {
    const state = editor(); await state.load()
    expect(await state.save()).toBe(false)
    state.form.username = 'new-ins'
    expect(await state.save()).toBe(true)
    expect(http.put).toHaveBeenCalledExactlyOnceWith('/api/accounts/11', { username: 'new-ins' })
  })
  it('资料失败不继续修改标签且保留输入', async () => {
    const state = editor(); await state.load()
    state.form.username = 'duplicate'; state.form.tag_ids = ['2']
    vi.mocked(http.put).mockRejectedValueOnce(new Error('同业务 App 下账号已存在'))
    expect(await state.save()).toBe(false)
    expect(http.put).toHaveBeenCalledTimes(1)
    expect(state.form.username).toBe('duplicate')
    expect(state.changed.value).toBe(false)
    expect(state.error.value).toContain('已存在')
  })
  it('部分成功明确提示，重试只更新失败标签', async () => {
    const state = editor(); await state.load()
    state.form.display_name = ' New '; state.form.tag_ids = ['2']
    vi.mocked(http.put).mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('标签不存在'))
    expect(await state.save()).toBe(false)
    expect(state.error.value).toContain('资料已保存，但标签保存失败')
    expect(state.changed.value).toBe(true)
    expect(await state.save()).toBe(true)
    expect(http.put).toHaveBeenCalledTimes(3)
    expect(http.put).toHaveBeenLastCalledWith('/api/accounts/11/tags', { tag_ids: ['2'] })
  })
  it('无权限不可加载，权限撤销不可提交', async () => {
    let allowed = false; const state = editor(() => allowed)
    await state.load(); expect(http.get).not.toHaveBeenCalled()
    allowed = true; await state.load(); state.form.display_name = 'Other'
    allowed = false
    expect(await state.save()).toBe(false); expect(http.put).not.toHaveBeenCalled()
  })
  it('账号或平台不匹配拒绝编辑，加载失败可重试', async () => {
    vi.mocked(http.get).mockResolvedValueOnce({ ...record, business_platform: 'threads' })
    const state = editor(); await state.load()
    expect(state.detail.value).toBeNull(); expect(state.error.value).toContain('已变化')
    await state.load(); expect(state.detail.value?.id).toBe('11')
  })
  it.each(['javascript:alert(1)', 'not-a-url', 'ftp://example.com'])('拒绝无效主页链接 %s', async url => {
    const state = editor(); await state.load(); state.form.profile_url = url
    expect(await state.save()).toBe(false); expect(http.put).not.toHaveBeenCalled()
    expect(state.error.value).toContain('http')
  })
  it('阻止重复保存', async () => {
    const state = editor(); await state.load(); state.form.display_name = 'New'
    let finish!: (v: unknown) => void
    vi.mocked(http.put).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const pending = state.save()
    expect(await state.save()).toBe(false)
    finish({}); await pending
    expect(http.put).toHaveBeenCalledTimes(1)
  })
})
