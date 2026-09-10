import { computed, onScopeDispose, ref, watch } from 'vue'
import { http } from '@/api/http'
import type { TotpSource } from '@/api/accountTotp'

interface CredentialResult { id: string; password_secret_ref: string | null; totp_secret_ref: string | null }

export function useAccountCredentialReveal(context: () => {
  source: TotpSource; id: string; actorId: string; allowed: boolean; revision?: unknown
}) {
  const visible = ref(false)
  const adminPassword = ref('')
  const loading = ref(false)
  const error = ref('')
  const credentials = ref<CredentialResult | null>(null)
  const allowed = computed(() => context().allowed && Boolean(context().id))
  let generation = 0
  let controller: AbortController | undefined

  function clear() {
    generation += 1
    controller?.abort()
    controller = undefined
    adminPassword.value = ''
    credentials.value = null
    error.value = ''
    loading.value = false
  }
  function close() { visible.value = false; clear() }
  function open() { clear(); visible.value = allowed.value }

  async function reveal() {
    if (!visible.value || !allowed.value || loading.value || !adminPassword.value) return
    const current = ++generation
    const { source, id } = context()
    controller = new AbortController()
    const password = adminPassword.value
    adminPassword.value = ''
    credentials.value = null
    error.value = ''
    loading.value = true
    try {
      const result = await http.postWithSignal<CredentialResult>(
        `/api/${source}/${encodeURIComponent(id)}/credentials/reveal`,
        { admin_password: password }, controller.signal,
      )
      if (current !== generation || !visible.value || !allowed.value) return
      if (result.id !== id) throw new Error('账号信息已变化，请重新查看')
      credentials.value = result
    } catch (err) {
      if (current === generation) error.value = err instanceof Error ? err.message : '验证失败，请重试'
    } finally {
      if (current === generation) loading.value = false
    }
  }

  watch(() => {
    const c = context()
    return [c.source, c.id, c.actorId, c.allowed, c.revision]
  }, close, { flush: 'sync' })
  onScopeDispose(close)
  return { visible, adminPassword, loading, error, credentials, allowed, open, close, reveal }
}
