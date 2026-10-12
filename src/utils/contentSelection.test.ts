import { describe, expect, it } from 'vitest'
import { canRetrySelection, safeSelectionLink, selectionIsVideo, selectionStatus } from './contentSelection'

describe('selection publication boundaries', () => {
  it('separates temporary collection delays from actionable failures', () => {
    expect(selectionStatus.retrying).toBe('采集暂缓')
    expect(selectionStatus.attention).toBe('需要处理')
    expect(selectionStatus.collecting).toBe('采集中')
  })
  it.each(['queued', 'running', 'dispatching', 'succeeded', 'completed', 'waiting_runtime'])('does not retry %s', status => {
    expect(canRetrySelection(status)).toBe(false)
  })
  it.each(['failed', 'expired', 'lost', 'canceled'])('retries %s from the same order', status => {
    expect(canRetrySelection(status)).toBe(true)
  })
  it('rejects unsafe source links', () => {
    expect(safeSelectionLink('javascript:alert(1)')).toBe('')
    expect(safeSelectionLink('data:text/html,bad')).toBe('')
    expect(safeSelectionLink('https://x.com/demo')).toBe('https://x.com/demo')
  })
  it('recognizes signed video URLs without mistaking thumbnails for video', () => {
    expect(selectionIsVideo('https://video.twimg.com/a.mp4?token=x')).toBe(true)
    expect(selectionIsVideo('https://pbs.twimg.com/a.jpg?video=1')).toBe(false)
  })
})
