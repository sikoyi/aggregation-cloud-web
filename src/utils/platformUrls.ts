const THREADS_POST_HOSTS = new Set([
  'threads.com',
  'www.threads.com',
  'threads.net',
  'www.threads.net',
])

const THREADS_USERNAME_PATTERN = /^@[A-Za-z0-9._]+$/
const THREADS_POST_ID_PATTERN = /^[A-Za-z0-9_-]+$/

export function normalizeThreadsPostUrl(value: unknown) {
  const rawValue = String(value || '').trim()
  let parsed: URL
  try {
    parsed = new URL(rawValue)
  } catch {
    throw new Error('请输入有效的 Threads 帖子链接')
  }

  const pathParts = parsed.pathname.split('/').filter(Boolean)
  const validPath = pathParts.length === 3
    && THREADS_USERNAME_PATTERN.test(pathParts[0])
    && pathParts[1].toLowerCase() === 'post'
    && THREADS_POST_ID_PATTERN.test(pathParts[2])
  if (
    !['http:', 'https:'].includes(parsed.protocol)
    || !THREADS_POST_HOSTS.has(parsed.hostname.toLowerCase())
    || parsed.port
    || parsed.username
    || parsed.password
    || !validPath
  ) {
    throw new Error('请输入 Threads 帖子链接，不能填写账号主页、短链接或其他平台链接')
  }

  return `${parsed.protocol}//${parsed.hostname.toLowerCase()}/${pathParts.join('/')}`
}
