import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { usePersistentFilters } from '@/composables/usePersistentFilters'
import { useAuthStore } from '@/stores/auth'
import { buildUserPreferenceKey } from '@/utils/localPreferences'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()

  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

describe('统一筛选缓存', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage())
    setActivePinia(createPinia())
  })

  it('同一管理员和筛选域实时共享筛选条件', () => {
    const auth = useAuthStore()
    auth.user = { id: 'admin-filter-1', username: 'admin' }

    const first = usePersistentFilters('selector:devices', {
      keyword: '',
      groupNodeIds: [] as string[],
    })
    first.filters.keyword = '韩国'
    first.filters.groupNodeIds = ['group:8']

    const second = usePersistentFilters('selector:devices', {
      keyword: '',
      groupNodeIds: [] as string[],
    })
    expect(second.filters).toBe(first.filters)
    expect(second.filters).toEqual({ keyword: '韩国', groupNodeIds: ['group:8'] })
  })

  it('不同管理员之间隔离筛选条件', () => {
    const auth = useAuthStore()
    auth.user = { id: 'admin-filter-2', username: 'admin-2' }
    const first = usePersistentFilters('list:accounts', { keyword: '' })
    first.filters.keyword = 'account-a'

    auth.user = { id: 'admin-filter-3', username: 'admin-3' }
    const second = usePersistentFilters('list:accounts', { keyword: '' })
    expect(second.filters.keyword).toBe('')
  })

  it('恢复本地筛选并忽略类型不兼容的字段', () => {
    const auth = useAuthStore()
    auth.user = { id: 'admin-filter-4', username: 'admin-4' }
    const key = buildUserPreferenceKey('admin-filter-4', 'filters:list:tasks')
    localStorage.setItem(key, JSON.stringify({
      keyword: '任务名称',
      statuses: 'not-an-array',
    }))

    const state = usePersistentFilters('list:tasks', {
      keyword: '',
      statuses: [] as string[],
    })
    expect(state.filters.keyword).toBe('任务名称')
    expect(state.filters.statuses).toEqual([])
  })
})