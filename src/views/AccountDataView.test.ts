import { describe, expect, it } from 'vitest'

import source from './AccountDataView.vue?raw'

describe('账号数据聚合总览', () => {
  it('总览展示帖子同步方式、暂停状态并提供服务端筛选', () => {
    expect(source).toContain("benchmark_post_sync_mode: ''")
    expect(source).toContain('v-model="filters.benchmark_post_sync_mode"')
    expect(source).toContain('<el-table-column label="帖子同步"')
    expect(source).toContain("if (!account.benchmark_tracker_id) return 'not_configured'")
    expect(source).toContain('scope.row.benchmark_enabled === false')
    expect(source).toContain('对标已暂停')
    for (const label of ['未配置对标', '不发布', '自动发布', '审核后发布']) {
      expect(source).toContain(`label: '${label}'`)
    }
  })
  it('账号身份放大并保留长文本边界', () => {
    expect(source).toContain('font-size: 16px; line-height: 1.5;')
    expect(source).toContain('font-size: 14px; line-height: 1.5;')
    expect(source).toContain(':size="88"')
    expect(source).toContain('font-size: 16px; overflow-wrap: anywhere;')
  })
  it('支持监听创建时间正反排序，默认最新添加在前', () => {
    expect(source).toContain("sort_order: 'desc'")
    expect(source).toContain('v-model="filters.sort_order" @change="searchRows"')
    expect(source).toContain('label="最新添加在前" value="desc"')
    expect(source).toContain('label="最早添加在前" value="asc"')
    expect(source).toContain("key !== 'sort_order'")
  })
  it('监听弹窗账号选择器自然撑高，仅保留树列表内部滚动', () => {
    expect(source).toContain('width="min(92vw, 860px)"\n      align-center')
    expect(source).toContain('.monitor-dialog-account { align-self: start; }')
    expect(source).toContain('.monitor-dialog-account :deep(.account-tree-select) { max-height: none; overflow: visible; }')
    expect(source).not.toContain('.monitor-dialog-account { max-height: 510px; overflow: auto; }')
  })
  it('默认按账号展示总览并保留详情钻取', () => {
    expect(source).toContain("const viewMode = ref<'overview' | 'detail'>('overview')")
    expect(source).toContain("<section v-if=\"viewMode === 'overview'\" class=\"account-overview\">")
    expect(source).toContain("viewMode.value = 'detail'")
    expect(source).toContain('class="account-overview__identity"')
    expect(source).toContain('flex: 0 0 48px')
  })

  it('支持设备分组和账号标签两个独立筛选条件', () => {
    expect(source).toContain('v-model="filters.slot_group_id"')
    expect(source).toContain('v-model="filters.tag_id"')
    expect(source).toContain('设备分组：{{ activeSlotGroupName }}')
    expect(source).toContain('账号标签：{{ activeAccountTagName }}')
  })

  it('将四项核心指标合并为紧凑宫格并从总览隐藏总回复', () => {
    for (const key of [
      'followers_count',
      'following_count',
      'posts_count',
      'total_likes_count',
    ]) {
      expect(source).toContain(`valueKey: '${key}'`)
    }
    const overviewMetrics = source.split('const overviewMetricColumns = [')[1]?.split('\n]')[0] || ''
    expect(overviewMetrics).not.toContain('total_replies_count')
    expect(source).toContain('<el-table-column label="账号指标" width="290"')
    expect(source).toContain('class="account-overview__metrics-grid"')
    expect(source).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));')
    expect(source).toContain('compactMetricDeltaLabel(scope.row[metric.deltaKey])')
    expect(source).toContain(':data="rows"')
    expect(source).toContain('metrics_captured_at')
  })

  it('总览展示并筛选四种评论回复方式', () => {
    expect(source).toContain("{ label: '未开启监听', value: 'not_configured' }")
    expect(source).toContain("{ label: '不自动回复', value: 'disabled' }")
    expect(source).toContain("{ label: '自动回复', value: 'automatic' }")
    expect(source).toContain("{ label: '审核后回复', value: 'review' }")
    expect(source).toContain('<el-form-item label="回复方式">')
    expect(source).toContain('v-model="filters.comment_reply_mode"')

    const overview = source.split('<section v-if="viewMode === \'overview\'"')[1]?.split('</section>')[0] || ''
    expect(overview).toContain('<el-table-column label="回复方式"')
    expect(overview).toContain('resolveReplyState(scope.row)')
    expect(source).toContain("if (!account?.monitor_setting_id) return 'not_configured'")
    expect(source).toContain("return String(account?.comment_reply_mode || 'disabled')")
  })

  it('总览逐行复用监听设置入口并保留查看详情，不切换到详情视图', () => {
    const overview = source.split('<section v-if="viewMode === \'overview\'"')[1]?.split('</section>')[0] || ''
    expect(overview).toContain('@click="openMonitor(scope.row)"')
    expect(overview).toContain('@click="openAccountDetail(scope.row)"')
    expect(overview).toContain('aria-label="监听设置"')
    expect(overview).toContain('content="监听设置"')
    expect(overview).toContain('label="操作" width="112" fixed="right"')
    expect(overview).toContain('class="account-overview__actions"')

    const openMonitor = source.split('function openMonitor(account?: AnyRecord) {')[1]?.split('\nasync function ')[0] || ''
    expect(openMonitor).toContain('monitorTargetAccount.value = account || null')
    expect(openMonitor).toContain('account_id: String(account?.account_id')
    expect(openMonitor).toContain('business_platform: String(account?.business_platform')
    expect(openMonitor).toContain('monitorVisible.value = true')
    expect(openMonitor).not.toContain('viewMode.value =')
    expect(openMonitor).not.toContain('http.post')
  })
})
