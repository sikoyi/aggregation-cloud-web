import { describe, expect, it } from 'vitest'

import source from './AccountDataView.vue?raw'

describe('账号数据聚合总览', () => {
  it('默认按账号展示总览并保留详情钻取', () => {
    expect(source).toContain("const viewMode = ref<'overview' | 'detail'>('overview')")
    expect(source).toContain("<section v-if=\"viewMode === 'overview'\" class=\"account-overview\">")
    expect(source).toContain("viewMode.value = 'detail'")
    expect(source).toContain('class="account-overview__identity"')
    expect(source).toContain('flex: 0 0 38px')
  })

  it('支持设备分组和账号标签两个独立筛选条件', () => {
    expect(source).toContain('v-model="filters.slot_group_id"')
    expect(source).toContain('v-model="filters.tag_id"')
    expect(source).toContain('设备分组：{{ activeSlotGroupName }}')
    expect(source).toContain('账号标签：{{ activeAccountTagName }}')
  })

  it('横向展示账号的核心监听指标', () => {
    for (const key of [
      'followers_count',
      'following_count',
      'posts_count',
      'total_likes_count',
      'total_replies_count',
    ]) {
      expect(source).toContain(`valueKey: '${key}'`)
    }
    expect(source).toContain(':data="rows"')
    expect(source).toContain('metrics_captured_at')
  })
})
