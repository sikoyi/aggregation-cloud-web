import { describe, expect, it } from 'vitest'

import source from './DeviceCenterView.vue?raw'

describe('设备分组弹窗滚动边界', () => {
  it('弹窗主体仅允许纵向滚动，避免内嵌表单产生底部横向滚动条', () => {
    expect(source).toContain(':deep(.device-group-dialog .el-dialog__body)')
    expect(source).toContain('overflow-y: auto;')
    expect(source).toContain('overflow-x: hidden;')
  })
})
