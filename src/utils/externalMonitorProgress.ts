export interface ExternalCollectionProgress {
  phase?: string | null
  posts_collected?: number | null
  comments_completed?: number | null
  comments_total?: number | null
  last_progress_at?: string | null
}

export function externalMonitorStatus(monitor: { status: string; activity_status?: string }) {
  const labels: Record<string, string> = {
    pending: '等待调度', waiting: '等待调度', collecting: '采集中',
    active: '监听中', retrying: '等待重试', paused: '已暂停',
  }
  return labels[monitor.activity_status || monitor.status] || monitor.status
}

export function externalMonitorProgress(progress?: ExternalCollectionProgress) {
  if (!progress?.phase) return ''
  if (progress.phase === 'profile') return '账号资料'
  if (progress.phase === 'posts') return progress.posts_collected == null ? '帖子采集' : `帖子已采集 ${progress.posts_collected} 条`
  if (progress.phase === 'comments') return `评论采集 ${progress.comments_completed ?? 0} / ${progress.comments_total ?? 0} 帖`
  return ''
}
