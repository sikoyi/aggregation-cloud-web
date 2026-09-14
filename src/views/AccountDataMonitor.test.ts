import { describe, expect, it, vi } from 'vitest'
import ts from 'typescript'

import source from './AccountDataView.vue?raw'

// Execute the actual dialog handlers without mounting the unrelated dashboard panels.
const script = source.split('<script setup lang="ts">')[1]!.split('</script>')[0]!
const ast = ts.createSourceFile('AccountDataView.ts', script, ts.ScriptTarget.Latest, true)
const handlers = ['resetMonitorAccount', 'finishMonitorSave', 'saveMonitor', 'saveBenchmarkTracker']
const handlerSource = ast.statements.filter((node) => ts.isFunctionDeclaration(node)
  && handlers.includes(node.name?.text || '')).map((node) => node.getText(ast)).join('\n')
const accountWatcher = ast.statements.find((node) => ts.isExpressionStatement(node)
  && node.getText(ast).startsWith('watch(') && node.getText(ast).includes('() => monitorForm.account_id'))!.getText(ast)

function setup(locked = false) {
  const state = {
    monitorAccountLocked: { value: locked },
    monitorVisible: { value: true },
    submitting: { value: false },
    accountProfileLoading: { value: false },
    monitorForm: {
      account_id: '123', business_platform: 'x', profile_url: 'https://x.com/example',
      monitor_mode: 'custom', interval_minutes: 120, comment_reply_mode: 'disabled',
      ai_provider: 'gemini', ai_language: 'auto', ai_tone: 'natural', ai_max_length: 120,
    },
    benchmarkForm: { source_profile_url: 'https://www.threads.com/@source', monitor_mode: 'custom', interval_minutes: 90, profile_sync_fields: ['display_name'] },
    http: { post: vi.fn().mockResolvedValue({ monitor_run: { id: '456' } }), get: vi.fn() },
    ElNotification: { warning: vi.fn(), success: vi.fn() },
    notifyError: vi.fn(),
    loadRows: vi.fn().mockResolvedValue(undefined),
  }
  let accountChanged: (id: string, previous: string) => Promise<void> = async () => {}
  const watch = (_source: unknown, callback: typeof accountChanged) => { accountChanged = callback }
  const compiled = ts.transpileModule(`let accountProfileRequest = 0;\n${handlerSource}\n${accountWatcher}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText
  const actions = new Function(...Object.keys(state), 'watch', `${compiled}; return { ${handlers.join(', ')} };`)(...Object.values(state), watch) as {
    saveMonitor: () => Promise<void>
    saveBenchmarkTracker: () => Promise<void>
    resetMonitorAccount: () => void
  }
  return { ...state, ...actions, accountChanged }
}

describe('监听窗口连续设置', () => {
  it('保存后保留窗口及共用规则，清空账号和独立主页', async () => {
    const s = setup()
    await s.saveMonitor()
    expect(s.http.post).toHaveBeenCalledWith('/api/interaction-center/content-monitor/accounts', expect.objectContaining({
      account_id: '123', business_platform: 'x', profile_url: 'https://x.com/example', interval_minutes: 120,
    }))
    expect(s.monitorVisible.value).toBe(true)
    expect(s.monitorForm.account_id).toBe('')
    expect(s.monitorForm.profile_url).toBe('')
    expect(s.benchmarkForm.source_profile_url).toBe('')
    expect(s.monitorForm.interval_minutes).toBe(120)
    expect(s.submitting.value).toBe(false)
    await s.saveMonitor()
    expect(s.http.post).toHaveBeenCalledTimes(1)
    s.monitorForm.account_id = '789'
    s.monitorForm.profile_url = 'https://x.com/next'
    await s.saveMonitor()
    expect(s.http.post).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ account_id: '789', profile_url: 'https://x.com/next' }))
  })

  it('单账号锁定入口保持保存后关闭的行为', async () => {
    const s = setup(true)
    await s.saveMonitor()
    expect(s.monitorVisible.value).toBe(false)
  })

  it('保存失败不清空用户输入，也不关闭窗口', async () => {
    const s = setup()
    s.http.post.mockRejectedValueOnce(new Error('保存失败'))
    await s.saveMonitor()
    expect(s.monitorVisible.value).toBe(true)
    expect(s.monitorForm.account_id).toBe('123')
    expect(s.monitorForm.profile_url).toBe('https://x.com/example')
    expect(s.notifyError).toHaveBeenCalledOnce()
    expect(s.submitting.value).toBe(false)
  })

  it('读取主页中或提交中不能重复保存', async () => {
    const s = setup()
    s.accountProfileLoading.value = true
    await s.saveMonitor()
    s.accountProfileLoading.value = false
    s.submitting.value = true
    await s.saveMonitor()
    expect(s.http.post).not.toHaveBeenCalled()
  })

  it('对标保存也保留选择窗口但不复用上个对标主页', async () => {
    const s = setup()
    s.monitorForm.business_platform = 'threads'
    await s.saveBenchmarkTracker()
    expect(s.http.post).toHaveBeenCalledWith('/api/benchmark-trackers', expect.objectContaining({ profile_sync_fields: ['display_name'] }))
    expect(s.monitorVisible.value).toBe(true)
    expect(s.monitorForm.account_id).toBe('')
    expect(s.benchmarkForm.source_profile_url).toBe('')
    expect(s.benchmarkForm.interval_minutes).toBe(90)
    expect(s.benchmarkForm.profile_sync_fields).toEqual(['display_name'])
  })

  it('三项资料独立可选，全部关闭也能保存对标规则', async () => {
    expect(source).toContain('v-model="benchmarkForm.profile_sync_fields"')
    for (const field of ['display_name', 'biography', 'avatar_url']) {
      expect(source).toContain(`<el-checkbox value="${field}">`)
    }
    expect(source).toContain('profile_sync_fields: [] as string[]')
    expect(source).toContain('[...account.benchmark_profile_sync_fields]')
    const s = setup()
    s.monitorForm.business_platform = 'threads'
    s.benchmarkForm.profile_sync_fields = []
    await s.saveBenchmarkTracker()
    expect(s.http.post).toHaveBeenCalledWith('/api/benchmark-trackers', expect.objectContaining({ profile_sync_fields: [] }))
    expect(s.monitorVisible.value).toBe(true)
  })

  it('对标保存失败保留三个字段的选择', async () => {
    const s = setup()
    s.monitorForm.business_platform = 'threads'
    s.benchmarkForm.profile_sync_fields = ['biography', 'avatar_url']
    s.http.post.mockRejectedValueOnce(new Error('资料同步任务仍在运行'))
    await s.saveBenchmarkTracker()
    expect(s.benchmarkForm.profile_sync_fields).toEqual(['biography', 'avatar_url'])
    expect(s.monitorForm.account_id).toBe('123')
    expect(s.notifyError).toHaveBeenCalledOnce()
  })

  it('平台选项受用户范围与监听能力限制，切换后清除旧账号', () => {
    expect(source).toContain("availableBusinessPlatformOptions.value.filter(")
    expect(source).toContain("['threads', 'x', 'facebook'].includes(String(option.value))")
    expect(source).toContain('@change="resetMonitorAccount"')
    expect(source).not.toContain('v-model="monitorForm.business_platform" disabled')
    expect(source).toContain('monitorForm.business_platform === platform')
    expect(source).toContain('requestId === accountProfileRequest && monitorVisible.value')
    const s = setup()
    s.resetMonitorAccount()
    expect(s.monitorForm.account_id).toBe('')
    expect(s.monitorForm.profile_url).toBe('')
  })

  it('切换平台后旧账号请求晚到不回填主页', async () => {
    const s = setup()
    let resolve!: (account: { profile_url: string }) => void
    s.http.get.mockReturnValue(new Promise((done) => { resolve = done }))
    const pending = s.accountChanged('123', '')
    expect(s.accountProfileLoading.value).toBe(true)
    s.monitorForm.business_platform = 'facebook'
    s.resetMonitorAccount()
    resolve({ profile_url: 'https://x.com/old' })
    await pending
    expect(s.monitorForm.profile_url).toBe('')
    expect(s.accountProfileLoading.value).toBe(false)
  })

  it('连续切换账号只使用最后一次读取结果', async () => {
    const s = setup()
    let resolve!: (account: { profile_url: string }) => void
    s.http.get.mockReturnValueOnce(new Promise((done) => { resolve = done }))
    const old = s.accountChanged('123', '')
    s.monitorForm.account_id = '789'
    s.http.get.mockResolvedValueOnce({ profile_url: 'https://x.com/next' })
    await s.accountChanged('789', '123')
    resolve({ profile_url: 'https://x.com/old' })
    await old
    expect(s.monitorForm.profile_url).toBe('https://x.com/next')
  })
})
