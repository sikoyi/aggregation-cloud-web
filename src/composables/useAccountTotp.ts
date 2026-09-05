import { computed, onScopeDispose, ref, watch } from 'vue'

import { getAccountTotp, type AccountTotpCode, type TotpSource } from '@/api/accountTotp'
import { ApiError } from '@/api/http'

const activeViewer = ref<symbol | null>(null)

export function useAccountTotp(
  target: () => { source: TotpSource; id: string; revision?: unknown },
  now: () => number = () => performance.now(),
) {
  const viewer = Symbol('account-totp')
  const visible = computed(() => activeViewer.value === viewer)
  const loading = ref(false)
  const error = ref('')
  const value = ref<AccountTotpCode | null>(null)
  const remainingMs = ref(0)
  const seconds = computed(() => Math.ceil(remainingMs.value / 1000))
  const code = computed(() => remainingMs.value > 0 ? value.value?.code || '' : '')
  const suspended = ref(false)
  let timer: ReturnType<typeof setInterval> | undefined
  let timeout: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | undefined
  let generation = 0
  let deadline = 0

  function clear() {
    generation += 1
    controller?.abort()
    controller = undefined
    clearTimeout(timeout)
    clearInterval(timer)
    timeout = undefined
    timer = undefined
    loading.value = false
    value.value = null
    remainingMs.value = 0
    error.value = ''
  }

  async function refresh() {
    if (!visible.value || suspended.value || loading.value) return
    clearInterval(timer)
    value.value = null
    remainingMs.value = 0
    error.value = ''
    loading.value = true
    const requestId = ++generation
    const started = now()
    controller = new AbortController()
    timeout = setTimeout(() => controller?.abort(), 10000)
    try {
      const { source, id } = target()
      const result = await getAccountTotp(source, id, controller.signal)
      if (requestId !== generation || !visible.value) return
      // 扣除整个请求耗时，宁可提前刷新，也不延长服务端有效期。
      const remaining = (result.expires_at - result.server_time) * 1000 - (now() - started)
      if (!/^\d{6}$/.test(result.code) || result.period !== 30 || !Number.isFinite(remaining)
        || remaining <= 0 || remaining > 30000) {
        error.value = '验证码已过期或响应异常，请重新获取'
        return
      }
      value.value = result
      deadline = now() + remaining
      remainingMs.value = remaining
      timer = setInterval(tick, 250)
    } catch (reason) {
      if (requestId !== generation || !visible.value) return
      error.value = reason instanceof ApiError ? reason.message : '获取验证码失败，请检查网络后重试'
    } finally {
      if (requestId === generation) {
        clearTimeout(timeout)
        loading.value = false
      }
    }
  }

  function tick() {
    remainingMs.value = Math.max(0, deadline - now())
    if (remainingMs.value === 0) void refresh()
  }

  function setVisible(open: boolean) {
    if (open) activeViewer.value = viewer
    else if (visible.value) activeViewer.value = null
  }

  function setSuspended(hidden: boolean) {
    suspended.value = hidden
    if (!visible.value) return
    clear()
    if (!hidden) void refresh()
  }

  async function copy() {
    if (!visible.value || suspended.value || !value.value || deadline - now() <= 0) return false
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
    await navigator.clipboard.writeText(value.value.code)
    return true
  }

  watch(visible, (open) => {
    clear()
    if (open) void refresh()
  }, { flush: 'sync' })
  watch(() => [target().source, target().id, target().revision], () => setVisible(false))
  onScopeDispose(() => {
    setVisible(false)
    clear()
  })
  return { visible, loading, error, code, seconds, setVisible, setSuspended, refresh, copy }
}
