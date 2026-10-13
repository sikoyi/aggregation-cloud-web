import { onScopeDispose, ref, watch } from 'vue'
import { getPendingPostReviewCount, POST_REVIEW_REFRESH_EVENT } from '@/api/benchmarkPostReviews'

export function usePendingPostReviewCount(sessionKey: () => string) {
  const count = ref(0)
  let disposed = false
  let controller: AbortController | undefined
  let refreshAgain = false

  async function refresh() {
    const key = sessionKey()
    if (disposed || !key || document.hidden) return
    if (controller) {
      refreshAgain = true
      return
    }
    const current = new AbortController()
    controller = current
    const timeout = setTimeout(() => current.abort(), 15_000)
    try {
      const total = await getPendingPostReviewCount(current.signal)
      if (!disposed && !current.signal.aborted && key === sessionKey() && Number.isFinite(total)) {
        count.value = Math.max(0, Math.floor(total))
      }
    } catch {
      // A menu hint must not interrupt reviewing; keep the last known count and retry later.
    } finally {
      clearTimeout(timeout)
      if (controller === current) {
        controller = undefined
        if (refreshAgain) {
          refreshAgain = false
          void refresh()
        }
      }
    }
  }

  watch(sessionKey, () => {
    controller?.abort()
    controller = undefined
    refreshAgain = false
    count.value = 0
    void refresh()
  }, { immediate: true, flush: 'sync' })

  const requestRefresh = () => { void refresh() }
  const timer = setInterval(requestRefresh, 30_000)
  window.addEventListener(POST_REVIEW_REFRESH_EVENT, requestRefresh)
  document.addEventListener('visibilitychange', requestRefresh)
  onScopeDispose(() => {
    disposed = true
    controller?.abort()
    clearInterval(timer)
    window.removeEventListener(POST_REVIEW_REFRESH_EVENT, requestRefresh)
    document.removeEventListener('visibilitychange', requestRefresh)
  })
  return { count }
}
