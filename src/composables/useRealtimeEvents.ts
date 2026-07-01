import { http } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import type { ApiResponse } from '@/types/api'

export const REALTIME_EVENT_NAME = 'aggregation:realtime'

export interface RealtimeEventPayload {
  type: string
  topic: string
  resource_type: string
  resource_id?: string | null
  tenant_id?: string
  occurred_at?: string
  data?: unknown
}

let source: EventSource | null = null
let currentToken = ''

function buildStreamUrl(token: string) {
  const url = new URL('/api/events/stream', http.apiBaseUrl)
  url.searchParams.set('token', token)
  url.searchParams.set('topics', 'task,runtime,conversation')
  return url.toString()
}

function emitRealtimeEvent(payload: RealtimeEventPayload) {
  window.dispatchEvent(new CustomEvent<RealtimeEventPayload>(REALTIME_EVENT_NAME, { detail: payload }))
}

function parseSseMessage(event: MessageEvent<string>) {
  const wrapper = JSON.parse(event.data) as ApiResponse<RealtimeEventPayload>
  if (wrapper?.code === 0 && wrapper.data) emitRealtimeEvent(wrapper.data)
}

export function useRealtimeEvents() {
  const auth = useAuthStore()

  function connect() {
    if (!auth.token) return
    if (source && currentToken === auth.token) return
    disconnect()
    currentToken = auth.token
    source = new EventSource(buildStreamUrl(auth.token))
    source.addEventListener('realtime', (event) => {
      try {
        parseSseMessage(event as MessageEvent<string>)
      } catch {
        // 单条实时事件解析失败不影响长连接，下一条事件继续处理。
      }
    })
    source.onerror = () => {
      if (!auth.token) disconnect()
    }
  }

  function disconnect() {
    if (source) source.close()
    source = null
    currentToken = ''
  }

  return {
    connect,
    disconnect,
  }
}
