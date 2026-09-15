import { describe, expect, it } from 'vitest'

import source from './TaskDetailDrawer.vue?raw'

describe('任务详情执行结果', () => {
  it('执行结果提示由任务状态决定，不固定显示成功', () => {
    expect(source).toContain('const resultType = computed(() => taskResultAlertType(task.value?.status))')
    expect(source).toContain(':type="resultType"')
    expect(source).not.toContain('type="success"')
  })
})
