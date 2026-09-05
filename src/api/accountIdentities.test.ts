import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getAccountIdentity, updateAccountIdentityCredentials } from '@/api/accountIdentities'
import { http } from '@/api/http'

vi.mock('@/api/http', () => ({ http: { get: vi.fn(), patch: vi.fn() } }))

describe('身份共享凭据接口', () => {
  beforeEach(() => vi.clearAllMocks())

  it('编辑时按身份 ID 获取最新详情', async () => {
    const detail = { id: 'identity/1', credentials_version: 4, can_edit_credentials: true }
    vi.mocked(http.get).mockResolvedValueOnce(detail)
    await expect(getAccountIdentity('identity/1')).resolves.toEqual(detail)
    expect(http.get).toHaveBeenCalledExactlyOnceWith('/api/account-identities/identity%2F1')
  })

  it('以 PATCH 发送差量字段及独立清空标志', async () => {
    const body = { expected_credentials_version: 4, login_username: 'shared', clear_totp: true as const }
    await updateAccountIdentityCredentials('identity/1', body)
    expect(http.patch).toHaveBeenCalledExactlyOnceWith('/api/account-identities/identity%2F1/credentials', body)
    expect(http.get).not.toHaveBeenCalled()
  })
})
