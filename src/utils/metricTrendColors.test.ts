import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import accounts from '../views/AccountDataView.vue?raw'
import external from '../components/ExternalAccountMonitors.vue?raw'
import published from '../components/PublishedContentDetailDialog.vue?raw'

describe('数据涨跌统一红涨绿跌', () => {
  it.each([
    ['账号总览', accounts, '.account-overview__metric span'],
    ['账号详情', accounts, '.account-profile__delta'],
    ['外部账号', external, '.external-metric-delta'],
  ])('%s 的正负增量配色一致', (_, source, selector) => {
    expect(source).toContain(`${selector}.is-up { color: var(--app-red, #cf4f4f); }`)
    expect(source).toContain(`${selector}.is-down { color: var(--app-green, #238457); }`)
  })
  it('发布内容趋势标签上升红色、下降绿色、其他中性', () => {
    const ast = ts.createSourceFile('trend.ts', published.split('<script setup lang="ts">')[1]!.split('</script>')[0]!, ts.ScriptTarget.Latest, true)
    const fn = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'trendType')!
    const compiled = ts.transpileModule(fn.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
    const trendType = new Function(`${compiled}; return trendType;`)()
    expect(trendType('up')).toBe('danger')
    expect(trendType('down')).toBe('success')
    for (const value of ['flat', 'unknown', '', null]) expect(trendType(value)).toBe('info')
  })
})
