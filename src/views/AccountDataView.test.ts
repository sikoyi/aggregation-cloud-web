import { describe, expect, it, vi } from 'vitest'
import { transpile } from 'typescript'

import source from './AccountDataView.vue?raw'

describe('账号数据聚合总览', () => {
  it('账号资料展示绑定设备名称，未绑定有占位，长名称可悬停查看', () => {
    expect(source).toContain('<small>设备名称</small>')
    expect(source).toContain(':title="String(selectedAccount.bound_slot_name || \'未绑定设备\')"')
    expect(source).toContain("{{ selectedAccount.bound_slot_name || '未绑定设备' }}")
  })
  it('统计卡片与外部监听的尺寸和选中态一致', () => {
    const summary = source.split('<div class="account-data__summary">')[1]?.split('<div class="account-data__filters">')[0] || ''
    expect(summary.match(/:size="20"/g)).toHaveLength(5)
    expect(summary.match(/:aria-pressed=/g)).toHaveLength(5)
    expect(summary).toContain("'is-active': !filters.monitor_state")
    const style = source.split('.summary-item {')[1]?.split('}')[0] || ''
    expect(style).toContain('min-height: 64px')
    expect(style).toContain('padding: 12px')
    expect(source).toContain('.summary-item small { color: var(--app-text-muted, #66788a); font-size: 12px; }')
    expect(source).toContain('.summary-item strong { font-size: 20px; line-height: 1.3;')
    expect(source).toContain('.account-data__summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }')
  })
  it('批量操作栏常驻，空选或提交中禁止操作，选中后启用', () => {
    expect(source).toContain('<div class="account-overview__batch-bar">')
    expect(source).not.toContain('<div v-if="selectedAccountIds.length" class="account-overview__batch-bar">')
    expect(source).toContain('computed(() => !selectedAccountIds.value.length || batchUpdating.value)')
    const toolbar = source.split('<div class="account-overview__batch-bar">')[1]?.split('<el-table')[0] || ''
    expect(toolbar.match(/:disabled="batchActionsDisabled"/g)).toHaveLength(6)
    expect(toolbar).not.toContain('取消选择')
    expect(source).toContain('<el-table-column type="selection"')
    const openDialog = source.split('function openBatchMonitorInterval() {')[1]?.split('\n}')[0] || ''
    expect(openDialog).toContain('if (batchActionsDisabled.value) return')
  })
  it('粉丝、浏览量和总点赞统一缩写展示并点击查看完整数量', () => {
    expect(source).toContain('<CompactFollowerCount :key="scope.row.account_id" :value="scope.row[metric.valueKey]" :label="metric.label" />')
    expect(source).toContain('<CompactFollowerCount v-if="metric.compact"')
    const profileMetrics = source.split('const profileMetricItems = computed(() => {')[1]?.split('})')[0] || ''
    for (const label of ['粉丝', '帖子总浏览量', '总点赞']) {
      expect(profileMetrics.split('\n').find(line => line.includes(`label: '${label}'`))).toContain('compact: true')
    }
    expect(profileMetrics.split('\n').find(line => line.includes("label: '总回复'"))).not.toContain('compact: true')
  })
  it('指标数字和日增量使用清晰字号，增量样式不影响浏览量数字', () => {
    expect(source).toContain('font-size: 16px; line-height: 24px; font-variant-numeric: tabular-nums;')
    expect(source).toContain('class="account-overview__delta"')
    const deltaStyle = source.split('.account-overview__delta {')[1]?.split('}')[0] || ''
    expect(deltaStyle).toContain('font-size: 12px;')
    expect(deltaStyle).toContain('line-height: 18px;')
    expect(source).not.toContain('.account-overview__metric span {')
  })
  it('浏览量在总览和详情展示日增量，缺失与异常回落不伪装成持平', () => {
    expect(source).toContain("deltaKey: 'total_post_views_day_delta'")
    expect(source).toContain('delta: account.total_post_views_day_delta')
    expect(source).toContain("value === null || value === undefined || value === ''")
    expect(source).toContain("if (mode === 'views') return { icon: AlertTriangle, label: '数据待核对'")
    expect(source).not.toContain('v-if="!metric.hint"')
  })
  it('在账号数据页直接提供平台评论禁回时段入口', () => {
    expect(source).toContain("import CommentReplyQuietSettingsDialog from '@/components/CommentReplyQuietSettingsDialog.vue'")
    expect(source).toContain("auth.canAny(['system_settings.view', 'system_settings.edit'])")
    expect(source).toContain("auth.can('system_settings.edit')")
    expect(source).toContain('@click="replyQuietSettingsVisible = true"')
    expect(source).toContain('评论禁回时段')
    expect(source).toContain('v-model="replyQuietSettingsVisible"')
    expect(source).toContain(':editable="auth.can(\'system_settings.edit\')"')
  })

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
    expect(source).toContain('.account-overview__account small { margin-top: 4px; color: var(--app-text-muted, #7b8b9b); font-size: 11px; line-height: 1.5; }')
    expect(source).toContain(':size="88"')
    expect(source).toContain('font-size: 16px; overflow-wrap: anywhere;')
  })
  it('支持监听创建时间正反排序，默认最新添加在前', () => {
    expect(source).toContain("sort_order: 'desc'")
    expect(source).toContain("sort_by: 'monitor_created_at'")
    expect(source).toContain('v-model="monitorSortOrder" placeholder="按表头排序" @change="searchRows"')
    expect(source).toContain('label="最新添加在前" value="desc"')
    expect(source).toContain('label="最早添加在前" value="asc"')
    expect(source).toContain("key !== 'sort_order'")
    expect(source).toContain("key !== 'sort_by'")
    expect(source).toContain('overviewTableRef.value?.clearSort()')
    expect(source).not.toContain('label="数据排序"')
  })
  it('指标表头使用服务端排序并恢复已保存的排序箭头', () => {
    expect(source).toContain(':prop="metric.valueKey"')
    expect(source).toContain('sortable="custom"')
    expect(source).toContain(':sort-orders="[\'descending\', \'ascending\', null]"')
    expect(source).toContain('@sort-change="handleOverviewSortChange"')
    expect(source).toContain(':default-sort="overviewDefaultSort"')
  })
  it('点击表头升降序和取消排序均保留联合筛选并重新查询', () => {
    const fields = ['followers_count', 'total_post_views_count', 'total_likes_count']
    const original = { business_platform: 'threads', slot_group_id: '12', monitor_state: 'monitoring', keyword: 'test' }
    const filters = { ...original, sort_by: 'monitor_created_at', sort_order: 'desc' }
    const searchRows = vi.fn()
    const handlerSource = source.slice(source.indexOf('function handleOverviewSortChange('), source.indexOf('\nfunction resetFilters()'))
    const handleSort = new Function('filters', 'overviewMetricColumns', 'searchRows',
      `${transpile(handlerSource)}; return handleOverviewSortChange;`)(filters, fields.map(valueKey => ({ valueKey })), searchRows)
    for (const prop of fields) {
      for (const [order, direction] of [['descending', 'desc'], ['ascending', 'asc']] as const) {
        handleSort({ prop, order })
        expect(filters).toEqual({ ...original, sort_by: prop, sort_order: direction })
      }
    }
    handleSort({ prop: fields[0], order: null })
    expect(filters).toEqual({ ...original, sort_by: 'monitor_created_at', sort_order: 'desc' })
    expect(searchRows).toHaveBeenCalledTimes(7)
    handleSort({ prop: 'unsupported', order: 'descending' })
    expect(searchRows).toHaveBeenCalledTimes(7)
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

  it('离开总览时同步清空表格勾选和批量操作状态', () => {
    expect(source).toMatch(/watch\(viewMode, \(mode\) => \{\r?\n\s+if \(mode !== 'overview'\) clearOverviewSelection\(\)\r?\n\}\)/)

    const clearSelection = source.split('function clearOverviewSelection() {')[1]?.split('\n}')[0] || ''
    expect(clearSelection).toContain('overviewTableRef.value?.clearSelection()')
    expect(clearSelection).toContain('selectedAccounts.value = []')
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
      'total_post_views_count',
      'total_likes_count',
    ]) {
      expect(overviewMetrics).toContain(`valueKey: '${key}'`)
    }
    expect(overviewMetrics).not.toContain('total_replies_count')
    expect(overviewMetrics).not.toContain("valueKey: 'following_count'")
    expect(overviewMetrics).not.toContain("valueKey: 'posts_count'")
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

  it('支持批量开启监听、设置监听间隔、回复方式和帖子同步，并跳过不符合条件的账号', () => {
    const overview = source.split('<section v-if="viewMode === \'overview\'"')[1]?.split('</section>')[0] || ''
    expect(overview).toContain('<el-table-column type="selection"')
    expect(overview).toContain('@selection-change="handleOverviewSelectionChange"')
    expect(overview).toContain('@click="openBatchMonitorInterval"')
    expect(overview).toContain('@click="batchEnableMonitors"')
    expect(overview).toContain('@command="batchUpdateCommentReplyMode"')
    expect(overview).toContain('@command="batchUpdatePostSyncMode"')
    expect(overview).toContain('批量设置监听间隔')
    expect(overview).toContain('批量开启监听')
    expect(overview).toContain('批量设置回复方式')
    expect(overview).toContain('批量设置帖子同步')
    expect(source).toContain('/api/accounts/data-overview/monitor-interval/batch')
    expect(source).toContain('/api/accounts/data-overview/monitor-enable/batch')
    expect(source).toContain('/api/accounts/data-overview/comment-reply-mode/batch')
    expect(source).toContain('/api/accounts/data-overview/post-sync-mode/batch')
    expect(source).toContain("batchIntervalForm.monitor_mode === 'custom'")
    expect(source).toContain('只修改已有账号数据监听，未配置账号会跳过')
    expect(source).toContain('未配置的账号会跳过')
    expect(source).toContain('跳过 ${data.skipped_count} 个未配置账号')
    expect(source).toContain('异常或已关闭')
  })
})
