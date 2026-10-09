import { computed, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { transpile, ScriptTarget } from 'typescript'
import { isTaskGroup } from '../utils/taskResultCounts'
import source from './TaskDetailDrawer.vue?raw'

function deferred() {
  let resolve!: (value: any) => void
  let reject!: (reason: any) => void
  const promise = new Promise<any>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function harness() {
  const requests: Array<ReturnType<typeof deferred> & { url: string; params: any }> = []
  const http = { get: vi.fn((url: string, params: any) => {
    const request = { ...deferred(), url, params }
    requests.push(request)
    return request.promise
  }) }
  const notifyError = vi.fn(() => 'error')
  const buildParamRows = vi.fn(async (task: any) => [{ key: task.id }])
  let changed!: (value: [boolean, string | null]) => void
  const unmounts: Array<() => void> = []
  const script = source.slice(source.indexOf('const loading ='), source.indexOf('const scriptRelationConfig'))
    + source.slice(source.indexOf('function timelineTitle'), source.indexOf('</script>'))
  const state = new Function('ref', 'http', 'notifyError', 'buildParamRows', 'isTaskGroup', 'watch', 'onBeforeUnmount', 'onMounted', 'window', 'computed',
    `${transpile(script, { target: ScriptTarget.ES2022 })};
    return { loading, task, events, error, children, childTotal, childPage, childLoading, paramRows,
      currentTaskId, loadDetail, loadChildren, changeChildPage, changeChildPageSize };`)(
    ref, http, notifyError, buildParamRows, isTaskGroup,
    (_getter: any, callback: typeof changed) => { changed = callback },
    (callback: () => void) => { unmounts.push(callback) },
    (callback: () => void) => callback(),
    { matchMedia: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) },
    computed,
  )
  return { ...state, requests, notifyError, buildParamRows,
    close: () => changed([false, null]), unmount: () => unmounts.forEach(callback => callback()) }
}

function finishDetail(h: ReturnType<typeof harness>, offset: number, id: string) {
  h.requests[offset].resolve({ id })
  h.requests[offset + 1].resolve({ items: [{ id: `event-${id}` }] })
}

describe('task detail request ordering', () => {
  it('keeps newer task, events and parameters when older detail returns last', async () => {
    const h = harness()
    const a = h.loadDetail('a'), b = h.loadDetail('b')
    finishDetail(h, 2, 'b')
    await b
    finishDetail(h, 0, 'a')
    await a
    expect(h.task.value.id).toBe('b')
    expect(h.events.value).toEqual([{ id: 'event-b' }])
    expect(h.paramRows.value).toEqual([{ key: 'b' }])
  })

  it('ignores old failures and does not stop the newer loading indicator', async () => {
    const h = harness()
    const a = h.loadDetail('a'), b = h.loadDetail('b')
    h.requests[0].reject(new Error('old error'))
    h.requests[1].resolve({ items: [] })
    await a
    expect(h.loading.value).toBe(true)
    expect(h.notifyError).not.toHaveBeenCalled()
    finishDetail(h, 2, 'b')
    await b
    expect(h.loading.value).toBe(false)
  })

  it('ignores late parameter lookups after switching tasks', async () => {
    const h = harness(), params = deferred(), started = deferred()
    h.buildParamRows.mockImplementationOnce(() => { started.resolve(null); return params.promise })
    const a = h.loadDetail('a')
    finishDetail(h, 0, 'a')
    await started.promise
    const b = h.loadDetail('b')
    expect(h.events.value).toEqual([])
    finishDetail(h, 2, 'b')
    await b
    params.resolve([{ key: 'a' }])
    await a
    expect(h.paramRows.value).toEqual([{ key: 'b' }])
  })

  it('keeps the latest page and total when pages finish out of order', async () => {
    const h = harness()
    h.currentTaskId.value = 'parent'
    const a = h.changeChildPage(1), b = h.changeChildPage(2)
    expect(h.requests.map((r: any) => r.params.page)).toEqual([1, 2])
    h.requests[1].resolve({ items: [{ id: 'page2' }], total: 40 })
    await b
    h.requests[0].resolve({ items: [{ id: 'page1' }], total: 20 })
    await a
    expect(h.childPage.value).toBe(2)
    expect(h.children.value).toEqual([{ id: 'page2' }])
    expect(h.childTotal.value).toBe(40)
  })

  it('ignores outdated child errors and only current request can end loading', async () => {
    const h = harness(), a = h.loadChildren('p'), b = h.loadChildren('p')
    h.requests[0].reject(new Error('old error'))
    await a
    expect(h.childLoading.value).toBe(true)
    expect(h.notifyError).not.toHaveBeenCalled()
    h.requests[1].resolve({ items: [], total: 0 })
    await b
    expect(h.childLoading.value).toBe(false)
  })

  it('does not display previous page rows when current page fails', async () => {
    const h = harness()
    h.children.value = [{ id: 'old-page' }]
    const request = h.loadChildren('parent')
    expect(h.children.value).toEqual([])
    h.requests[0].reject(new Error('current error'))
    await request
    expect(h.notifyError).toHaveBeenCalledTimes(1)
    expect(h.childLoading.value).toBe(false)
  })

  it('invalidates children when switching to a different task', async () => {
    const h = harness(), page = h.loadChildren('parent'), detail = h.loadDetail('single')
    finishDetail(h, 1, 'single')
    await detail
    h.requests[0].resolve({ items: [{ id: 'old-child' }], total: 9 })
    await page
    expect(h.children.value).toEqual([])
    expect(h.childTotal.value).toBe(0)
  })

  it('ignores earlier detail even when reopening the same task ID', async () => {
    const h = harness(), first = h.loadDetail('same')
    h.close()
    const second = h.loadDetail('same')
    finishDetail(h, 2, 'new-snapshot')
    await second
    finishDetail(h, 0, 'old-snapshot')
    await first
    expect(h.task.value.id).toBe('new-snapshot')
  })

  it('does not load parameters for a parent after its children complete late', async () => {
    const h = harness(), parent = h.loadDetail('parent')
    h.requests[0].resolve({ id: 'parent', task_type: 'template_batch' })
    h.requests[1].resolve({ items: [] })
    await vi.waitFor(() => expect(h.requests).toHaveLength(3))
    const next = h.loadDetail('next')
    finishDetail(h, 3, 'next')
    await next
    h.requests[2].resolve({ items: [{ id: 'child' }], total: 1 })
    await parent
    expect(h.buildParamRows).toHaveBeenCalledExactlyOnceWith({ id: 'next' })
    expect(h.children.value).toEqual([])
  })

  it('resets to page one and ignores prior pages when page size changes', async () => {
    const h = harness()
    h.currentTaskId.value = 'parent'
    const old = h.changeChildPage(2), current = h.changeChildPageSize(50)
    expect(h.requests[1].params).toEqual({ page: 1, page_size: 50 })
    h.requests[1].resolve({ items: [{ id: 'large-page' }], total: 50 })
    await current
    h.requests[0].resolve({ items: [{ id: 'small-page' }], total: 50 })
    await old
    expect(h.childPage.value).toBe(1)
    expect(h.children.value).toEqual([{ id: 'large-page' }])
  })

  it('reports a current detail error and finishes loading', async () => {
    const h = harness(), request = h.loadDetail('failed')
    h.requests[0].reject(new Error('current failure'))
    h.requests[1].resolve({ items: [] })
    await request
    expect(h.error.value).toBe('error')
    expect(h.notifyError).toHaveBeenCalledTimes(1)
    expect(h.loading.value).toBe(false)
    expect(h.task.value).toBeNull()
  })

  it.each(['close', 'unmount'] as const)('invalidates pending requests on %s', async action => {
    const h = harness(), detail = h.loadDetail('a'), page = h.loadChildren('a')
    h[action]()
    finishDetail(h, 0, 'a')
    h.requests[2].reject(new Error('closed'))
    await Promise.all([detail, page])
    expect(h.task.value).toBeNull()
    expect(h.events.value).toEqual([])
    expect(h.notifyError).not.toHaveBeenCalled()
    expect(h.loading.value).toBe(false)
    expect(h.childLoading.value).toBe(false)
  })
})
