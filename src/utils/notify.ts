import { ElNotification } from 'element-plus'

import { ApiError } from '@/api/http'

interface ValidationErrorDetail {
  loc?: unknown[]
  msg?: unknown
  ctx?: {
    error?: unknown
  }
}

function cleanValidationMessage(value: unknown) {
  const message = String(value || '').trim().replace(/^Value error,\s*/i, '')
  if (/^Field required$/i.test(message)) return '缺少必填内容'
  return message
}

function validationErrorMessage(err: ApiError) {
  if (err.code !== 42200 || !err.data || typeof err.data !== 'object') return ''
  const errors = (err.data as { errors?: unknown }).errors
  if (!Array.isArray(errors)) return ''

  const messages = errors
    .map((item) => {
      if (!item || typeof item !== 'object') return ''
      const detail = item as ValidationErrorDetail
      return cleanValidationMessage(detail.ctx?.error || detail.msg)
    })
    .filter(Boolean)

  return [...new Set(messages)].join('；')
}

export function getErrorMessage(err: unknown, fallback = '操作失败') {
  if (err instanceof ApiError) {
    const validationMessage = validationErrorMessage(err)
    if (validationMessage) return validationMessage
  }
  return err instanceof Error ? err.message : fallback
}

export function notifyError(err: unknown, title = '操作失败', fallback = title) {
  const message = getErrorMessage(err, fallback)
  ElNotification({
    title,
    message,
    type: 'error',
    duration: 5000,
  })
  return message
}
