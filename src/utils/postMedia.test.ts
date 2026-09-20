import { describe, expect, it } from 'vitest'
import { withoutVideoCovers } from './postMedia'
import preview from '@/components/ContentPreview.vue?raw'

describe('video cover preview', () => {
  const marker = btoa(JSON.stringify({ vencode_tag: 'CAROUSEL_ITEM.xpids.640.sdr.video_first_frame_thumbnail.C3' }))
  const cover = { asset_type: 'image', source_url: `https://scontent-hou1-1.cdninstagram.com/cover.jpg?efg=${encodeURIComponent(marker)}` }
  const video = { asset_type: 'video', source_url: 'https://cdn.test/video.mp4' }
  const photo = { asset_type: 'image', source_url: 'https://cdn.test/photo.jpg' }
  it('filters confirmed covers in compact/full previews while retaining real images', () => {
    expect(withoutVideoCovers([video, cover, photo])).toEqual([video, photo])
    expect(preview).toContain('withoutVideoCovers(embeddedAssets.value.length ? embeddedAssets.value : loadedAssets.value)')
  })
  it('preserves image-only posts and unknown metadata', () => {
    expect(withoutVideoCovers([cover, photo])).toEqual([cover, photo])
    const unknown = { ...cover, source_url: 'https://scontent.cdninstagram.com/a.jpg?efg=broken' }
    expect(withoutVideoCovers([video, unknown])).toEqual([video, unknown])
  })
})
