import { describe, expect, it } from 'vitest'
import source from './BenchmarkExecutionHistory.vue?raw'
import review from './BenchmarkPostReviews.vue?raw'


describe('帖子执行归档入口', () => {
  it('shows the original task and every attempt inside the same review', () => {
    expect(review).toContain('<BenchmarkExecutionHistory :review-id="selected.id" :task-id="selected.task_run_id" />')
    expect(source).toContain('首次任务 #{{ history.root_task_id }}')
    expect(source).toContain(':data="history.items"')
    expect(source).toContain('/executions`')
  })
  it('opens the selected attempt, keeps permissions and rejects stale responses', () => {
    expect(source).toContain("auth.can('tasks.view')")
    expect(source).toContain('@click="open(row.id)"')
    expect(source).toContain(':task-id="detailId"')
    expect(source).toContain('if (id === request) history.value = result')
    expect(source).toContain('props.reviewId, props.taskId')
    expect(source).toContain('执行记录加载失败')
  })
})
