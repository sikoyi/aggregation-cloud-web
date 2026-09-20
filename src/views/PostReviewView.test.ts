import { describe, expect, it } from 'vitest'
import source from './PostReviewView.vue?raw'
import reply from './CommentReplyReviewView.vue?raw'
import routes from '@/router/index.ts?raw'
import shell from '@/layouts/AppShell.vue?raw'
import reviews from '@/components/BenchmarkPostReviews.vue?raw'

describe('运营中心独立帖子审核', () => {
  it('保留单条终态工单删除，复用软删除权限和接口', () => {
    expect(reviews).toContain("new Set(['succeeded', 'failed', 'canceled', 'expired', 'lost', 'ignored'])")
    expect(reviews).toContain('v-if="canManageReviews && deletableStatuses.has(row.status)"')
    expect(reviews).toContain('aria-label="删除记录"')
    expect(reviews).toContain('batchDeleteBenchmarkPostReviews([row.id])')
    expect(reviews).toContain('if (result.processed_count === 1)')
    expect(reviews).toContain('result.failures[0]?.message')
    expect(reviews).toContain('rows.value.length === 1 && page.value > 1')
  })
  it('筛选区与回复审核统一，并保留状态筛选与清空查询', () => {
    for (const markup of ['筛选条件', 'class="compact-filter-form"', 'class="filter-grid"', 'class="filter-actions"', 'label-position="right"', 'label-suffix=":"']) {
      expect(reviews).toContain(markup)
      expect(reply).toContain(markup)
    }
    expect(reviews).toContain('label="工单状态"')
    expect(reviews).toContain('@change="searchRows"')
    expect(reviews).toContain('@click="resetFilters"')
    expect(reviews).toContain('@click="searchRows"')
    expect(reviews).toContain("status.value = ''\n  searchRows()")
    expect(reviews).toContain('page.value = 1\n  void load()')
    expect(reviews).not.toContain('review-toolbar')
  })

  it('提供独立懒加载路由，并沿用运营查看权限', () => {
    expect(routes).toContain("const PostReviewView = () => import('@/views/PostReviewView.vue')")
    expect(routes).toContain("{ path: 'post-reviews', component: PostReviewView, meta: { permission: 'operations.view' } }")
    const operations = shell.split("label: '运营中心'")[1]?.split("label: '任务中心'")[0] || ''
    expect(operations).toContain("{ label: '帖子审核', to: '/post-reviews', icon: FileCheck2, permission: 'operations.view' }")
  })

  it('复用帖子工单，TG 绑定统一放在全局顶部栏', () => {
    expect(source).toContain('<h1>帖子审核</h1>')
    expect(source).toContain('<BenchmarkPostReviews />')
    expect(source).not.toContain('TelegramReviewBinding')
    expect(reply).not.toContain('TelegramReviewBinding')
    expect(shell).toContain('<ThemeToggle />')
    expect(shell).toContain('<TelegramReviewBinding />')
    expect(shell.indexOf('<TelegramReviewBinding />')).toBeLessThan(shell.indexOf('<ThemeToggle />'))
    expect(reply).not.toContain('BenchmarkPostReviews')
    expect(reply).not.toContain('reviewKind')
    expect(reply).toContain('<h1>回复审核</h1>')
  })

  it('保持现有审核权限、工单版本校验和发布接口', () => {
    expect(reviews).toContain("selected.value?.status === 'pending_review' && auth.can('operations.review')")
    expect(reviews).toContain('/api/benchmark-trackers/reviews')
    expect(reviews).toContain('revision: job.revision')
    expect(reviews).toContain("decide('approve')")
    expect(reviews).toContain("decide('ignore')")
  })

  it('仅允许有重试权限的用户重新发布失败工单，并明确保留旧任务', () => {
    expect(reviews).toContain("selected.value?.status === 'failed' && auth.can('operations.retry')")
    expect(reviews).toContain("row.status === 'failed' && auth.can('operations.retry')")
    expect(reviews).toContain('/retry`')
    expect(reviews).toContain('系统会创建新的发布任务，原失败任务仍会保留')
    expect(reviews).toContain('帖子发布已重新进入任务队列')
  })

  it('常驻展示批量批准、忽略和软删除操作，并保留单条失败重试', () => {
    expect(reviews).toContain('class="review-batch-bar"')
    expect(reviews).toContain('已选择 <strong>{{ selectedRows.length }}</strong> 条工单')
    expect(reviews).toContain('批量批准发布')
    expect(reviews).toContain('批量忽略')
    expect(reviews).toContain('批量删除记录')
    expect(reviews).toContain(':disabled="batchActionsDisabled"')
    expect(reviews).toContain('row-key="id"')
    expect(reviews).toContain('reserve-selection')
    expect(reviews).toContain('@selection-change="handleSelectionChange"')
    expect(reviews).toContain('batchApproveBenchmarkPostReviews')
    expect(reviews).toContain('batchIgnoreBenchmarkPostReviews')
    expect(reviews).toContain('batchDeleteBenchmarkPostReviews')
    expect(reviews).toContain('发布任务、帖子映射和操作审计仍会保留')
    expect(reviews).not.toContain('batchRetryBenchmarkPostReviews')
  })
})
