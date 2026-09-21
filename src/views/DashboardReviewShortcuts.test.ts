import { describe, expect, it } from 'vitest'
import dashboard from './DashboardView.vue?raw'
import reply from './CommentReplyReviewView.vue?raw'
import posts from '../components/BenchmarkPostReviews.vue?raw'
import warmup from './AccountWarmupView.vue?raw'

describe('dashboard review and warmup shortcuts', () => {
  it('routes review shortcuts to pending review and warmup to creation', () => {
    expect(dashboard).toContain("path: '/comment-replies', query: { status: 'pending_review' }")
    expect(dashboard).toContain("path: '/post-reviews', query: { status: 'pending_review' }")
    expect(dashboard).toContain("path: '/account-warmup', query: { action: 'create' }")
  })

  it('resets remembered review filters before loading pending records', () => {
    for (const review of [reply, posts]) {
      expect(review).toContain("route.query.status !== 'pending_review'")
      expect(review).toMatch(/Object.assign\(filters, createDefault\w+Filters\(\), \{ status: 'pending_review' \}\)/)
      expect(review).toContain('page.value = 1')
    }
  })

  it('permission-checks creation and consumes the action parameter', () => {
    expect(warmup).toContain("if (auth.can('account_warmup.create')) openCreate()")
    expect(warmup).toContain('delete query.action')
    expect(warmup).toContain('router.replace({ path: route.path, query })')
  })
})
