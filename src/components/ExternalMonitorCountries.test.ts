import { describe, expect, it, vi } from 'vitest'
import ts from 'typescript'
import source from './ExternalMonitorCountries.vue?raw'
import selector from './ExternalCountrySelect.vue?raw'
import parent from './ExternalAccountMonitors.vue?raw'

function setup() {
  const ast = ts.createSourceFile('countries.ts', source.split('<script setup lang="ts">')[1]!.split('</script>')[0]!, ts.ScriptTarget.Latest, true)
  const functions = ast.statements.filter(ts.isFunctionDeclaration).map(n => n.getText(ast)).join('\n')
  const state = {
    busy: { value: false }, loading: { value: false }, error: { value: '' }, visible: { value: false }, selected: { value: '日本' },
    config: { value: { countries: ['韩国'], version: 3 } }, emit: vi.fn(),
    http: { get: vi.fn().mockResolvedValue({ countries: ['美国'], version: 4 }), put: vi.fn().mockResolvedValue({ countries: ['韩国', '日本'], version: 4 }) },
    ElMessageBox: { confirm: vi.fn().mockResolvedValue('confirm') }, ElNotification: { success: vi.fn(), error: vi.fn() },
  }
  const compiled = ts.transpileModule(functions, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const save = new Function(...Object.keys(state), `${compiled}; return save;`)(...Object.values(state)) as (remove?: string) => Promise<void>
  return { ...state, save }
}

describe('外部账号常用国家', () => {
  it('保存共享国家及版本，不修改账号', async () => {
    const s = setup(); await s.save()
    expect(s.http.put).toHaveBeenCalledWith('/api/external-account-monitors/country-options', { countries: ['韩国', '日本'], expected_version: 3 })
    expect(s.emit).toHaveBeenCalledWith('changed')
  })
  it('移除需要确认，取消不提交', async () => {
    const s = setup(); s.ElMessageBox.confirm.mockRejectedValueOnce('cancel'); await s.save('韩国')
    expect(s.http.put).not.toHaveBeenCalled()
    await s.save('韩国')
    expect(s.http.put).toHaveBeenCalledWith(expect.anything(), { countries: [], expected_version: 3 })
  })
  it('版本冲突后刷新，不盲目重试覆盖', async () => {
    const s = setup(); s.http.put.mockRejectedValueOnce(new Error('配置已变化')); await s.save()
    expect(s.http.put).toHaveBeenCalledTimes(1)
    expect(s.config.value).toEqual({ countries: ['美国'], version: 4 })
    expect(s.busy.value).toBe(false)
  })
  it('忙碌、加载、空选择不提交', async () => {
    const s = setup(); s.busy.value = true; await s.save(); s.busy.value = false
    s.loading.value = true; await s.save(); s.loading.value = false
    s.selected.value = ''; await s.save(); expect(s.http.put).not.toHaveBeenCalled()
  })
  it('限制系统目录，历史国家保留，管理入口遵守编辑权限', () => {
    expect(source).toContain('accountCountryOptions.filter')
    expect(source).not.toContain('allow-create')
    expect(selector).toContain('已移出常用')
    expect(selector).not.toContain('accountCountryOptions')
    expect(parent).toContain('<ExternalMonitorCountries v-if="canEdit"')
  })
})
