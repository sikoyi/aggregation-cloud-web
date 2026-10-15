export function replyReviewFocus(value: unknown): string {
  return typeof value === 'string' && /^[1-9][0-9]{0,19}$/.test(value) ? value : ''
}
