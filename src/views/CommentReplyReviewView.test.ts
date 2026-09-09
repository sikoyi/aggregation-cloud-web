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
})
