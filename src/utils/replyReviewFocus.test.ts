import { describe, expect, it } from 'vitest'
import { replyReviewFocus } from './replyReviewFocus'

describe('回复工单链接', () => {
  it('接受精确工单编号，不经数值转换丢失精度', () => {
    expect(replyReviewFocus('737')).toBe('737')
    expect(replyReviewFocus('9007199254740993')).toBe('9007199254740993')
  })
  it.each([undefined, null, ['737'], '', '0', '-1', '1.5', '737&status=failed', ' 737', '1'.repeat(21)])('拒绝非法编号 %s', value => {
    expect(replyReviewFocus(value)).toBe('')
  })
})
