import { resolveBackendUrl } from '@/api/http'

export function selectionDisplayText(post: { text_body: string; business_platform: string; media: string[]; media_type?: string }) {
  if (post.business_platform !== 'x') return post.text_body
  const media = new Set(post.media)
  let text = post.text_body.replace(/https?:\/\/[^\s]+/gi, url => media.has(url) ? '' : url)
  if (media.size || ['image', 'video'].includes(post.media_type || '')) {
    text = text.replace(/(?:[ \t]*https?:\/\/t\.co\/[A-Za-z0-9]+[ \t]*)+$/i, '')
  }
  return text.replace(/[ \t]+\n/g, '\n').trim()
}

export const selectionStatus: Record<string, string> = {
  pending: '等待采集', collecting: '采集中', active: '增量监听', retrying: '采集暂缓', attention: '需要处理', paused: '已暂停',
  queued: '等待发布', waiting_slot: '等待设备', waiting_runtime: '等待执行', dispatching: '下发中',
  running: '发布中', retry_wait: '等待重试', rate_limited: '等待发布', succeeded: '发布成功', completed: '已完成',
  failed: '发布失败', all_failed: '发布失败', expired: '已超时', lost: '执行失联', canceled: '已取消',
}
export function canRetrySelection(status: string) {
  return ['failed', 'all_failed', 'expired', 'lost', 'canceled'].includes(status)
}
export function safeSelectionLink(value: string | undefined) {
  try { const url = new URL(resolveBackendUrl(value || '')); return ['http:', 'https:'].includes(url.protocol) ? url.href : '' } catch { return '' }
}
export function selectionIsVideo(value: string) {
  try { return /\.(mp4|mov|webm|m4v)$/i.test(new URL(value, 'https://localhost').pathname) } catch { return false }
}
