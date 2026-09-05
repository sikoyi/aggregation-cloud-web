import { ElMessage } from 'element-plus'
import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getAccountIdentity, updateAccountIdentityCredentials, type AccountIdentityDetail } from '@/api/accountIdentities'
import { ApiError } from '@/api/http'
import { buildCredentialsPatch, credentialForm, useAccountIdentityCredentials } from './useAccountIdentityCredentials'

vi.mock('@/api/accountIdentities', () => ({
  getAccountIdentity: vi.fn(),
  updateAccountIdentityCredentials: vi.fn(),
}))
vi.mock('element-plus', () => ({ ElMessage: { success: vi.fn(), warning: vi.fn() } }))
vi.mock('@/utils/notify', () => ({ notifyError: vi.fn((error: Error) => error.message) }))

function identity(overrides: Partial<AccountIdentityDetail> = {}): AccountIdentityDetail {
  return {
    id: 'identity-1',
    login_username: 'shared-user',
    password_secret_ref: 'original-password',
    totp_secret_ref: '001234',
    twofa_type: 'backup_code',
    credentials_version: 3,
    can_edit_credentials: true,
    ...overrides,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('共享凭据差量请求', () => {
  it('没有修改时不提交，包括缺失的可选字段', () => {
    const record = identity()
    expect(buildCredentialsPatch(record, credentialForm(record))).toBeNull()
    const empty = identity({ login_username: null, password_secret_ref: undefined, totp_secret_ref: null })
    expect(buildCredentialsPatch(empty, credentialForm(empty))).toBeNull()
  })

  it('只发送变化字段，保留密码空格及 2FA 前导零，不推导 2FA 类型', () => {
    const record = identity()
    const form = credentialForm(record)
    form.password_secret_ref = ' new password '
    form.totp_secret_ref = '000456'
    expect(buildCredentialsPatch(record, form)).toEqual({
      expected_credentials_version: 3,
      password_secret_ref: ' new password ',
      totp_secret_ref: '000456',
    })
    form.login_username = 'new-user'
    expect(buildCredentialsPatch(record, form)?.login_username).toBe('new-user')
  })

  it('空输入不覆盖已有值，也不发送 false 清空标志', () => {
    const record = identity()
    const form = credentialForm()
    form.password_secret_ref = '  '
    form.totp_secret_ref = '\t'
    expect(buildCredentialsPatch(record, form)).toBeNull()
    form.login_username = 'new-user'
    expect(buildCredentialsPatch(record, form)).toEqual({ expected_credentials_version: 3, login_username: 'new-user' })
  })

  it.each(['clear_password', 'clear_totp'] as const)('勾选 %s 只发送显式删除标志', (key) => {
    const record = identity()
    const form = credentialForm(record)
    form[key] = true
    expect(buildCredentialsPatch(record, form)).toEqual({ expected_credentials_version: 3, [key]: true })
  })

  it('清空选项优先于输入值，取消勾选后恢复差量比较', () => {
    const record = identity()
    const form = credentialForm(record)
    form.password_secret_ref = 'replacement'
    form.totp_secret_ref = '000999'
    form.clear_password = true
    form.clear_totp = true
    expect(buildCredentialsPatch(record, form)).toEqual({ expected_credentials_version: 3, clear_password: true, clear_totp: true })
    form.clear_password = false
    form.clear_totp = false
    expect(buildCredentialsPatch(record, form)).toEqual({
      expected_credentials_version: 3, password_secret_ref: 'replacement', totp_secret_ref: '000999',
    })
  })

  it.each([undefined, null, 0, -1, 1.5, '2', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('拒绝无效版本 %s', (version) => {
    const record = identity({ credentials_version: version as number })
    expect(() => buildCredentialsPatch(record, { ...credentialForm(record), clear_totp: true })).toThrow('版本无效')
  })

  it('接受最小版本 1', () => {
    const record = identity({ credentials_version: 1 })
    expect(buildCredentialsPatch(record, { ...credentialForm(record), clear_totp: true })).toEqual({
      expected_credentials_version: 1, clear_totp: true,
    })
  })
})

describe('共享凭据弹窗状态', () => {
  const scopes: EffectScope[] = []

  function openEditor(permission = true) {
    const scope = effectScope()
    scopes.push(scope)
    const id = ref('identity-1')
    const allowed = ref(permission)
    const saved = vi.fn()
    const state = scope.run(() => useAccountIdentityCredentials(id, () => allowed.value, saved))!
    return { state, id, allowed, saved, scope }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAccountIdentity).mockReset().mockResolvedValue(identity())
    vi.mocked(updateAccountIdentityCredentials).mockReset().mockResolvedValue(identity({ credentials_version: 4 }))
  })
  afterEach(() => {
    scopes.splice(0).forEach((scope) => scope.stop())
  })

  it('仅在打开时读取详情，保存使用详情最新版本，成功仅刷新一次', async () => {
    const { state, saved } = openEditor()
    expect(state.loading.value).toBe(true)
    await state.save()
    await nextTick()
    expect(getAccountIdentity).toHaveBeenCalledExactlyOnceWith('identity-1')
    expect(state.form.totp_secret_ref).toBe('001234')
    expect(state.canSave.value).toBe(false)
    state.form.password_secret_ref = 'replacement'
    expect(state.canSave.value).toBe(true)
    await state.save()
    await state.save()
    expect(updateAccountIdentityCredentials).toHaveBeenCalledExactlyOnceWith('identity-1', {
      expected_credentials_version: 3, password_secret_ref: 'replacement',
    })
    expect(saved).toHaveBeenCalledOnce()
    expect(state.detail.value).toBeNull()
    expect(state.form.password_secret_ref).toBe('')
  })

  it('无修改时不会请求 PATCH 或刷新', async () => {
    const { state, saved } = openEditor()
    await nextTick()
    await state.save()
    expect(updateAccountIdentityCredentials).not.toHaveBeenCalled()
    expect(saved).not.toHaveBeenCalled()
  })

  it('服务端成功但版本未增加时仍正常完成', async () => {
    vi.mocked(updateAccountIdentityCredentials).mockResolvedValueOnce(identity())
    const { state, saved } = openEditor()
    await nextTick()
    state.form.clear_totp = true
    await state.save()
    expect(saved).toHaveBeenCalledOnce()
    expect(state.error.value).toBe('')
  })

  it('提交中阻止重复保存和重新加载', async () => {
    const pending = deferred<AccountIdentityDetail>()
    vi.mocked(updateAccountIdentityCredentials).mockReturnValue(pending.promise)
    const { state, saved } = openEditor()
    await nextTick()
    state.form.clear_password = true
    const first = state.save()
    expect(state.submitting.value).toBe(true)
    expect(state.canSave.value).toBe(false)
    await state.save()
    await state.load()
    expect(updateAccountIdentityCredentials).toHaveBeenCalledOnce()
    expect(getAccountIdentity).toHaveBeenCalledOnce()
    pending.resolve(identity())
    await first
    expect(state.submitting.value).toBe(false)
    expect(saved).toHaveBeenCalledOnce()
  })

  it('409 保留草稿并阻止旧版本重试，显式重载后采用新版本', async () => {
    vi.mocked(updateAccountIdentityCredentials).mockRejectedValueOnce(new ApiError('version conflict', 409))
    const { state, saved } = openEditor()
    await nextTick()
    state.form.password_secret_ref = 'draft'
    await state.save()
    expect(state.conflict.value).toBe(true)
    expect(state.error.value).toContain('重新加载')
    expect(state.form.password_secret_ref).toBe('draft')
    expect(state.canSave.value).toBe(false)
    expect(ElMessage.warning).toHaveBeenCalledOnce()
    expect(saved).not.toHaveBeenCalled()
    await state.save()
    expect(updateAccountIdentityCredentials).toHaveBeenCalledOnce()
    expect(getAccountIdentity).toHaveBeenCalledOnce()

    vi.mocked(getAccountIdentity).mockResolvedValueOnce(identity({ credentials_version: 4, password_secret_ref: 'concurrent' }))
    await state.load()
    expect(state.form.password_secret_ref).toBe('concurrent')
    expect(state.conflict.value).toBe(false)
    expect(state.canSave.value).toBe(false)
    state.form.clear_totp = true
    await state.save()
    expect(updateAccountIdentityCredentials).toHaveBeenLastCalledWith('identity-1', { expected_credentials_version: 4, clear_totp: true })
    expect(saved).toHaveBeenCalledOnce()
  })

  it('网络失败保留输入、恢复按钮，重试成功前不刷新', async () => {
    vi.mocked(updateAccountIdentityCredentials).mockRejectedValueOnce(new Error('网络连接失败'))
    const { state, saved } = openEditor()
    await nextTick()
    state.form.login_username = 'new-user'
    await state.save()
    expect(state.error.value).toBe('网络连接失败')
    expect(state.form.login_username).toBe('new-user')
    expect(state.submitting.value).toBe(false)
    expect(state.canSave.value).toBe(true)
    expect(saved).not.toHaveBeenCalled()
    await state.save()
    expect(saved).toHaveBeenCalledOnce()
  })

  it('无 accounts.edit 权限不加载也不提交', async () => {
    const { state } = openEditor(false)
    state.form.clear_password = true
    await state.save()
    expect(getAccountIdentity).not.toHaveBeenCalled()
    expect(updateAccountIdentityCredentials).not.toHaveBeenCalled()
    expect(state.canEdit.value).toBe(false)
  })

  it.each([false, undefined])('详情 can_edit_credentials=%s 时不允许编辑', async (permission) => {
    vi.mocked(getAccountIdentity).mockResolvedValueOnce(identity({ can_edit_credentials: permission as boolean }))
    const { state } = openEditor()
    await nextTick()
    state.form.clear_totp = true
    await state.save()
    expect(state.canEdit.value).toBe(false)
    expect(state.error.value).toContain('无权编辑')
    expect(updateAccountIdentityCredentials).not.toHaveBeenCalled()
  })

  it('打开后权限撤销仍不能提交', async () => {
    const { state, allowed } = openEditor()
    await nextTick()
    state.form.clear_totp = true
    allowed.value = false
    await state.save()
    expect(state.canSave.value).toBe(false)
    expect(updateAccountIdentityCredentials).not.toHaveBeenCalled()
  })

  it('服务端 403 后禁用保存', async () => {
    vi.mocked(updateAccountIdentityCredentials).mockRejectedValueOnce(new ApiError('无权限', 403))
    const { state } = openEditor()
    await nextTick()
    state.form.clear_totp = true
    await state.save()
    expect(state.canEdit.value).toBe(false)
    await state.save()
    expect(updateAccountIdentityCredentials).toHaveBeenCalledOnce()
  })

  it('无效版本不能回退到 1，也不能保存', async () => {
    vi.mocked(getAccountIdentity).mockResolvedValueOnce(identity({ credentials_version: 0 }))
    const { state } = openEditor()
    await nextTick()
    state.form.clear_totp = true
    await state.save()
    expect(state.error.value).toContain('版本无效')
    expect(updateAccountIdentityCredentials).not.toHaveBeenCalled()
  })

  it('详情加载失败时可重新加载，加载前无可编辑的旧凭据', async () => {
    vi.mocked(getAccountIdentity).mockRejectedValueOnce(new Error('加载失败'))
    const { state } = openEditor()
    await nextTick()
    expect(state.loading.value).toBe(false)
    expect(state.detail.value).toBeNull()
    expect(state.error.value).toBe('加载失败')
    await state.load()
    expect(state.error.value).toBe('')
    expect(state.canEdit.value).toBe(true)
  })

  it('切换身份时忽略过期详情响应', async () => {
    const pending = deferred<AccountIdentityDetail>()
    vi.mocked(getAccountIdentity).mockReturnValueOnce(pending.promise)
    const { state, id } = openEditor()
    vi.mocked(getAccountIdentity).mockResolvedValueOnce(identity({ id: 'identity-2', login_username: 'second' }))
    id.value = 'identity-2'
    await nextTick()
    await nextTick()
    pending.resolve(identity())
    await nextTick()
    expect(state.detail.value?.id).toBe('identity-2')
    expect(state.form.login_username).toBe('second')
  })

  it('关闭时清除凭据，迟到的详情不能重新填充', async () => {
    const pending = deferred<AccountIdentityDetail>()
    vi.mocked(getAccountIdentity).mockReturnValueOnce(pending.promise)
    const { state, scope } = openEditor()
    scope.stop()
    pending.resolve(identity())
    await nextTick()
    expect(state.detail.value).toBeNull()
    expect(state.form.password_secret_ref).toBe('')
  })
})
