import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getBindingConflicts } from './bindingConflicts'
import { getExactExecutionSlot } from './executionSlots'
import { http } from './http'

vi.mock('./http', () => ({ http: { getWithSignal: vi.fn(), get: vi.fn() } }))

describe('绑定冲突只读接口与设备定位', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each(['accounts', 'execution-slots'] as const)('使用 %s 的冲突端点和已解包响应', async source => {
    const result = { items: [] }
    const signal = new AbortController().signal
    vi.mocked(http.getWithSignal).mockResolvedValueOnce(result)
    await expect(getBindingConflicts({ source, id: 'id/1' }, signal)).resolves.toEqual(result)
    expect(http.getWithSignal).toHaveBeenCalledExactlyOnceWith(`/api/${source}/id%2F1/binding-conflicts`, signal)
  })

  it('精确定位只请求内部设备 ID，不使用模糊查询或持久化筛选', async () => {
    const row = { id: 'slot/1', provider_slot_id: 'provider-1', binding_conflict_count: 2 }
    vi.mocked(http.get).mockResolvedValueOnce(row)
    await expect(getExactExecutionSlot('slot/1')).resolves.toEqual({ items: [row], total: 1, page: 1, page_size: 1 })
    expect(http.get).toHaveBeenCalledExactlyOnceWith('/api/execution-slots/slot%2F1')
  })

  it('目标不可见或不存在时不回退到其他设备', async () => {
    vi.mocked(http.get).mockRejectedValueOnce(new Error('无权访问'))
    await expect(getExactExecutionSlot('slot/1')).rejects.toThrow('无权访问')
    vi.mocked(http.get).mockResolvedValueOnce({ id: 'slot/10' })
    await expect(getExactExecutionSlot('slot/1')).rejects.toThrow('目标 ID 不一致')
  })
})
