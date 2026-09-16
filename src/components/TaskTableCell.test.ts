import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it, vi } from 'vitest'

vi.mock('element-plus/es/components/tag/style/css', () => ({}))
vi.mock('element-plus/es/components/tooltip/style/css', () => ({}))
vi.mock('element-plus/es/components/base/style/css', () => ({}))

import TaskTableCell from './TaskTableCell.vue'

describe('子任务生成进度', () => {
  it.each([0, 100, 200])('显示已生成 %i，但不把生成数量当作成功数量', async (generated) => {
    const html = await renderToString(createSSRApp(TaskTableCell, {
      kind: 'taskResult', column: { key: 'child_succeeded', label: '执行结果' },
      row: { child_total: 200, child_generated: generated, child_succeeded: 0, child_failed: 0 },
    }))
    expect(html).toContain(`已生成 ${generated} / 200`)
    expect(html).toMatch(/成功 <strong[^>]*>0<\/strong>/)
  })

  it('旧任务没有生成进度字段时不显示错误的零进度', async () => {
    const html = await renderToString(createSSRApp(TaskTableCell, {
      kind: 'taskResult', column: { key: 'child_succeeded', label: '执行结果' },
      row: { child_total: 200, child_succeeded: 10 },
    }))
    expect(html).not.toContain('已生成')
  })
})
