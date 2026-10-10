import { describe, expect, it, vi } from 'vitest'
import source from './BenchmarkPostReviews.vue?raw'

describe('post review deep link', () => {
  it('opens the exact ticket without requiring it on the filtered page', () => {
    const start = source.indexOf('watch(() => route.query.review_id')
    const end = source.indexOf('onMounted(', start)
    const open = vi.fn()
    let changed: (id: unknown) => void = () => {}
    new Function('watch', 'route', 'open', source.slice(start, end))(
      (_get: unknown, callback: typeof changed, options: { immediate: boolean }) => {
        changed = callback
        expect(options.immediate).toBe(true)
      }, { query: {} }, open,
    )
    changed(' review-id ')
    expect(open).toHaveBeenCalledWith({ id: 'review-id' })
    changed(undefined)
    changed(['ambiguous', 'id'])
    expect(open).toHaveBeenCalledTimes(1)
  })
})
