import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('dashboard review and warmup shortcuts', () => {
  it('routes review shortcuts to pending review and warmup to creation', () => {
    const dashboard = source('./DashboardView.vue')
    expect(dashboard).toContain("path: '/comment-replies', query: { status: 'pending_review' }")
    expect(dashboard).toContain("path: '/post-reviews', query: { status: 'pending_review' }")
    expect(dashboard).toContain("path: '/account-warmup', query: { action: 'create' }")
  })

  it('resets remembered review filters before loading pending records', () => {
    for (const path of ['./CommentReplyReviewView.vue', '../components/BenchmarkPostReviews.vue']) {
      const review = source(path)
      expect(review).toContain("route.query.status !== 'pending_review'")
      expect(review).toMatch(/Object.assign\(filters, createDefault\w+Filters\(\), \{ status: 'pending_review' \}\)/)
      expect(review).toContain('page.value = 1')
    }
  })

  it('permission-checks creation and consumes the action parameter', () => {
    const warmup = source('./AccountWarmupView.vue')
    expect(warmup).toContain("if (auth.can('account_warmup.create')) openCreate()")
    expect(warmup).toContain('delete query.action')
    expect(warmup).toContain('router.replace({ path: route.path, query })')
  })
})
