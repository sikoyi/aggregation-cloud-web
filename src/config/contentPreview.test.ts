import { describe, expect, it } from 'vitest'

import { resources } from './resources'


describe('内容库预览', () => {
  it('列表和编辑弹窗均启用内容预览', () => {
    const textColumn = resources.contents.columns.find((column) => column.type === 'contentTextPreview')
    const mediaColumn = resources.contents.columns.find((column) => column.type === 'contentMediaPreview')

    expect(textColumn?.key).toBe('text_body')
    expect(textColumn?.label).toBe('正文预览')
    expect(mediaColumn?.key).toBe('material_assets')
    expect(mediaColumn?.label).toBe('媒体资源')
    expect(resources.contents.editPreview).toBe('content')
  })
})
