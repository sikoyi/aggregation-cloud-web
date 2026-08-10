import { describe, expect, it } from 'vitest'

import { resources } from './resources'


describe('内容库预览', () => {
  it('列表和编辑弹窗均启用内容预览', () => {
    const previewColumn = resources.contents.columns.find((column) => column.type === 'contentPreview')

    expect(previewColumn?.key).toBe('text_body')
    expect(previewColumn?.label).toBe('内容预览')
    expect(resources.contents.editPreview).toBe('content')
  })
})
