import { computed, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { transpile } from 'typescript'
import source from './AccountBackupDeleteDialog.vue?raw'

function editor() {
  const http = { post: vi.fn() }
  const emit = vi.fn()
  const ElMessageBox = { confirm: vi.fn().mockResolvedValue('confirm') }
  const script = source.slice(source.indexOf('interface Preview'), source.indexOf('onMounted(preview)'))
  const state = new Function('ref', 'computed', 'props', 'http', 'emit', 'ElMessageBox', 'getErrorMessage',
    `${transpile(script)}; return {rows, results, loading, saving, ready, confirmed, error, canDelete, preview, remove};`)(
    ref, computed, { accountIds: ['a'] }, http, emit, ElMessageBox, () => '请求失败')
  return { ...state, http, emit, ElMessageBox }
}
const row = { account_id: 'a', name: 'demo', platform: 'x', version: 'a'.repeat(64), count: 1, blocked_reason: '' }
async function ready(s: ReturnType<typeof editor>) {
  s.http.post.mockResolvedValueOnce([{ ...row }])
  await s.preview()
  s.confirmed.value = true
}

describe('备份删除确认', () => {
  it('有阻塞或未确认时不发送删除', async () => {
    const s = editor()
    await ready(s)
    s.rows.value[0].blocked_reason = '运行中'
    await s.remove()
    expect(s.http.post).toHaveBeenCalledTimes(1)
    s.rows.value[0].blocked_reason = ''
    s.confirmed.value = false
    await s.remove()
    expect(s.http.post).toHaveBeenCalledTimes(1)
  })
  it('取消确认不删除', async () => {
    const s = editor(); await ready(s)
    s.ElMessageBox.confirm.mockRejectedValue('cancel')
    await s.remove()
    expect(s.http.post).toHaveBeenCalledTimes(1)
    expect(s.ready.value).toBe(true)
  })
  it('失败保留预览并要求重新预检', async () => {
    const s = editor(); await ready(s)
    s.http.post.mockRejectedValueOnce(new Error('version changed'))
    await s.remove()
    expect(s.rows.value).toHaveLength(1)
    expect(s.ready.value).toBe(false)
    expect(s.error.value).toBe('请求失败')
  })
  it('保留逐项清理结果，不将失败项显示成功', async () => {
    const s = editor(); await ready(s)
    s.http.post.mockResolvedValueOnce([{ account_id: 'a', status: 'failed', message: '待重试' }])
    await s.remove()
    expect(s.results.value[0].status).toBe('failed')
    expect(s.ready.value).toBe(false)
    expect(s.emit).toHaveBeenCalledWith('changed')
    expect(s.emit).not.toHaveBeenCalledWith('close')
  })
  it('确认期间阻止重复提交并冻结版本', async () => {
    const s = editor(); await ready(s)
    let resolve!: () => void
    s.ElMessageBox.confirm.mockImplementation(() => new Promise<void>(done => { resolve = done }))
    const saving = s.remove()
    s.rows.value[0].version = 'b'.repeat(64)
    await s.remove()
    s.http.post.mockResolvedValueOnce([])
    resolve(); await saving
    expect(s.http.post).toHaveBeenLastCalledWith('/api/accounts/backup-delete/batch', { items: [{ account_id: 'a', version: row.version }] })
    expect(s.ElMessageBox.confirm).toHaveBeenCalledTimes(1)
  })
  it('重新预检失败不能沿用旧确认', async () => {
    const s = editor(); await ready(s)
    s.http.post.mockRejectedValueOnce(new Error('offline'))
    await s.preview()
    expect(s.ready.value).toBe(false)
    expect(s.confirmed.value).toBe(false)
  })
})
