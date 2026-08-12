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

let controller: AbortController | null = null
let currentToken = ''

function buildStreamUrl() {
  const url = new URL('/api/events/stream', http.apiBaseUrl)
  url.searchParams.set('topics', 'task,runtime,account,conversation,content_monitor,comment_reply,system_notification')
  return url.toString()
}

function emitRealtimeEvent(payload: RealtimeEventPayload) {
  window.dispatchEvent(new CustomEvent<RealtimeEventPayload>(REALTIME_EVENT_NAME, { detail: payload }))
}

function parseSseData(data: string) {
  const wrapper = JSON.parse(data) as ApiResponse<RealtimeEventPayload>
  if (wrapper?.code === 0 && wrapper.data) emitRealtimeEvent(wrapper.data)
}

function consumeEventBlock(block: string) {
  const lines = block.split(/\r?\n/)
  const eventName = lines
    .find((line) => line.startsWith('event:'))
    ?.slice('event:'.length)
    .trim()
  if (!['realtime', 'connected'].includes(eventName || '')) return

  const data = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trimStart())
    .join('\n')
  if (!data) return

  try {
    parseSseData(data)
  } catch {
    // 单条事件解析失败不影响后续实时消息。
  }
}

async function waitBeforeReconnect(signal: AbortSignal) {
  await new Promise<void>((resolve) => {
    const timer = window.setTimeout(resolve, 3000)
    signal.addEventListener('abort', () => {
      window.clearTimeout(timer)
      resolve()
    }, { once: true })
  })
}

async function runStream(token: string, signal: AbortSignal) {
  while (!signal.aborted && currentToken === token) {
    try {
      const response = await fetch(buildStreamUrl(), {
        headers: {
          Accept: 'text/event-stream',
          Authorization: `Bearer ${token}`,
        },
        signal,
      })
      if (response.status === 401) return
      if (!response.ok || !response.body) throw new Error(`SSE connection failed: ${response.status}`)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (!signal.aborted) {
        const { done, value } = await reader.read()
        buffer += decoder.decode(value, { stream: !done })
        const blocks = buffer.split(/\r?\n\r?\n/)
        buffer = blocks.pop() || ''
        blocks.forEach(consumeEventBlock)
        if (done) break
      }
    } catch {
      if (signal.aborted) return
    }

    if (!signal.aborted && currentToken === token) {
      await waitBeforeReconnect(signal)
    }
  }
}

export function useRealtimeEvents() {
  const auth = useAuthStore()

  function connect() {
    if (!auth.token) return
    if (controller && currentToken === auth.token) return
    disconnect()
    currentToken = auth.token
    controller = new AbortController()
    void runStream(auth.token, controller.signal)
  }

  function disconnect() {
    controller?.abort()
    controller = null
    currentToken = ''
  }

  return {
    connect,
    disconnect,
  }
}
