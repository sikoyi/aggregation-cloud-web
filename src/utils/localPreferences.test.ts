import { describe, expect, it } from 'vitest'

import {
  buildUserPreferenceKey,
  readRecordPreference,
  writeRecordPreference,
} from '@/utils/localPreferences'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

describe('管理员本地偏好', () => {
  it('按管理员和使用位置生成隔离的存储键', () => {
    expect(buildUserPreferenceKey('admin-1', 'filters:selector:devices'))
      .toBe('aggregation-cloud:user:admin-1:filters:selector:devices')
    expect(buildUserPreferenceKey('admin-2', 'filters:selector:devices'))
      .not.toBe(buildUserPreferenceKey('admin-1', 'filters:selector:devices'))
  })

  it('保存对象筛选并兼容损坏的本地数据', () => {
    const storage = new MemoryStorage()
    const key = buildUserPreferenceKey('admin-1', 'filters:selector:devices')

    writeRecordPreference(storage, key, {
      keyword: '韩国',
      groupNodeIds: ['group:1', 'group:2'],
    })
    expect(readRecordPreference(storage, key)).toEqual({
      keyword: '韩国',
      groupNodeIds: ['group:1', 'group:2'],
    })

    storage.setItem(key, '{invalid')
    expect(readRecordPreference(storage, key)).toBeNull()
  })
})