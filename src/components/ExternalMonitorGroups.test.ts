import { describe, expect, it } from 'vitest'
import source from './ExternalMonitorGroups.vue?raw'
import parent from './ExternalAccountMonitors.vue?raw'

describe('外部账号分组成员数量', () => {
  it('显示服务端成员数量列，打开弹窗刷新统计', () => {
    expect(source).toContain('prop="member_count" label="成员数量" width="100" align="center"')
    expect(source).toContain("visible = true; emit('refresh')")
    expect(parent).toContain('@refresh="loadGroups"')
  })
})
