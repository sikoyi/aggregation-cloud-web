import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import { mergePageSelection, useCrossPageTableSelection } from './useCrossPageTableSelection'

type Row = { id: number; name: string }
const keyOf = (row: Row) => String(row.id)

describe('mergePageSelection', () => {
  it('翻页时保留其他页面已选项', () => {
    const pageOne = [
      { id: 1, name: 'one' },
      { id: 2, name: 'two' },
    ]
    const pageTwo = [{ id: 3, name: 'three' }]

    let selected = mergePageSelection(new Map<string, Row>(), pageOne, pageOne, keyOf)
    selected = mergePageSelection(selected, pageTwo, [], keyOf)

    expect([...selected.keys()]).toEqual(['1', '2'])
  })

  it('合并新页面选择并支持返回原页反选', () => {
    const pageOne = [
      { id: 1, name: 'one' },
      { id: 2, name: 'two' },
    ]
    const pageTwo = [{ id: 3, name: 'three' }]

    let selected = mergePageSelection(new Map<string, Row>(), pageOne, pageOne, keyOf)
    selected = mergePageSelection(selected, pageTwo, pageTwo, keyOf)
    selected = mergePageSelection(selected, pageOne, [pageOne[1]], keyOf)

    expect([...selected.keys()]).toEqual(['3', '2'])
  })

  it('使用重新加载后的行对象更新已选数据', () => {
    const oldRow = { id: 1, name: 'old' }
    const freshRow = { id: 1, name: 'fresh' }
    const selected = mergePageSelection(new Map([['1', oldRow]]), [freshRow], [freshRow], keyOf)

    expect(selected.get('1')).toBe(freshRow)
  })

  it('恢复当前页多个勾选项时不会互相覆盖', async () => {
    const pageRows = [
      { id: 1, name: 'one' },
      { id: 2, name: 'two' },
    ]
    const rows = ref<Row[]>(pageRows)
    const state = useCrossPageTableSelection(rows, keyOf)
    const restored: Row[] = []

    state.handleSelectionChange(pageRows)
    state.tableRef.value = {
      toggleRowSelection(row) {
        restored.push(row)
        state.handleSelectionChange([...restored])
      },
    }
    await state.restorePageSelection()

    expect(restored.map((row) => row.id)).toEqual([1, 2])
    expect(state.selectedRows.value.map((row) => row.id)).toEqual([1, 2])
  })
})
