import { describe, expect, it } from 'vitest'

import {
  contentMaterialAssetType,
  contentMaterialEmptyText,
  contentMaterialItemLabel,
  contentMaterialMatchesContext,
  contentMaterialPickerTitle,
  contentMaterialSelectionLimit,
} from './contentTypeRules'


describe('内容类型素材规则', () => {
  const image = {
    id: 'image-1',
    asset_type: 'image',
    status: 'enabled',
    business_platform: 'threads',
  }
  const video = {
    id: 'video-1',
    asset_type: 'video',
    status: 'enabled',
    business_platform: 'threads',
  }

  it('按内容类型限制素材类型和数量', () => {
    expect(contentMaterialAssetType('text')).toBeUndefined()
    expect(contentMaterialAssetType('image')).toBe('image')
    expect(contentMaterialAssetType('video')).toBe('video')
    expect(contentMaterialAssetType('mixed')).toBeUndefined()
    expect(contentMaterialSelectionLimit('video')).toBe(1)
    expect(contentMaterialSelectionLimit('image')).toBeUndefined()
    expect(contentMaterialSelectionLimit('mixed')).toBeUndefined()
  })

  it('按内容类型、状态和业务 App 过滤素材', () => {
    expect(contentMaterialMatchesContext(image, { content_type: 'image', business_platform: 'threads' })).toBe(true)
    expect(contentMaterialMatchesContext(video, { content_type: 'image', business_platform: 'threads' })).toBe(false)
    expect(contentMaterialMatchesContext(video, { content_type: 'video', business_platform: 'threads' })).toBe(true)
    expect(contentMaterialMatchesContext(image, { content_type: 'mixed', business_platform: 'threads' })).toBe(true)
    expect(contentMaterialMatchesContext(video, { content_type: 'mixed', business_platform: 'threads' })).toBe(true)
    expect(contentMaterialMatchesContext({ ...image, status: 'disabled' }, { content_type: 'image' })).toBe(false)
    expect(contentMaterialMatchesContext(image, { content_type: 'image', business_platform: 'instagram' })).toBe(false)
  })

  it('提供随内容类型变化的运营提示', () => {
    expect(contentMaterialPickerTitle('image')).toBe('选择图片素材')
    expect(contentMaterialPickerTitle('video')).toBe('选择视频素材')
    expect(contentMaterialItemLabel('video')).toBe('个视频')
    expect(contentMaterialEmptyText('mixed')).toContain('图片或视频')
  })
})