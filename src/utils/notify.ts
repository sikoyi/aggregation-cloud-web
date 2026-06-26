import { ElNotification } from 'element-plus'

export function getErrorMessage(err: unknown, fallback = '操作失败') {
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
