export interface CommentReplyScheduleOptions {
  inherit: boolean
  times: string[]
  windows?: CommentReplyWindow[]
}

export interface CommentReplyWindow { start: string; end: string }

export function scheduleWindows(policy: { times?: string[]; windows?: CommentReplyWindow[] }): CommentReplyWindow[] {
  if (policy.windows) return policy.windows.map(window => ({ ...window }))
  return (policy.times || []).map(start => {
    const minute = (Number(start.slice(0, 2)) * 60 + Number(start.slice(3)) + 1) % 1440
    return { start, end: `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}` }
  })
}

export function validReplyWindows(windows: CommentReplyWindow[]) {
  if (!windows.length || windows.length > 24) return false
  const occupied = new Set<number>()
  for (const { start, end } of windows) {
    if (![start, end].every(value => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) || start === end) return false
    const first = Number(start.slice(0, 2)) * 60 + Number(start.slice(3))
    const last = Number(end.slice(0, 2)) * 60 + Number(end.slice(3))
    for (let minute = first; minute !== last; minute = (minute + 1) % 1440) {
      if (occupied.has(minute)) return false
      occupied.add(minute)
    }
  }
  return true
}

export interface CommentReplySchedulePolicy extends CommentReplyScheduleOptions {
  timezone: string
}
