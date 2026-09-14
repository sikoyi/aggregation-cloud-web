import { describe, expect, it } from 'vitest'
import { managementFilters } from './managementFilters'
import { resources } from './resources'
import { buildAccountIdentityResource } from './accountIdentityResource'

describe('账号和设备筛选顺序', () => {
  for (const config of [resources.accounts, buildAccountIdentityResource(resources.accounts), resources.slots]) {
    it(`${config.key} 只重排，不改变字段名称或查询配置`, () => {
      const original = [...config.filters!]
      const fields = managementFilters(config)
      expect(fields.slice(0, 3).map(filter => filter.key)).toEqual(['business_platform', 'runtime_platform', 'provider'])
      expect(fields.map(filter => filter.key).sort()).toEqual(original.map(filter => filter.key).sort())
      for (const field of fields) expect(field).toBe(original.find(filter => filter.key === field.key))
      expect(config.filters).toEqual(original)
      expect(managementFilters({ ...config, filters: [...original].reverse() })).toEqual(fields)
    })
  }
  it('新增字段保留，其他页面顺序不变', () => {
    const filters = [{ key: 'new_filter', label: '新增条件' }, { key: 'business_platform', label: '业务 App' }]
    expect(managementFilters({ key: 'slots', filters })).toEqual([filters[1], filters[0]])
    expect(managementFilters({ key: 'tasks', filters })).toBe(filters)
    expect(managementFilters({ key: 'slots' })).toEqual([])
  })
})
