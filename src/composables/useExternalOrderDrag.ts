import { ref, useId } from 'vue'

export function useExternalOrderDrag(keys: () => string[], disabled: () => boolean, move: (from: number, to: number) => void) {
  const scope = useId()
  const target = ref<number | null>(null)
  let source: number | null = null
  let snapshot: string[] = []
  function end() { source = null; snapshot = []; target.value = null }
  function start(event: DragEvent, index: number) {
    if (disabled() || !event.dataTransfer) { event.preventDefault(); return }
    snapshot = [...keys()]
    source = index
    event.dataTransfer.setData('text/plain', `${scope}:${snapshot[index]}`)
    event.dataTransfer.effectAllowed = 'move'
  }
  function valid(index: number) {
    const current = keys()
    return !disabled() && source !== null && index >= 0 && index < current.length
      && current.length === snapshot.length && current.every((key, i) => key === snapshot[i])
  }
  function over(event: DragEvent, index: number) {
    if (!valid(index)) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
    target.value = index
  }
  function drop(event: DragEvent, index: number) {
    if (!valid(index)) { end(); return }
    event.preventDefault()
    const from = source!
    end()
    if (from !== index) move(from, index)
  }
  function rowIndex(event: DragEvent) {
    const row = (event.target as Element | null)?.closest('tr.el-table__row')
    const marker = row?.querySelector<HTMLElement>('[data-order-index]')
    return marker ? Number(marker.dataset.orderIndex) : -1
  }
  return { target, start, end, over, drop,
    rowOver: (event: DragEvent) => over(event, rowIndex(event)),
    rowDrop: (event: DragEvent) => drop(event, rowIndex(event)),
    rowClass: ({ rowIndex }: { rowIndex: number }) => target.value === rowIndex ? 'external-order-target' : '',
  }
}
