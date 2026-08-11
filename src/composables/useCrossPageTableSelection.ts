import { nextTick, ref, type Ref } from 'vue'

type TableSelectionApi<Row> = {
  clearSelection?: () => void
  toggleRowSelection?: (row: Row, selected?: boolean) => void
}

type RowKeyGetter<Row> = (row: Row) => string

export function mergePageSelection<Row>(
  selectedById: Map<string, Row>,
  pageRows: Row[],
  pageSelection: Row[],
  getRowKey: RowKeyGetter<Row>,
) {
  const next = new Map(selectedById)

  // Element Plus 的 selection-change 只可靠描述当前页，先移除当前页旧状态再合并。
  pageRows.forEach((row) => next.delete(getRowKey(row)))
  pageSelection.forEach((row) => next.set(getRowKey(row), row))
  return next
}

export function useCrossPageTableSelection<Row extends Record<string, unknown>>(
  rows: Ref<Row[]>,
  getRowKey: RowKeyGetter<Row> = (row) => String(row.id),
) {
  const tableRef = ref<TableSelectionApi<Row>>()
  const selectedRows = ref<Row[]>([])
  let selectedById = new Map<string, Row>()
  let restoringSelection = false

  function syncSelectedRows() {
    selectedRows.value = Array.from(selectedById.values())
  }

  function handleSelectionChange(selection: Row[]) {
    if (restoringSelection) return
    selectedById = mergePageSelection(selectedById, rows.value, selection, getRowKey)
    syncSelectedRows()
  }

  async function restorePageSelection() {
    await nextTick()
    restoringSelection = true
    try {
      for (const row of rows.value) {
        const key = getRowKey(row)
        if (!selectedById.has(key)) continue
        selectedById.set(key, row)
        tableRef.value?.toggleRowSelection?.(row, true)
      }
    } finally {
      restoringSelection = false
    }
    syncSelectedRows()
  }

  function clearSelection() {
    selectedById.clear()
    selectedRows.value = []
    tableRef.value?.clearSelection?.()
  }

  return {
    tableRef,
    selectedRows,
    handleSelectionChange,
    restorePageSelection,
    clearSelection,
  }
}
