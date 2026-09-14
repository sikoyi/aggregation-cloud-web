import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import source from './ExternalAccountDetail.vue?raw'

const ast = ts.createSourceFile('Detail.ts', source.split('<script setup lang="ts">')[1]!.split('</script>')[0]!, ts.ScriptTarget.Latest, true)
const functions = ast.statements.filter(ts.isFunctionDeclaration).map(node => node.getText(ast)).join('\n')
const js = ts.transpileModule(functions, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const { count, postPreview } = new Function(`${js}; return {count, postPreview}`)()

describe('外部账号详情展示', () => {
  it('缺失和异常值不冒充零，零值正常展示', () => {
    for (const value of [null, undefined, '', 'invalid', Infinity]) expect(count(value)).toBe('--')
    expect(count(0)).toBe('0')
    expect(count(1234)).toBe('1,234')
  })
  it('沿用媒体预览结构，过滤不安全地址并保留完整正文', () => {
    const text = '正文'.repeat(500)
    const result = postPreview({ source_key: 'p', report: { text_content: text, media_urls: [
      'https://example.com/image.jpg', 'https://example.com/clip.mp4?signature=fixture',
      'javascript:alert(1)', 'https://user:pass@example.com/a.jpg',
    ] } })
    expect(result.text_body).toBe(text)
    expect(result.material_assets.map((x: {asset_type: string}) => x.asset_type)).toEqual(['image', 'video'])
    expect(result.material_asset_ids).toBeUndefined()
  })
  it('空资料与媒体数组缺失仍能渲染', () => {
    expect(postPreview({})).toEqual({ text_body: '无文字内容', material_assets: [] })
    expect(postPreview({report: {media_urls: 'invalid'}}).material_assets).toEqual([])
  })
  it('账号指标与本轮采集统计分开，不展示内部绑定或回复操作', () => {
    const metricBlock = source.slice(source.indexOf('const metrics'), source.indexOf('function safeUrl'))
    expect(metricBlock).not.toContain('collected_')
    expect(source).toContain('本轮帖子点赞合计')
    expect(source).toContain('本轮采集帖子')
    expect(source).toContain('ContentPreview')
    expect(source).not.toContain('login_status')
    expect(source).not.toContain('bound_slot_id')
    expect(source).not.toContain('http.')
  })
})
