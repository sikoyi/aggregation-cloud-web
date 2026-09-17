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
    expect(source).toMatch(/width="min\(92vw, 860px\)"\r?\n\s+align-center/)
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

  it('设备分组使用紧凑标签并为长名称保留完整提示', () => {
    expect(source).toContain('<Layers3 v-if="scope.row.slot_group_name"')
    expect(source).toContain(':content="String(scope.row.slot_group_name || \'未分组\')"')
    expect(source).toContain("account-overview__group--empty': !scope.row.slot_group_name")
    expect(source).toContain('text-overflow: ellipsis;')
  })

  it('横向展示账号的核心监听指标', () => {
    const overviewMetrics = source.split('const overviewMetricColumns = [')[1]?.split(']')[0] || ''
    for (const key of [
      'followers_count',
      'following_count',
      'posts_count',
      'total_likes_count',
    ]) {
      expect(overviewMetrics).toContain(`valueKey: '${key}'`)
    }
    expect(overviewMetrics).not.toContain('total_replies_count')
    expect(source).toContain("{ label: '总回复', value: account.total_replies_count")
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

  it('支持批量设置回复方式和帖子同步，并跳过未配置账号', () => {
    const overview = source.split('<section v-if="viewMode === \'overview\'"')[1]?.split('</section>')[0] || ''
    expect(overview).toContain('<el-table-column type="selection"')
    expect(overview).toContain('@selection-change="handleOverviewSelectionChange"')
    expect(overview).toContain('@command="batchUpdateCommentReplyMode"')
    expect(overview).toContain('@command="batchUpdatePostSyncMode"')
    expect(overview).toContain('批量设置回复方式')
    expect(overview).toContain('批量设置帖子同步')
    expect(source).toContain('/api/accounts/data-overview/comment-reply-mode/batch')
    expect(source).toContain('/api/accounts/data-overview/post-sync-mode/batch')
    expect(source).toContain('未配置的账号会跳过')
    expect(source).toContain('跳过 ${data.skipped_count} 个未配置账号')
  })
})
