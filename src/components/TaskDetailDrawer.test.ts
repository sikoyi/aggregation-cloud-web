import { describe, expect, it } from 'vitest'

import source from './TaskDetailDrawer.vue?raw'

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
})
