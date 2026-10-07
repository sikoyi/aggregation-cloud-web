import { computed, nextTick, reactive, ref, watch } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import ts from 'typescript'
import source from './CommentReplyTimeSettings.vue?raw'

const script = source.split('<script setup lang="ts">')[1]!.split('</script>')[0]!
const ast = ts.createSourceFile('TimeSettings.ts', script, ts.ScriptTarget.Latest, true)
const body = ast.statements.filter(node => !ts.isImportDeclaration(node)).map(node => node.getText(ast)).join('\n')
const compiled = ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText

async function flush() { for (let i = 0; i < 8; i++) { await Promise.resolve(); await nextTick() } }

function setup(options: Record<string, unknown> = {}, get = vi.fn(async (_path: string, params: Record<string, unknown>) =>
  params.account_id ? { inherit: false, times: ['18:30'] } : { inherit: false, times: ['09:00', '12:00'] })) {
  const props = reactive({ active: true, businessPlatform: 'x', accountId: 'a', accounts: undefined,
    modelValue: { inherit: true, times: [] as string[] }, ...options })
  const emit = vi.fn((event: string, value: unknown) => { if (event === 'update:modelValue') props.modelValue = value as typeof props.modelValue })
  let unmount = () => {}
  const values = { defineProps: () => props, defineEmits: () => emit, computed, ref, watch,
    onBeforeUnmount: (fn: () => void) => { unmount = fn }, http: { get },
    getErrorMessage: (err: Error) => err.message }
  const state = new Function(...Object.keys(values), `${compiled}; return { addTime, removeTime, updateTime, ready, loaded, error, load, inherit };`)(...Object.values(values))
  return { props, emit, get, state, unmount: () => unmount() }
}

describe('监听回复时间', () => {
  it('回显现有账号独立时间，并展示对应 App 默认时间', async () => {
    const s = setup()
    await flush()
    expect(s.props.modelValue).toEqual({ inherit: false, times: ['18:30'] })
    expect(s.state.ready.value).toBe(true)
    expect(s.get).toHaveBeenCalledWith(expect.any(String), { business_platform: 'x', account_id: 'a' })
    s.state.inherit.value = true
    await flush()
    expect(s.state.ready.value).toBe(true)
  })

  it('默认时间为空时不能开启，切换自定义并添加时间后才有效', async () => {
    const s = setup({}, vi.fn(async () => ({ inherit: true, times: [] })))
    await flush()
    expect(s.state.ready.value).toBe(false)
    s.state.inherit.value = false
    s.state.addTime()
    await flush()
    expect(s.props.modelValue.times).toEqual(['09:00'])
    expect(s.state.ready.value).toBe(true)
    s.state.removeTime(0)
    await flush()
    expect(s.state.ready.value).toBe(false)
  })

  it('跨 App 批量继承各自默认时间，任何 App 未配置都需改为自定义', async () => {
    const s = setup({ accountId: '', accounts: [{ account_id: 'a', business_platform: 'x' }, { account_id: 'b', business_platform: 'threads' }] },
      vi.fn(async (_path, params) => ({ inherit: false, times: params.business_platform === 'x' ? ['09:00'] : [] })))
    await flush()
    expect(s.props.modelValue.inherit).toBe(true)
    expect(s.get).toHaveBeenCalledTimes(2)
    expect(s.state.ready.value).toBe(false)
    s.state.inherit.value = false
    s.state.addTime()
    await flush()
    expect(s.state.ready.value).toBe(true)
  })

  it('切换账号后不使用旧账号晚到的回复时间', async () => {
    let old!: (value: { inherit: boolean; times: string[] }) => void
    const get = vi.fn(async (_path, params) => params.account_id === 'a'
      ? new Promise<{ inherit: boolean; times: string[] }>(done => { old = done }) : { inherit: false, times: ['12:00'] })
    const s = setup({}, get)
    await flush()
    s.props.accountId = 'b'
    await flush()
    expect(s.props.modelValue.times).toEqual(['12:00'])
    old({ inherit: false, times: ['23:00'] })
    await flush()
    expect(s.props.modelValue.times).toEqual(['12:00'])
  })

  it('加载失败不能保存，重新加载后恢复', async () => {
    const get = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ inherit: true, times: ['09:00'] })
    const s = setup({}, get)
    await flush()
    expect(s.state.ready.value).toBe(false)
    expect(s.state.error.value).toBe('offline')
    await s.state.load()
    await flush()
    expect(s.state.ready.value).toBe(true)
  })

  it('上限为 24 个时间点，关闭窗口取消待返回的配置', async () => {
    const s = setup()
    await flush()
    s.props.modelValue.times = Array(24).fill('09:00')
    s.state.addTime()
    expect(s.props.modelValue.times).toHaveLength(24)
    s.props.active = false
    await flush()
    expect(s.state.ready.value).toBe(false)
  })
})
