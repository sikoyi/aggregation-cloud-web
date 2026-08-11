import type { AnyRecord } from '@/types/api'

export type LibraryContentType = 'text' | 'image' | 'video' | 'mixed'

export function contentMaterialAssetType(contentType: unknown) {
  if (contentType === 'image' || contentType === 'video') return contentType
  return undefined
}

export function contentMaterialSelectionLimit(contentType: unknown) {
  return contentType === 'video' ? 1 : undefined
}

export function contentMaterialMatchesContext(asset: AnyRecord, context?: AnyRecord) {
  const contentType = String(context?.content_type || 'text')
  const assetType = String(asset.asset_type || '')
  if (!['image', 'video'].includes(assetType)) return false
  if (contentType === 'image' && assetType !== 'image') return false
  if (contentType === 'video' && assetType !== 'video') return false
  return (
    asset.status === 'enabled'
    && (!context?.business_platform || asset.business_platform === context.business_platform)
  )
}

export function contentMaterialPickerTitle(contentType: unknown) {
  if (contentType === 'image') return '选择图片素材'
  if (contentType === 'video') return '选择视频素材'
  return '选择图片或视频素材'
}

export function contentMaterialItemLabel(contentType: unknown) {
  if (contentType === 'image') return '张图片'
  if (contentType === 'video') return '个视频'
  return '个素材'
}

export function contentMaterialEmptyText(contentType: unknown) {
  if (contentType === 'image') return '当前业务 App 下暂无可用图片，请先在素材库上传'
  if (contentType === 'video') return '当前业务 App 下暂无可用视频，请先在素材库上传'
  return '当前业务 App 下暂无可用图片或视频，请先在素材库上传'
}