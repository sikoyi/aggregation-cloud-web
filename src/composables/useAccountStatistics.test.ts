import { effectScope, type EffectScope } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { http } from '@/api/http'
import { useAccountStatistics, type AccountStatistics } from './useAccountStatistics'

vi.mock('@/api/http', () => ({ http: { getWithSignal: vi.fn() } }))
const scopes: EffectScope[] = []
const sample = (total = 0): AccountStatistics => ({
  total, online: 0, logged_in: 0, not_logged_in: 0, banned: 0,
  verification_required: 0, unknown: 0, exported: 0,
})
function setup() {
  const scope = effectScope()
  scopes.push(scope)
  return { scope, stats: scope.run(useAccountStatistics)! }
}
afterEach(() => { scopes.splice(0).forEach(scope => scope.stop()); vi.resetAllMocks() })

describe('platform account statistics', () => {
  it('counts all matching accounts, excluding page and shortcut parameters', async () => {
    vi.mocked(http.getWithSignal).mockResolvedValue(sample())
    const { stats } = setup()
    await stats.refresh({ page: 5, page_size: 1, account_status: 'online', business_platform: 'threads', tag_id: 'a&b' })
    expect(http.getWithSignal).toHaveBeenCalledWith(
      '/api/account-identities/statistics?business_platform=threads&tag_id=a%26b', expect.any(AbortSignal),
    )
    expect(stats.counts.value?.total).toBe(0)
    expect(stats.failed.value).toBe(false)
  })

  it('aborts old requests and ignores their late results', async () => {
    let first!: (value: AccountStatistics) => void
    vi.mocked(http.getWithSignal).mockImplementationOnce(() => new Promise(resolve => { first = resolve }))
      .mockResolvedValueOnce(sample(2))
    const { stats } = setup()
    const pending = stats.refresh({ business_platform: 'threads' })
    const signal = vi.mocked(http.getWithSignal).mock.calls[0][1]
    await stats.refresh({ business_platform: 'instagram' })
    expect(signal.aborted).toBe(true)
    first(sample(99))
    await pending
    expect(stats.counts.value?.total).toBe(2)
  })

  it('clears previous scope immediately and shows failure rather than zero', async () => {
    vi.mocked(http.getWithSignal).mockResolvedValueOnce(sample(12)).mockRejectedValueOnce(new Error('offline'))
    const { stats } = setup()
    await stats.refresh({ business_platform: 'threads' })
    const pending = stats.refresh({ business_platform: 'instagram' })
    expect(stats.counts.value).toBe(null)
    await pending
    expect(stats.failed.value).toBe(true)
    expect(stats.loading.value).toBe(false)
  })

  it('does not apply a response after disposal', async () => {
    let resolve!: (value: AccountStatistics) => void
    vi.mocked(http.getWithSignal).mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const { stats, scope } = setup()
    const pending = stats.refresh({})
    scope.stop()
    resolve(sample(3))
    await pending
    expect(stats.counts.value).toBe(null)
  })
})
