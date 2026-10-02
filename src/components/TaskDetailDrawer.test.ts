import { computed, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { transpile } from 'typescript'
import { isTaskGroup, taskResultAlertType } from '../utils/taskResultCounts'

import source from './TaskDetailDrawer.vue?raw'

function detailState() {
  const script = source.slice(source.indexOf('const resultDescription'), source.indexOf('const detailTitle'))
  const task = ref<Record<string, any> | null>(null)
  const children = ref<Record<string, any>[]>([])
  const state = new Function('computed', 'task', 'children', 'isTaskGroup', 'taskResultAlertType',
    `${transpile(script)}; return {resultDescription, isSingleExecution, executionRows, showChildAccountColumn};`)(
    computed, task, children, isTaskGroup, taskResultAlertType)
  return { ...state, task, children }
}

describe('任务详情执行结果', () => {
  it('执行结果提示由任务状态决定，不固定显示成功', () => {
    expect(source).toContain('const resultType = computed(() => taskResultAlertType(task.value?.status))')
    expect(source).toContain(':type="resultType"')
    expect(source).not.toContain('type="success"')
  })

  it('设备执行记录按关联账号动态展示账号信息', () => {
    expect(source).toContain('const showChildAccountColumn = computed')
    expect(source).toContain('v-if="showChildAccountColumn"')
    expect(source).toContain('accountPrimaryLabel(row)')
    expect(source).toContain('accountSecondaryLabel(row)')
    expect(source).toContain('账号 ID')
  })

  it.each(['benchmark_content_publish', 'account_profile_sync', 'comment_reply_task'])('自动任务 %s 展示自身设备记录', task_type => {
    const state = detailState()
    const row = { id: '121413', task_type, slot_id: 's', slot_name: 'B-22', provider_slot_id: 'provider-22',
      account_id: 'a', status: 'failed', error_message: '环境加锁，打开环境失败', child_total: 0 }
    state.task.value = row
    expect(state.executionRows.value).toEqual([row])
    expect(state.showChildAccountColumn.value).toBe(true)
    expect(state.resultDescription.value).toBe(row.error_message)
    expect(state.isSingleExecution.value).toBe(true)
  })

  it.each(['template_batch', 'interaction_session', 'publish_content_batch', 'account_registration_batch', 'account_warmup_batch'])('空批量任务 %s 不伪造设备执行记录', task_type => {
    const state = detailState()
    state.task.value = { id: 'parent', task_type, child_total: 0 }
    expect(state.isSingleExecution.value).toBe(false)
    expect(state.executionRows.value).toEqual([])
    state.children.value = [{ id: 'child', slot_name: 'B-22' }]
    expect(state.executionRows.value).toEqual(state.children.value)
  })

  it('子任务展示自身，切换父任务仍使用分页子记录', () => {
    const state = detailState()
    state.task.value = { id: 'child', parent_task_run_id: 'parent', child_total: 0 }
    expect(state.executionRows.value).toEqual([state.task.value])
    state.task.value = { id: 'parent', task_type: 'future_batch', child_total: 3 }
    state.children.value = [{ id: 'child-2' }]
    expect(state.executionRows.value).toEqual([{ id: 'child-2' }])
    state.task.value = null
    state.children.value = []
    expect(state.executionRows.value).toEqual([])
  })

  it('查看自身跳到时间线，不重复压入历史或请求自身', () => {
    const script = source.slice(source.indexOf('function openChildDetail'), source.indexOf('function backToPreviousTask'))
    const currentTaskId = ref('self'), taskHistory = ref<string[]>([]), activeTab = ref('children'), loadDetail = vi.fn()
    const open = new Function('currentTaskId', 'taskHistory', 'activeTab', 'loadDetail',
      `${transpile(script)}; return openChildDetail;`)(currentTaskId, taskHistory, activeTab, loadDetail)
    open({ id: 'self' })
    expect(activeTab.value).toBe('events')
    expect(taskHistory.value).toEqual([])
    expect(loadDetail).not.toHaveBeenCalled()
    open({ id: 'child' })
    expect(taskHistory.value).toEqual(['self'])
    expect(loadDetail).toHaveBeenCalledWith('child')
  })

  it('模板使用设备执行行，单任务不再请求子任务或展示分页', () => {
    expect(source).toContain(':data="executionRows"')
    expect(source).toContain('if (isTaskGroup(detail)) await loadChildren(taskId)')
    expect(source).toContain('v-if="!isSingleExecution" class="task-child-pagination"')
    expect(source).toContain('v-if="isSingleExecution" label="设备名称"')
    expect(source).not.toContain('isChildTask')
  })
})
