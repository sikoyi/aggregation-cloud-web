import { describe, expect, it } from 'vitest'
import { formatCompactCount } from './compactCount'
import component from '../components/CompactFollowerCount.vue?raw'

describe('粉丝数紧凑展示', () => {
  it.each([[0, '0'], [999, '999'], [1000, '1k'], [12345, '12.3k'], [674130, '674.1k'], [1000000, '1m'], [999950, '1m'], [1000000000, '1b']])('%s 显示 %s', (value, compact) => {
    expect(formatCompactCount(value)).toEqual({ compact, full: value.toLocaleString('zh-CN'), expandable: value >= 1000 })
  })
  it.each([null, undefined, '', ' ', 'bad', NaN, Infinity, -1, {}, true])('无效数据不显示为零', value => {
    expect(formatCompactCount(value)).toEqual({ compact: '--', full: '--', expandable: false })
  })
  it('完整数值不采用缩写或舍入', () => {
    expect(formatCompactCount('674130').full).toBe('674,130')
    expect(component).toContain('trigger="click"')
    expect(component).toContain("{ label: '粉丝' }")
    expect(component).toContain('{{ label }}：{{ count.full }}')
    expect(component).toContain('type="button"')
  })
})
