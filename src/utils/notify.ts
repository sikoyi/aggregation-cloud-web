import { ElNotification } from 'element-plus'

import { ApiError } from '@/api/http'

interface ValidationErrorDetail {
  type?: unknown
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

function taskValidationMessage(detail: ValidationErrorDetail) {
  // 只识别请求体顶层的任务字段，避免误翻译脚本自定义参数中的同名字段。
  if (!Array.isArray(detail.loc) || detail.loc.length !== 2 || detail.loc[0] !== 'body') return ''
  const field = detail.loc[1]
  const type = String(detail.type || '')
  const message = String(detail.msg || '').trim()
  if (type === 'missing' || message === 'Field required') {
    const missingMessages: Record<string, string> = {
      template_id: '请选择任务模板',
      execution_mode: '请选择执行模式（立即执行或计划执行）',
      scheduled_at: '计划执行必须选择计划时间',
      slot_ids: '请至少选择一个执行设备',
      execution_count: '请填写每个目标执行次数',
      concurrent_registration_count: '请填写同时注册数量',
    }
    return typeof field === 'string' ? missingMessages[field] || '' : ''
  }
  if (field === 'execution_mode' && (type === 'literal_error' || /^Input should be /.test(message))) {
    return '执行模式无效，请选择“立即执行”或“计划执行”'
  }
  if (field === 'scheduled_at' && type.startsWith('datetime_')) {
    return '计划执行时间格式不正确，请重新选择'
  }
  if ((field === 'execution_count' || field === 'concurrent_registration_count')
    && ['int_type', 'int_parsing', 'int_from_float', 'greater_than_equal', 'less_than_equal', 'finite_number'].includes(type)) {
    return `${field === 'execution_count' ? '每个目标执行次数' : '同时注册数量'}必须为 1 至 1000 的整数`
  }
  return ''
}

function validationErrorMessage(err: ApiError) {
  if (err.code !== 42200 || !err.data || typeof err.data !== 'object') return ''
  const errors = (err.data as { errors?: unknown }).errors
  if (!Array.isArray(errors)) return ''

  const messages = errors
    .map((item) => {
      if (!item || typeof item !== 'object') return ''
      const detail = item as ValidationErrorDetail
      if (detail.ctx?.error) return cleanValidationMessage(detail.ctx.error)
      return taskValidationMessage(detail) || cleanValidationMessage(detail.msg)
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
