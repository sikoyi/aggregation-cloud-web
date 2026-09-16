import { onScopeDispose, ref, watch } from 'vue'

import { ApiError, http } from '@/api/http'
import { isBenchmarkCollecting, type BenchmarkCollectionTracker } from '@/utils/benchmarkCollection'

export function useBenchmarkCollection(accountId: () => string, visible: () => boolean) {
  const tracker = ref<BenchmarkCollectionTracker | null>(null)
  const loading = ref(false)
  const error = ref('')
  let version = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  async function refresh() {
    if (!visible() || !accountId() || loading.value) return false
    clearTimeout(timer)
    const requestVersion = version
    const id = accountId()
    loading.value = true
    try {
      const data = await http.get<BenchmarkCollectionTracker>(`/api/benchmark-trackers/accounts/${encodeURIComponent(id)}`)
      if (requestVersion !== version) return false
      tracker.value = data
      error.value = ''
      return true
    } catch (err) {
      if (requestVersion !== version) return false
      if (err instanceof ApiError && err.status === 404) {
        tracker.value = null
        error.value = ''
      } else {
        error.value = err instanceof Error ? err.message : '读取采集状态失败'
      }
      return false
    } finally {
      if (requestVersion === version) {
        loading.value = false
        if (visible() && (isBenchmarkCollecting(tracker.value) || error.value)) {
          timer = setTimeout(() => { void refresh() }, 5000)
        }
      }
    }
  }

  watch([accountId, visible], () => {
    version += 1
    clearTimeout(timer)
    loading.value = false
    tracker.value = null
    error.value = ''
    void refresh()
  }, { immediate: true, flush: 'sync' })
  onScopeDispose(() => {
    version += 1
    clearTimeout(timer)
  })
  return { tracker, loading, error, refresh }
}
