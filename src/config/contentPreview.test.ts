import { describe, expect, it } from 'vitest'

import { resources } from './resources'


describe('内容库预览', () => {
  it('列表保留内容预览，新增和编辑使用图片预览选择器', () => {
    const textColumn = resources.contents.columns.find((column) => column.type === 'contentTextPreview')
    const mediaColumn = resources.contents.columns.find((column) => column.type === 'contentMediaPreview')
    const createMaterialField = resources.contents.createFields?.find((field) => field.key === 'material_asset_ids')
    const editMaterialField = resources.contents.updateFields?.find((field) => field.key === 'material_asset_ids')

    expect(textColumn?.key).toBe('text_body')
    expect(textColumn?.label).toBe('正文预览')
    expect(mediaColumn?.key).toBe('material_assets')
    expect(mediaColumn?.label).toBe('媒体资源')
    expect(createMaterialField?.type).toBe('imagePreviewPicker')
    expect(editMaterialField?.type).toBe('imagePreviewPicker')
    expect(resources.contents.editPreview).toBeUndefined()
  })
})
