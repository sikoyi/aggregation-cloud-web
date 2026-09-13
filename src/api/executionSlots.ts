import { http } from '@/api/http'
import type { AnyRecord, PageResult } from '@/types/api'

// 精确定位不使用 Provider ID 的模糊搜索，也不与本地保存的列表筛选相交。
export async function getExactExecutionSlot(id: string): Promise<PageResult<AnyRecord>> {
  const slot = await http.get<AnyRecord>(`/api/execution-slots/${encodeURIComponent(id)}`)
  if (String(slot.id) !== id) throw new Error('设备详情与目标 ID 不一致')
  return { items: [slot], total: 1, page: 1, page_size: 1 }
}
