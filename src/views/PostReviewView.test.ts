import { describe, expect, it } from 'vitest'
import source from './PostReviewView.vue?raw'
import reply from './CommentReplyReviewView.vue?raw'
import routes from '@/router/index.ts?raw'
import shell from '@/layouts/AppShell.vue?raw'
import reviews from '@/components/BenchmarkPostReviews.vue?raw'
import mediaPreview from '@/components/ReviewMediaPreview.vue?raw'

describe('运营中心独立帖子审核', () => {
  it('详情显示真实工单编号并提供复制及失败提示', () => {
    expect(reviews).toContain('<code>{{ selected.id }}</code>')
    expect(reviews).toContain('navigator.clipboard.writeText(selected.value.id)')
    expect(reviews).toContain('复制失败，请手动选择工单 ID')
  })
  it('原帖与发布稿共享图片视频预览，失败保留安全链接', () => {
    expect(reviews.match(/<ReviewMediaPreview /g)).toHaveLength(2)
    expect(mediaPreview).toContain('new URL(safeUrl.value).pathname')
    expect(mediaPreview).toContain('controls playsinline preload="metadata"')
    expect(mediaPreview).toContain(':preview-src-list="[safeUrl]"')
    expect(mediaPreview).toContain('媒体加载失败')
    expect(mediaPreview).toContain('!url.username && !url.password')
    expect(mediaPreview).toContain('rel="noopener noreferrer"')
    expect(mediaPreview).toContain('failed.value = false')
  })
  it('重新缩写显示实际等待时间并清理计时器，不模拟处理阶段', () => {
    expect(reviews).toContain('Date.now() - startedAt')
    expect(reviews).toContain('AI 处理中 · 已等待 {{ regenerationElapsed }} 秒')
    expect(reviews).toContain('if (regenerationTimer) clearInterval(regenerationTimer)')
    expect(reviews).toContain('regenerationTimer = undefined')
  })
  it('重新缩写使用标准尺寸浅色主按钮，与批准发布区分', () => {
    expect(reviews).toContain('class="review-regenerate-button" type="primary" plain size="default" :icon="Sparkles"')
    expect(reviews).toContain('.review-regenerate-button { font-weight: 600; }')
  })
  it('重新缩写从原帖生成并仅替换正文，保留图片选择', () => {
    expect(reviews).toContain('AI 重新缩写')
    expect(reviews).toContain("selected.value?.business_platform === 'x'")
    expect(reviews).not.toContain('Boolean(selected.value.system_processing?.ai_shortening)')
    const implementation = reviews.split('async function regenerateContent()')[1]!.split('function handleSelectionChange')[0]!
    expect(implementation).toContain('/regenerate`')
    expect(implementation).toContain('revision: job.revision')
    expect(implementation).toContain('content.value = result.final_content')
    expect(implementation).not.toContain('mediaUrls.value =')
    expect(implementation).not.toContain('/approve')
  })
  it('历史工单无需缩写标记即可重试，保留编辑权限、平台及原文限制', () => {
    const expression = reviews.split('const canRegenerate = computed(() => ')[1]!.split('\nconst canManageReviews')[0]!.trim().slice(0, -1)
    const canRegenerate = new Function('editable', 'selected', `return ${expression}`)
    const legacyJob = { business_platform: 'x', snapshot: { text_content: 'original text' } }
    expect(canRegenerate({ value: true }, { value: legacyJob })).toBe(true)
    expect(canRegenerate({ value: true }, { value: { ...legacyJob, system_processing: { ai_shortening: 'failed' } } })).toBe(true)
    expect(canRegenerate({ value: true }, { value: { ...legacyJob, system_processing: { ai_shortening: 'succeeded' } } })).toBe(true)
    expect(canRegenerate({ value: false }, { value: legacyJob })).toBe(false)
    expect(canRegenerate({ value: true }, { value: { ...legacyJob, business_platform: 'threads' } })).toBe(false)
    expect(canRegenerate({ value: true }, { value: { ...legacyJob, snapshot: { text_content: '  ' } } })).toBe(false)
    expect(canRegenerate({ value: false }, { value: null })).toBe(false)
  })
  it('固定对照原帖与发布稿，只读查看也保留原帖图片', () => {
    expect(reviews).toContain('class="review-comparison"')
    expect(reviews).toContain('aria-label="原帖内容"')
    expect(reviews).toContain('aria-label="发布稿"')
    expect(reviews).toContain('id="benchmark-original-content"')
    expect(reviews).not.toContain('editable && originalMediaChanged')
    expect(reviews).toContain('processingFor(row)')
    expect(reviews).toContain('grid-template-columns: minmax(0, 1fr);')
  })
  it('待审核列表和详情显示 X 缩写失败原因，不把原因混入发布正文', () => {
    expect(reviews).toContain("row.status === 'pending_review' && row.review_reason")
    expect(reviews).toContain('selected.review_reason')
    expect(reviews).toContain(':title="selected.review_reason"')
    expect(reviews).toContain('class="review-reason"')
  })
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
