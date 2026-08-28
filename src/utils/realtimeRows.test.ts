import { describe, expect, it } from 'vitest'

import {
  patchRuntimeSummaryRows,
  patchTaskSummaryRows,
  realtimeRuntimeSummary,
  realtimeTaskTouchesRows,
  realtimeTaskSummary,
} from './realtimeRows'

describe('patchTaskSummaryRows', () => {
  it('patches a visible parent row without losing list-only fields', () => {
    const rows = [{ id: '10', status: 'running', creator_display_name: '运营 A', child_finished: 1, updated_at: '2026-08-28T01:00:00Z' }]
    const result = patchTaskSummaryRows(rows, {
      type: 'task.snapshot.updated',
      topic: 'task',
      resource_type: 'task',
      resource_id: '10',
      data: { task: { id: '10', status: 'completed', child_finished: 2, updated_at: '2026-08-28T01:01:00Z' } },
    })

    expect(result.result).toBe('patched')
    expect(result.rows[0]).toMatchObject({ status: 'completed', child_finished: 2, creator_display_name: '运营 A' })
    expect(rows[0].status).toBe('running')
  })

  it('does not replace a newer row with a stale event', () => {
    const rows = [{ id: '10', status: 'completed', updated_at: '2026-08-28T01:02:00Z' }]
    const result = patchTaskSummaryRows(rows, {
      type: 'task.updated',
      topic: 'task',
      resource_type: 'task',
      data: { task: { id: '10', status: 'running', updated_at: '2026-08-28T01:01:00Z' } },
    })

    expect(result.result).toBe('stale')
    expect(result.rows).toBe(rows)
  })

  it('marks child events for delayed consistency refresh', () => {
    const result = patchTaskSummaryRows([], {
      type: 'task.completed',
      topic: 'task',
      resource_type: 'task',
      data: { task: { id: 'child-1', parent_task_run_id: 'parent-1' } },
    })

    expect(result.result).toBe('child')
  })
})

describe('runtime realtime rows', () => {
  it('patches a visible runtime without replacing list-only fields', () => {
    const rows = [{ id: 'runtime-1', status: 'online', ip: '127.0.0.1', slot_idle: 8, updated_at: '2026-08-28T01:00:00Z' }]
    const payload = {
      type: 'runtime.slots_synced',
      topic: 'runtime',
      resource_type: 'runtime',
      resource_id: 'runtime-1',
      data: { runtime: { id: 'runtime-1', status: 'online', slot_idle: 10, updated_at: '2026-08-28T01:01:00Z' } },
    }

    expect(realtimeRuntimeSummary(payload)).toMatchObject({ id: 'runtime-1', slot_idle: 10 })
    const result = patchRuntimeSummaryRows(rows, payload)
    expect(result.result).toBe('patched')
    expect(result.rows[0]).toMatchObject({ slot_idle: 10, ip: '127.0.0.1' })
  })

  it('exposes compact task routing fields for relevance checks', () => {
    const payload = {
      type: 'task.running',
      topic: 'task',
      resource_type: 'task',
      data: { task: { id: 'task-1', slot_id: 'slot-1', runtime_instance_id: 'runtime-1' } },
    }
    const task = realtimeTaskSummary(payload)

    expect(task).toMatchObject({ slot_id: 'slot-1', runtime_instance_id: 'runtime-1' })
    expect(realtimeTaskTouchesRows([{ id: 'slot-1' }], payload, ['id'], ['slot_id'])).toBe(true)
    expect(realtimeTaskTouchesRows([{ id: 'slot-2' }], payload, ['id'], ['slot_id'])).toBe(false)
  })
})
