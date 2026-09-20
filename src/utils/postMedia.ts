export function isVideoCover(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (!['cdninstagram.com', 'fbcdn.net'].some(domain => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`))) return false
    const encoded = parsed.searchParams.get('efg') || ''
    if (!encoded || encoded.length > 8192) return false
    const metadata = JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof metadata?.vencode_tag === 'string' && metadata.vencode_tag.split('.').includes('video_first_frame_thumbnail')
  } catch {
    return false
  }
}

export function withoutVideoCovers<T extends { source_url?: unknown; asset_type?: unknown }>(assets: T[]): T[] {
  if (!assets.some(asset => asset.asset_type === 'video')) return assets
  return assets.filter(asset => asset.asset_type === 'video' || !isVideoCover(String(asset.source_url || '')))
}
