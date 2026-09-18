import { describe, expect, it } from 'vitest'

import source from './CommentReplyReviewView.vue?raw'

describe('回复审核筛选区', () => {
  it('沿用系统统一的筛选标题、字段标签和操作顺序', () => {
    expect(source).toContain('<div class="filter-title">')
    expect(source).toContain('<span>筛选条件</span>')
    expect(source).toContain('<el-form inline label-position="right" label-suffix=":" class="compact-filter-form">')
    expect(source).toContain('<el-form-item label="业务平台">')
    expect(source).toContain('<el-form-item label="监听账号">')
    expect(source).toContain('<el-form-item label="账号标签">')
    expect(source).toContain('<el-form-item label="回复模式">')
    expect(source).toContain('<el-form-item label="工单状态">')
    expect(source).toContain('<el-form-item label="发现时间" class="filter-grid__item--wide">')
    expect(source).toContain('<el-form-item label="关键词">')

    const clearPosition = source.indexOf('>清空</el-button>')
    const searchPosition = source.indexOf('>查询</el-button>')
    expect(clearPosition).toBeGreaterThan(-1)
    expect(searchPosition).toBeGreaterThan(clearPosition)
  })

  it('使用与资源列表一致的响应式筛选栅格', () => {
    expect(source).toContain('grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))')
    expect(source).toContain('.filter-grid :deep(.filter-grid__item--wide)')
    expect(source).toContain('@media (max-width: 768px)')
  })

  it('从工单进入关联执行任务详情', () => {
    expect(source).toContain("import TaskDetailDrawer from '@/components/TaskDetailDrawer.vue'")
    expect(source).toContain("function canViewTaskDetail(row: AnyRecord | null)")
    expect(source).toContain("auth.isSuperAdmin || String(row.reviewed_by || '') === String(auth.user?.id || '')")
    expect(source).toContain('v-if="canViewTaskDetail(row)"')
    expect(source).toContain('>执行详情</el-button>')
    expect(source).toContain('<TaskDetailDrawer v-model="taskDetailVisible" :task-id="taskDetailId" />')
  })

  it('常驻展示批量审核、忽略和软删除操作，并保持表格选择一致', () => {
    expect(source).toContain('class="reply-review__batch-bar"')
    expect(source).toContain('已选择 <strong>{{ selectedRows.length }}</strong> 条工单')
    expect(source).toContain('批量审核通过')
    expect(source).toContain('批量忽略')
    expect(source).toContain('批量删除记录')
    expect(source).toContain(':disabled="batchActionsDisabled"')
    expect(source).toContain('row-key="id"')
    expect(source).toContain('reserve-selection')
    expect(source).toContain('@selection-change="handleSelectionChange"')
    expect(source).toContain("batchApproveCommentReplies")
    expect(source).toContain("batchIgnoreCommentReplies")
    expect(source).toContain("batchDeleteCommentReplies")
    expect(source).toContain('底层执行任务、审计和评论去重依据仍会保留')
  })

  it('弹窗顶部信息卡统一拉伸为同一高度', () => {
    expect(source).toContain('.review-dialog__meta { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: stretch; gap: 10px; }')
  })
})
