import { describe, expect, it } from 'vitest'

import { resources } from './resources'
import { buildFormState, buildPayload } from '@/utils/form'


describe('内容库预览与类型约束', () => {
  it('列表保留正文与媒体预览，新增和编辑使用媒体预览选择器', () => {
    const textColumn = resources.contents.columns.find((column) => column.type === 'contentTextPreview')
    const mediaColumn = resources.contents.columns.find((column) => column.type === 'contentMediaPreview')
    const createMaterialField = resources.contents.createFields?.find((field) => field.key === 'material_asset_ids')
    const editMaterialField = resources.contents.updateFields?.find((field) => field.key === 'material_asset_ids')

    expect(textColumn?.key).toBe('text_body')
    expect(textColumn?.label).toBe('正文预览')
    expect(mediaColumn?.key).toBe('material_assets')
    expect(mediaColumn?.label).toBe('媒体资源')
    expect(createMaterialField?.type).toBe('mediaPreviewPicker')
    expect(editMaterialField?.type).toBe('mediaPreviewPicker')
    expect(resources.contents.editPreview).toBeUndefined()
  })

  it('文本隐藏并清空素材，图片视频和混合内容显示素材选择器', () => {
    const createMaterialField = resources.contents.createFields?.find((field) => field.key === 'material_asset_ids')
    const editMaterialField = resources.contents.updateFields?.find((field) => field.key === 'material_asset_ids')
    const createTextField = resources.contents.createFields?.find((field) => field.key === 'text_body')
    const editTextField = resources.contents.updateFields?.find((field) => field.key === 'text_body')

    expect(createMaterialField?.visibleWhen?.value).toEqual(['image', 'video', 'mixed'])
    expect(createMaterialField?.requiredWhen?.value).toEqual(['image', 'video', 'mixed'])
    expect(createMaterialField?.clearWhenHidden).toBe(true)
    expect(editMaterialField?.clearWhenHidden).toBe(true)
    expect(createTextField?.requiredWhen?.value).toEqual(['text'])
    expect(editTextField?.requiredWhen?.value).toEqual(['text'])
  })

  it.each(['image', 'video'])('%s 内容创建可省略正文，编辑可以明确清空正文', (contentType) => {
    const createFields = resources.contents.createFields!
    const createState = buildFormState(createFields)
    Object.assign(createState, { content_type: contentType, title: '媒体内容', material_asset_ids: ['asset-1'] })
    expect(buildPayload(createFields, createState, 'create')).toMatchObject({
      content_type: contentType, material_asset_ids: ['asset-1'],
    })
    expect(buildPayload(createFields, createState, 'create')).not.toHaveProperty('text_body')

    const editFields = resources.contents.updateFields!
    const editState = buildFormState(editFields, { ...createState, text_body: '原有正文' })
    editState.text_body = ''
    expect(buildPayload(editFields, editState, 'update')).toMatchObject({
      content_type: contentType, material_asset_ids: ['asset-1'], text_body: '',
    })
  })

  it('视频只能选择一个视频，混合内容可选择图片和视频', () => {
    const materialField = resources.contents.createFields?.find((field) => field.key === 'material_asset_ids')
    const remote = materialField?.remote
    const videoContext = { content_type: 'video', business_platform: 'threads' }
    const mixedContext = { content_type: 'mixed', business_platform: 'threads' }

    expect(typeof remote?.selectionLimit).toBe('function')
    expect(typeof remote?.matchesContext).toBe('function')
    expect(typeof remote?.params).toBe('function')
    expect((remote?.selectionLimit as Function)(videoContext)).toBe(1)
    expect((remote?.selectionLimit as Function)(mixedContext)).toBeUndefined()
    expect((remote?.params as Function)(videoContext)).toMatchObject({ asset_type: 'video' })
    expect((remote?.matchesContext as Function)(
      { asset_type: 'image', status: 'enabled', business_platform: 'threads' },
      mixedContext,
    )).toBe(true)
    expect((remote?.matchesContext as Function)(
      { asset_type: 'image', status: 'enabled', business_platform: 'threads' },
      videoContext,
    )).toBe(false)
  })
})
