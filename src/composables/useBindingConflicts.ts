import { onScopeDispose, ref, watch } from 'vue'

import { getBindingConflicts, type BindingConflict, type BindingConflictTarget } from '@/api/bindingConflicts'
import { getErrorMessage } from '@/utils/notify'

export function useBindingConflicts(target: () => BindingConflictTarget | null) {
  const rows = ref<BindingConflict[]>([])
  const loading = ref(false)
  const error = ref('')
  let controller: AbortController | undefined

  async function reload() {
    controller?.abort()
    const request = new AbortController()
    controller = request
    rows.value = []
    error.value = ''
    const current = target()
    loading.value = Boolean(current)
    if (!current) return
    try {
      const data = await getBindingConflicts(current, request.signal)
      if (request.signal.aborted) return
      rows.value = data.items
    } catch (err) {
      if (!request.signal.aborted) error.value = getErrorMessage(err, '绑定冲突加载失败')
    } finally {
      if (!request.signal.aborted) loading.value = false
    }
  }

  watch(() => [target()?.source, target()?.id], reload, { immediate: true })
  onScopeDispose(() => controller?.abort())
  return { rows, loading, error, reload }
}
