import { onScopeDispose, ref } from 'vue'
import { http } from '@/api/http'
import type { AnyRecord } from '@/types/api'

export type AccountStatisticKey = 'total' | 'online' | 'logged_in' | 'not_logged_in'
  | 'banned' | 'verification_required' | 'unknown' | 'exported'
export type AccountStatistics = Record<AccountStatisticKey, number>

export function useAccountStatistics() {
  const counts = ref<AccountStatistics | null>(null)
  const loading = ref(false)
  const failed = ref(false)
  let controller: AbortController | undefined
  let requestId = 0
  let lastScope = ''

  async function refresh(params: AnyRecord) {
    const query = new URLSearchParams()
    Object.keys(params).sort().forEach(key => {
      if (['page', 'page_size', 'account_status'].includes(key)) return
      const value = params[key]
      if (value !== '' && value !== null && value !== undefined) query.set(key, String(value))
    })
    const scope = query.toString()
    if (scope !== lastScope) counts.value = null
    lastScope = scope
    const id = ++requestId
    controller?.abort()
    controller = new AbortController()
    loading.value = true
    failed.value = false
    try {
      const result = await http.getWithSignal<AccountStatistics>(
        '/api/account-identities/statistics?' + scope, controller.signal,
      )
      if (id === requestId) counts.value = result
    } catch {
      if (id === requestId) {
        counts.value = null
        failed.value = true
      }
    } finally {
      if (id === requestId) loading.value = false
    }
  }

  onScopeDispose(() => {
    requestId++
    controller?.abort()
  })
  return { counts, loading, failed, refresh }
}
