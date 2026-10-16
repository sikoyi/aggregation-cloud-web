import { describe, expect, it } from 'vitest'
import { transpile } from 'typescript'
import source from './AccountTreeSelect.vue?raw'

function selectable(props: Record<string, unknown>, account: Record<string, unknown>) {
  const body = source.slice(source.indexOf('function accountSelectable('), source.indexOf('function accountLabel('))
  return new Function('props', 'account', `${transpile(body)}; return accountSelectable(account)`)(props, account)
}

describe('账号池发布选择', () => {
  it.each([{}, { has_data_package: false }, { has_data_package: true }])('无包账号也允许选择 %j', account => {
    expect(selectable({ publishPool: true }, account)).toBe(true)
  })
  it('普通任务仍要求设备绑定', () => {
    expect(selectable({}, {})).toBe(false)
    expect(selectable({}, { bound_slot_id: 'device' })).toBe(true)
  })
  it('不再显示缺包禁选提示', () => {
    expect(source).not.toContain('（缺少帐号数据包）')
    expect(source).not.toContain('当前帐号均缺少云手机帐号数据包')
  })
})
