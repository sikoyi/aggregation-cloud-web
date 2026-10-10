import { expect, it } from 'vitest'
import posts from './BenchmarkPostReviews.vue?raw'
import comments from '../views/CommentReplyReviewView.vue?raw'

it('keeps continuous review opt-out and uses each workflow own filters', () => {
  for (const source of [posts, comments]) {
    expect(source).toContain('const continueReview = ref(true)')
    expect(source).toContain('审核后查看下一条')
    expect(source).toContain('findNextReview(')
    expect(source).toContain('scope === JSON.stringify(filters)')
  }
  expect(posts).toContain('buildPostReviewQuery(filters, nextPage)')
  expect(comments).toContain('buildCommentReplyQuery(filters, nextPage, pageSize.value)')
})

it('places concrete failures with permission-gated actions without guessing error categories', () => {
  expect(posts).toContain('v-if="selected.review_reason"')
  expect(posts).toContain("selected.system_processing?.translation_check === 'failed'")
  expect(posts).toContain("selected.system_processing?.ai_shortening === 'failed'")
  expect(comments).toContain("['failed', 'blocked'].includes(String(activeJob.status)) && canRetryReviews")
  expect(comments).toContain('查看执行详情')
})

it('filters preparation results and exposes retry only for failures', () => {
  expect(posts).toContain(':data="filteredPreparationResults"')
  expect(posts).toContain('retryFailedPreparations(preparationJobs.value')
  expect(posts).toContain('仅重试失败项')
})
