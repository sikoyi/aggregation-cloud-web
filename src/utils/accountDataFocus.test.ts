import { describe, expect, it } from 'vitest'
import { accountDataFocus, accountDataQuery } from './accountDataFocus'

describe('账号数据精确定位', () => {
  it('拒绝多值和超长 ID', () => {
    expect(accountDataFocus(['946', '954'])).toBe('')
    expect(accountDataFocus('x'.repeat(101))).toBe('')
    expect(accountDataFocus(null)).toBe('')
    expect(accountDataFocus(' 946 ')).toBe('946')
  })
  it('跳转不受旧筛选和页码影响，返回后恢复普通查询', () => {
    const filters = { monitor_state: 'abnormal', keyword: 'other' }
    expect(accountDataQuery('946', filters, 9, 50)).toEqual({ account_id: '946', page: 1, page_size: 20 })
    expect(accountDataQuery('', filters, 1, 50)).toEqual({ ...filters, page: 1, page_size: 50 })
  })
})
