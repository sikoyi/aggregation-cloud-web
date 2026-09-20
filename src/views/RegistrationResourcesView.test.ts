import { describe, expect, it, vi } from 'vitest'
import source from './RegistrationResourcesView.vue?raw'

function setup(confirm = vi.fn().mockResolvedValue('confirm'), remove = vi.fn().mockResolvedValue({})) {
  const state = { batchDeleting: { value: false }, loading: { value: false }, canDelete: { value: true },
    selectedBatches: { value: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] },
    batchResults: { value: [] as Array<{ name: string; status: string; error_message: string }> },
    batchResultTitle: { value: '' }, batchResultVisible: { value: false }, page: { value: 3 },
    loadBatches: vi.fn().mockResolvedValue(undefined), ElMessageBox: { confirm }, deleteRegistrationResourceBatch: remove }
  const body = source.split('async function removeSelectedBatches() {')[1]!.split('\nfunction emptyTemplateField')[0]!.trim().replace(/}\s*$/, '')
  const run = new Function(...Object.keys(state), `return async () => {${body}}`)(...Object.values(state))
  return { ...state, run, confirm, remove }
}

describe('注册资源批量删除', () => {
  it.each(['batchDeleting', 'loading', 'canDelete'] as const)('阻止无权限或忙碌操作：%s', async key => {
    const s = setup()
    s[key].value = key !== 'canDelete'
    await s.run()
    expect(s.confirm).not.toHaveBeenCalled()
  })
  it('空选与取消确认不发出删除', async () => {
    const s = setup(vi.fn().mockRejectedValue('cancel'))
    await s.run()
    expect(s.remove).not.toHaveBeenCalled()
    expect(s.batchDeleting.value).toBe(false)
    s.selectedBatches.value = []
    s.confirm.mockClear()
    await s.run()
    expect(s.confirm).not.toHaveBeenCalled()
  })
  it('逐项处理，失败不阻断后续，显示汇总并回到第一页', async () => {
    const s = setup(undefined, vi.fn().mockRejectedValueOnce(new Error('资源已被预留')).mockResolvedValueOnce({}))
    await s.run()
    expect(s.remove.mock.calls).toEqual([['a'], ['b']])
    expect(s.batchResults.value.map(item => item.status)).toEqual(['failed', 'success'])
    expect(s.batchResults.value[0]?.error_message).toBe('资源已被预留')
    expect(s.batchResultTitle.value).toContain('成功 1，失败 1')
    expect(s.batchResultVisible.value).toBe(true)
    expect(s.page.value).toBe(1)
    expect(s.loadBatches).toHaveBeenCalledOnce()
    expect(s.batchDeleting.value).toBe(false)
  })
  it('确认期间重复点击只执行一次', async () => {
    let release!: () => void
    const s = setup(vi.fn(() => new Promise<void>(resolve => { release = resolve })))
    const pending = s.run()
    await s.run()
    expect(s.confirm).toHaveBeenCalledOnce()
    release()
    await pending
    expect(s.remove).toHaveBeenCalledTimes(2)
  })
  it('常驻栏、只读权限和清空选择边界保持一致', () => {
    expect(source).toContain('v-if="canDelete" class="registration-batch-bar"')
    expect(source).toContain('watch(activeTab, clearBatchSelection)')
    expect(source).toContain('async function loadBatches() {\n  clearBatchSelection()')
    expect(source).toContain(':selectable="() => !loading && !batchDeleting"')
  })
})
