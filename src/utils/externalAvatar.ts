import { resolveBackendUrl } from '@/api/http'

export function externalAvatarUrl(value: unknown): string {
  const raw = String(value || '').trim()
  if (raw.startsWith('/media/') && !raw.includes('\\') && !raw.includes('..')) {
    return resolveBackendUrl(raw)
  }
  try {
    const url = new URL(raw)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''
  } catch {
    return ''
  }
}
