import { describe, expect, it, vi } from 'vitest'
import ts from 'typescript'
import source from './TelegramReviewBinding.vue?raw'

const ast = ts.createSourceFile('Binding.ts', source.split('<script setup lang="ts">')[1]!.split('</script>')[0]!, ts.ScriptTarget.Latest, true)
const functions = ast.statements.filter(ts.isFunctionDeclaration).map(node => node.getText(ast)).join('\n')
function setup() {
  const state = {
    visible: { value: true }, loading: { value: false }, canBind: { value: true },
    binding: { value: { configured: true, bound: false, notify_auto_success: true, notify_auto_failure: true } }, bindingUrl: { value: '' }, expiresAt: { value: '' }, now: { value: 0 },
    api: { get: vi.fn().mockResolvedValue({ configured: true, bound: true, notify_auto_success: true, notify_auto_failure: true }), post: vi.fn().mockResolvedValue({ url: 'https://t.me/review_bot?start=code', expires_at: '2099-01-01' }), put: vi.fn(), delete: vi.fn().mockResolvedValue({}) },
    notifyError: vi.fn(), ElNotification: { success: vi.fn() }, ElMessageBox: { confirm: vi.fn().mockResolvedValue(true) },
  }
  const compiled = ts.transpileModule(`let timer; ${functions}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const actions = new Function(...Object.keys(state), `${compiled}; return {bind, unbind, refresh, close, setNotification};`)(...Object.values(state)) as {
    bind: () => Promise<void>; unbind: () => Promise<void>; refresh: () => Promise<void>; close: () => void
    setNotification: (key: 'notify_auto_success' | 'notify_auto_failure', value: boolean) => Promise<void>
  }
  return { ...state, ...actions }
}

describe('TG 私聊绑定', () => {
  it('有权限才生成本人绑定链接，防重复提交', async () => {
    const s = setup()
    s.canBind.value = false
    await s.bind()
    expect(s.api.post).not.toHaveBeenCalled()
    s.canBind.value = true
    s.loading.value = true
    await s.bind()
    expect(s.api.post).not.toHaveBeenCalled()
    s.loading.value = false
    await s.bind()
    expect(s.api.post).toHaveBeenCalledWith('/api/telegram-review/binding-code', {})
    expect(s.bindingUrl.value).toBe('https://t.me/review_bot?start=code')
  })
  it('拒绝非 TG 链接，关闭清除一次性链接', async () => {
    const s = setup()
    s.api.post.mockResolvedValueOnce({ url: 'javascript:alert(1)', expires_at: '2099-01-01' })
    await s.bind()
    expect(s.bindingUrl.value).toBe('')
    expect(s.notifyError).toHaveBeenCalled()
    await s.bind()
    s.close()
    expect(s.bindingUrl.value).toBe('')
    expect(s.expiresAt.value).toBe('')
  })
  it('绑定成功清除链接，撤权后仍允许解绑', async () => {
    const s = setup()
    await s.bind()
    await s.refresh()
    expect(s.binding.value.bound).toBe(true)
    expect(s.bindingUrl.value).toBe('')
    s.canBind.value = false
    await s.unbind()
    expect(s.api.delete).toHaveBeenCalledWith('/api/telegram-review/binding')
    expect(s.api.delete).toHaveBeenCalledTimes(1)
  })
  it('取消解绑不发请求，失败保留状态', async () => {
    const s = setup()
    s.binding.value.bound = true
    s.ElMessageBox.confirm.mockRejectedValueOnce('cancel')
    await s.unbind()
    expect(s.api.delete).not.toHaveBeenCalled()
    s.api.get.mockRejectedValueOnce(new Error('offline'))
    await s.refresh()
    expect(s.binding.value.bound).toBe(true)
    expect(s.loading.value).toBe(false)
  })
  it('两个结果通知独立保存，并采用服务端确认值', async () => {
    const s = setup()
    s.binding.value.bound = true
    s.api.put.mockResolvedValueOnce({ ...s.binding.value, notify_auto_success: false })
    await s.setNotification('notify_auto_success', false)
    expect(s.api.put).toHaveBeenCalledWith('/api/telegram-review/notification-settings', {
      notify_auto_success: false, notify_auto_failure: true,
    })
    expect(s.binding.value.notify_auto_success).toBe(false)
    s.api.put.mockResolvedValueOnce({ ...s.binding.value, notify_auto_failure: false })
    await s.setNotification('notify_auto_failure', false)
    expect(s.api.put).toHaveBeenLastCalledWith('/api/telegram-review/notification-settings', {
      notify_auto_success: false, notify_auto_failure: false,
    })
  })
  it('未绑定、撤权、请求中不可修改；失败不更改已确认值', async () => {
    const s = setup()
    await s.setNotification('notify_auto_success', false)
    s.binding.value.bound = true
    s.canBind.value = false
    await s.setNotification('notify_auto_success', false)
    s.canBind.value = true
    s.loading.value = true
    await s.setNotification('notify_auto_success', false)
    expect(s.api.put).not.toHaveBeenCalled()
    s.loading.value = false
    s.api.put.mockRejectedValueOnce(new Error('offline'))
    await s.setNotification('notify_auto_success', false)
    expect(s.binding.value.notify_auto_success).toBe(true)
    expect(s.notifyError).toHaveBeenCalled()
    expect(s.loading.value).toBe(false)
  })
  it('保存期间轮询与重复点击不覆盖状态', async () => {
    const s = setup()
    s.binding.value.bound = true
    let finish!: (value: unknown) => void
    s.api.put.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const pending = s.setNotification('notify_auto_success', false)
    await s.refresh()
    await s.setNotification('notify_auto_failure', false)
    expect(s.api.get).not.toHaveBeenCalled()
    expect(s.api.put).toHaveBeenCalledTimes(1)
    finish({ ...s.binding.value, notify_auto_success: false })
    await pending
    expect(s.binding.value.notify_auto_success).toBe(false)
  })
})
