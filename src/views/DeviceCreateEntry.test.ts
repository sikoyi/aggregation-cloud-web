import { describe, expect, it } from 'vitest'
import source from './DeviceCenterView.vue?raw'

describe('设备管理入口', () => {
  it('移除手动新增设备，保留同步和分组管理', () => {
    expect(source).not.toContain('openActiveCreate')
    expect(source).not.toContain('activeCreateLabel')
    expect(source).toContain('@click="openSlotSync"')
    expect(source).toContain('管理分组')
    expect(source).toContain(':config="slotGroupConfig"')
  })
})
