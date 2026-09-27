import { describe, expect, it, vi } from 'vitest'
import ts from 'typescript'
import source from './AccountDataView.vue?raw'

const script = source.split('<script setup lang="ts">')[1]!.split('</script>')[0]!
const ast = ts.createSourceFile('AccountDataView.ts', script, ts.ScriptTarget.Latest, true)
const names = ['openBatchBenchmark', 'saveBatchBenchmark']
const handlers = ast.statements.filter(node => ts.isFunctionDeclaration(node)
  && names.includes(node.name?.text || '')).map(node => node.getText(ast)).join('\n')

function setup() {
  const state = {
    batchActionsDisabled: { value: false },
    batchBenchmark: { value: false },
    batchBenchmarkAccounts: { value: [] as { account_id: string }[] },
    selectedAccounts: { value: [{ account_id: '22' }, { account_id: '23' }] },
    overwriteBenchmark: { value: false },
    batchBenchmarkResult: { value: null as unknown },
    monitorAccountLocked: { value: false },
    monitorForm: { business_platform: '' },
    monitorFeature: { value: '' },
    submitting: { value: false },
    benchmarkForm: {
      source_business_platform: 'threads', source_profile_url: ' https://www.threads.com/@source ',
      profile_sync_fields: ['display_name', 'biography', 'avatar_url'],
      post_sync_mode: 'review', post_translation_language: 'ja', monitor_mode: 'custom', interval_minutes: 30,
    },
    openMonitor: vi.fn(),
    http: { post: vi.fn().mockResolvedValue({ processed_count: 1, skipped_count: 1, failed_count: 0 }) },
    ElMessageBox: { confirm: vi.fn().mockResolvedValue('confirm') },
    ElNotification: { warning: vi.fn() },
    notifyError: vi.fn(),
    loadRows: vi.fn().mockResolvedValue(undefined),
  }
  const compiled = ts.transpileModule(handlers, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const actions = new Function(...Object.keys(state), `${compiled}; return { ${names.join(', ')} };`)(...Object.values(state)) as {
    openBatchBenchmark: () => void; saveBatchBenchmark: () => Promise<void>
  }
  return { ...state, ...actions }
}

describe('批量对标跟踪', () => {
  it('冻结所选账号并默认保留已有配置，完整提交同步选项', async () => {
    const s = setup()
    s.openBatchBenchmark()
    s.selectedAccounts.value = []
    await s.saveBatchBenchmark()
    expect(s.http.post).toHaveBeenCalledWith('/api/benchmark-trackers/batch', {
      ...s.benchmarkForm, source_profile_url: s.benchmarkForm.source_profile_url.trim(),
      account_ids: ['22', '23'], overwrite_existing: false,
    })
    expect(s.ElMessageBox.confirm).not.toHaveBeenCalled()
    expect(s.batchBenchmarkResult.value).toEqual(expect.objectContaining({ processed_count: 1 }))
    await s.saveBatchBenchmark()
    expect(s.http.post).toHaveBeenCalledTimes(1)
  })

  it('取消覆盖确认不提交且恢复按钮', async () => {
    const s = setup()
    s.openBatchBenchmark()
    s.overwriteBenchmark.value = true
    s.ElMessageBox.confirm.mockRejectedValueOnce('cancel')
    await s.saveBatchBenchmark()
    expect(s.http.post).not.toHaveBeenCalled()
    expect(s.submitting.value).toBe(false)
  })

  it('确认等待期间不重复打开确认或提交', async () => {
    const s = setup()
    s.openBatchBenchmark()
    s.overwriteBenchmark.value = true
    let confirm!: (value: string) => void
    s.ElMessageBox.confirm.mockReturnValueOnce(new Promise(resolve => { confirm = resolve }))
    const first = s.saveBatchBenchmark()
    await s.saveBatchBenchmark()
    confirm('confirm')
    await first
    expect(s.ElMessageBox.confirm).toHaveBeenCalledTimes(1)
    expect(s.http.post).toHaveBeenCalledTimes(1)
    expect(s.http.post.mock.calls[0]![1]).toMatchObject({ overwrite_existing: true })
  })

  it('失败保留输入并允许重试', async () => {
    const s = setup()
    s.openBatchBenchmark()
    s.http.post.mockRejectedValueOnce(new Error('offline'))
    await s.saveBatchBenchmark()
    expect(s.batchBenchmarkResult.value).toBeNull()
    expect(s.submitting.value).toBe(false)
    expect(s.benchmarkForm.post_translation_language).toBe('ja')
    await s.saveBatchBenchmark()
    expect(s.http.post).toHaveBeenCalledTimes(2)
  })

  it('系统间隔和未翻译选项显式提交 null', async () => {
    const s = setup()
    s.openBatchBenchmark()
    s.benchmarkForm.monitor_mode = 'system'
    s.benchmarkForm.post_translation_language = ''
    await s.saveBatchBenchmark()
    expect(s.http.post.mock.calls[0]![1]).toMatchObject({ interval_minutes: null, post_translation_language: null })
  })
})
