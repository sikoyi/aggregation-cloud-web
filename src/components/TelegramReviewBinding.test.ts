import { describe, expect, it, vi } from 'vitest'
import ts from 'typescript'
import source from './TelegramReviewBinding.vue?raw'

const ast = ts.createSourceFile('Binding.ts', source.split('<script setup lang="ts">')[1]!.split('</script>')[0]!, ts.ScriptTarget.Latest, true)
const functions = ast.statements.filter(ts.isFunctionDeclaration).map(node => node.getText(ast)).join('\n')
function setup() {
  const state = {
    visible: { value: true }, loading: { value: false }, canBind: { value: true },
    isSuperAdmin: { value: true }, activeTab: { value: 'mine' }, userLoading: { value: false },
    boundUsers: { value: [] }, userKeyword: { value: '' }, userPage: { value: 1 }, userPageSize: { value: 20 }, userTotal: { value: 0 },
    binding: { value: { configured: true, bound: false, notify_auto_success: true, notify_auto_failure: true } }, bindingUrl: { value: '' }, expiresAt: { value: '' }, now: { value: 0 },
    api: { get: vi.fn().mockResolvedValue({ configured: true, bound: true, notify_auto_success: true, notify_auto_failure: true }), post: vi.fn().mockResolvedValue({ url: 'https://t.me/review_bot?start=code', expires_at: '2099-01-01' }), put: vi.fn(), delete: vi.fn().mockResolvedValue({}) },
    notifyError: vi.fn(), ElNotification: { success: vi.fn() }, ElMessageBox: { confirm: vi.fn().mockResolvedValue(true) },
  }
  const compiled = ts.transpileModule(`let timer; ${functions}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const actions = new Function(...Object.keys(state), `${compiled}; return {bind, unbind, refresh, close, setNotification, loadBoundUsers, searchBoundUsers};`)(...Object.values(state)) as {
    bind: () => Promise<void>; unbind: () => Promise<void>; refresh: () => Promise<void>; close: () => void
    setNotification: (key: 'notify_auto_success' | 'notify_auto_failure', value: boolean) => Promise<void>
    loadBoundUsers: () => Promise<void>; searchBoundUsers: () => void
  }
  return { ...state, ...actions }
}

describe('TG 私聊绑定', () => {
  it('使用直观的全局文字入口，并只向超级管理员展示只读绑定用户页签', () => {
    expect(source).toContain('<el-button :icon="Link2" @click="open">TG 审核</el-button>')
    expect(source).toContain('<el-tab-pane label="我的绑定" name="mine" />')
    expect(source).toContain('<el-tab-pane label="绑定用户" name="users" />')
    expect(source).toContain('v-if="isSuperAdmin"')
    expect(source).toContain('/api/telegram-review/bindings')
    expect(source).not.toContain('管理员解绑')
  })

  it('管理员绑定用户列表按搜索和分页参数加载', async () => {
    const s = setup()
    s.userKeyword.value = '  Alice  '
    s.userPage.value = 2
    s.userPageSize.value = 10
    s.api.get.mockResolvedValueOnce({ items: [{ user_id: 'u1' }], total: 21, page: 2, page_size: 10 })
    await s.loadBoundUsers()
    expect(s.api.get).toHaveBeenCalledWith('/api/telegram-review/bindings', {
      keyword: 'Alice', page: 2, page_size: 10,
    })
    expect(s.boundUsers.value).toEqual([{ user_id: 'u1' }])
    expect(s.userTotal.value).toBe(21)
  })

  it('非超级管理员不会请求绑定用户列表', async () => {
    const s = setup()
    s.isSuperAdmin.value = false
    await s.loadBoundUsers()
    expect(s.api.get).not.toHaveBeenCalled()
  })

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
