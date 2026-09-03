import { describe, expect, it } from 'vitest'

import { collectRuntimeSyncFailures } from './runtimeSyncFailures'

describe('设备组同步失败弹窗', () => {
  it('同一批次的多台设备只生成一个提醒并重试整个批次', () => {
    const failures = collectRuntimeSyncFailures('slots', [
      {
        id: 'slot-1',
        display_name: '设备 1',
        group_sync_status: 'failed',
        group_sync_error: '分组 ID 无效',
        group_control_command_id: 'command-1',
        group_control_batch_id: 'batch-8',
      },
      {
        id: 'slot-2',
        display_name: '设备 2',
        group_sync_status: 'failed',
        group_control_command_id: 'command-2',
        group_control_batch_id: 'batch-8',
      },
    ])

    expect(failures).toEqual([{
      key: 'batch:batch-8',
      title: '设备组同步失败',
      message: '设备“设备 1”：分组 ID 无效',
      retryPath: '/api/runtime-controls/batches/batch-8/retry',
    }])
  })

  it('单设备失败使用命令 ID 重试并展示过期原因', () => {
    const failures = collectRuntimeSyncFailures('slots', [{
      id: 'slot-1',
      provider_slot_id: 'provider-1',
      group_sync_status: 'expired',
      group_control_command_id: 'command/1',
    }])

    expect(failures[0]).toEqual({
      key: 'command:command/1',
      title: '设备组同步已过期',
      message: '设备“provider-1”：同步等待超时，请重新提交',
      retryPath: '/api/runtime-controls/command%2F1/retry',
    })
  })

  it('忽略同步中和已成功的数据', () => {
    expect(collectRuntimeSyncFailures('slotGroups', [
      { id: '1', group_sync_status: 'queued', control_batch_id: 'batch-1' },
      { id: '2', group_sync_status: 'succeeded', control_batch_id: 'batch-2' },
    ])).toEqual([])
  })
})
