import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, reactive } from 'vue'
import { http } from '@/api/http'
import { useAccountCredentialReveal } from './useAccountCredentialReveal'

const secret = { id: 'a', password_secret_ref: 'single-account-password', totp_secret_ref: 'single-account-key' }
function setup() {
  const context = reactive({ id: 'a', source: 'accounts' as const, actorId: 'admin', allowed: true, revision: 1 })
  const scope = effectScope()
  const state = scope.run(() => useAccountCredentialReveal(() => context))!
  return { context, scope, state }
}
afterEach(() => vi.restoreAllMocks())

describe('单账号凭据密码验证', () => {
  it('每次打开都重新验证，不修改权限或全局状态', async () => {
    const post = vi.spyOn(http, 'postWithSignal').mockResolvedValue(secret)
    const { state, context, scope } = setup()
    await state.reveal()
    expect(post).not.toHaveBeenCalled()
    state.open()
    state.adminPassword.value = 'root-current-password'
    await state.reveal()
    expect(post).toHaveBeenCalledWith('/api/accounts/a/credentials/reveal', { admin_password: 'root-current-password' }, expect.any(AbortSignal))
    expect(state.credentials.value).toEqual(secret)
    expect(state.adminPassword.value).toBe('')
    expect(context.allowed).toBe(true)
    state.close()
    expect(state.credentials.value).toBeNull()
    state.open()
    await state.reveal()
    expect(post).toHaveBeenCalledTimes(1)
    expect(state.credentials.value).toBeNull()
    scope.stop()
  })

  it.each(['wrong password', 'rate limited', 'service unavailable'])('失败不保留密码和凭据: %s', async message => {
    vi.spyOn(http, 'postWithSignal').mockRejectedValue(new Error(message))
    const { state, scope } = setup()
    state.open(); state.adminPassword.value = 'test-password'
    await state.reveal()
    expect(state.error.value).toBe(message)
    expect(state.adminPassword.value).toBe('')
    expect(state.credentials.value).toBeNull()
    expect(state.loading.value).toBe(false)
    scope.stop()
  })

  it.each(['close', 'id', 'actor', 'permission', 'revision', 'unmount'])('慢响应在 %s 后不能重新显示', async change => {
    let resolve!: (value: typeof secret) => void
    const post = vi.spyOn(http, 'postWithSignal').mockReturnValue(new Promise(done => { resolve = done }))
    const { state, context, scope } = setup()
    state.open(); state.adminPassword.value = 'password'
    const pending = state.reveal()
    await state.reveal()
    expect(post).toHaveBeenCalledTimes(1)
    if (change === 'close') state.close()
    if (change === 'id') context.id = 'b'
    if (change === 'actor') context.actorId = 'other'
    if (change === 'permission') context.allowed = false
    if (change === 'revision') context.revision++
    if (change === 'unmount') scope.stop()
    expect(post.mock.calls[0]![2].aborted).toBe(true)
    resolve(secret); await pending
    expect(state.credentials.value).toBeNull()
    expect(state.visible.value).toBe(false)
    scope.stop()
  })

  it('无权限不能打开或请求，响应账号不匹配时拒绝展示', async () => {
    const post = vi.spyOn(http, 'postWithSignal').mockResolvedValue({ ...secret, id: 'other' })
    const { state, context, scope } = setup()
    context.allowed = false; state.open(); state.adminPassword.value = 'password'
    await state.reveal()
    expect(post).not.toHaveBeenCalled()
    context.allowed = true; state.open(); state.adminPassword.value = 'password'
    await state.reveal()
    expect(state.credentials.value).toBeNull()
    expect(state.error.value).toContain('账号信息已变化')
    scope.stop()
  })
})
