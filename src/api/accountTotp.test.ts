import { afterEach, expect, it, vi } from 'vitest'

import { getAccountTotp } from './accountTotp'

afterEach(() => vi.unstubAllGlobals())

it.each(['accounts', 'account-identities'] as const)('验证码按来源请求且不缓存 %s', async source => {
  vi.stubGlobal('localStorage', { getItem: () => 'test-token' })
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 0, data: { code: '001234' } }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  const controller = new AbortController()
  expect(await getAccountTotp(source, 'id/1', controller.signal)).toEqual({ code: '001234' })
  expect(fetchMock.mock.calls[0][0]).toContain(`/api/${source}/id%2F1/totp`)
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'GET', cache: 'no-store', signal: controller.signal })
})
