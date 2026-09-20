import { describe, expect, it, vi } from 'vitest'
import { externalAvatarUrl } from './externalAvatar'
import list from '@/components/ExternalAccountMonitors.vue?raw'
import detail from '@/components/ExternalAccountDetail.vue?raw'

vi.mock('@/api/http', () => ({ resolveBackendUrl: (value: string) => `https://app.test${value}` }))

describe('外部账号头像', () => {
  it('列表和详情均支持系统缓存路径', () => {
    expect(externalAvatarUrl('/media/test/photo.jpg')).toBe('https://app.test/media/test/photo.jpg')
    expect(list).toContain(':src="externalAvatarUrl(row.profile.avatar_url)"')
    expect(detail).toContain(':src="externalAvatarUrl(profile.avatar_url)"')
  })
  it('保留公开图片链接，拒绝危险地址', () => {
    expect(externalAvatarUrl('https://pbs.twimg.com/photo.jpg')).toBe('https://pbs.twimg.com/photo.jpg')
    for (const value of [null, '', 'javascript:alert(1)', 'data:image/svg+xml,test', '//evil.test/photo', '/media/../api', '/media/\\evil', 'https://user:pass@example.test/photo']) {
      expect(externalAvatarUrl(value)).toBe('')
    }
  })
})
