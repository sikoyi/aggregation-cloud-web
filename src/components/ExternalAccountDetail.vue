<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ExternalLink, Heart, MessageCircle, UserRound } from 'lucide-vue-next'
import ContentPreview from '@/components/ContentPreview.vue'
import CompactFollowerCount from '@/components/CompactFollowerCount.vue'
import { formatDate } from '@/utils/format'
import { externalMonitorProgress, externalMonitorStatus, type ExternalCollectionProgress } from '@/utils/externalMonitorProgress'
import type { AnyRecord } from '@/types/api'

const props = defineProps<{
  detail: { monitor: {
    id: string; profile?: AnyRecord; profile_url: string; business_platform: string;
    status: string; enabled: boolean; interval_minutes: number; remark?: string;
    activity_status?: string; collection_progress?: ExternalCollectionProgress;
    last_success_at?: unknown; next_run_at?: unknown; last_error?: string;
  }; posts: AnyRecord[]; total: number; snapshots: AnyRecord[] }
  page: number
}>()
const emit = defineEmits<{ 'update:page': [value: number] }>()
const tab = ref('posts')
const profile = computed<AnyRecord>(() => props.detail.monitor.profile || {})
const metrics = computed(() => [
  { label: '粉丝', value: profile.value.followers_count },
  { label: '关注', value: profile.value.following_count },
  { label: '帖子', value: profile.value.posts_count },
])
function safeUrl(value: unknown) {
  try { const url = new URL(String(value)); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : '' } catch { return '' }
}
function count(value: unknown) {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return '--'
  return Number(value).toLocaleString('zh-CN')
}
function postPreview(row: AnyRecord) {
  const report = (row.report || {}) as AnyRecord
  const urls: string[] = Array.isArray(report.media_urls) ? report.media_urls.map(safeUrl).filter(Boolean) : []
  return {
    text_body: report.text_content || report.title || '无文字内容',
    material_assets: urls.map((url, index) => ({
      id: `${row.source_key}-${index}`, source_url: url, name: `媒体 ${index + 1}`,
      asset_type: /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i.test(url) || report.content_type === 'video' ? 'video' : 'image',
    })),
  }
}
watch(() => props.detail.monitor.id, () => { tab.value = 'posts' })
</script>

<template>
  <div class="external-account-detail">
    <header class="external-profile">
      <el-avatar :size="72" :src="safeUrl(profile.avatar_url)" class="external-profile__avatar"><UserRound :size="28" /></el-avatar>
      <div class="external-profile__identity">
        <h2>{{ profile.display_name || profile.username || detail.monitor.profile_url.split('/').pop() }}</h2>
        <div class="external-profile__handle">{{ profile.username ? '@' + String(profile.username).replace(/^@/, '') : '暂未采集公开用户名' }}</div>
        <p class="external-profile__bio">{{ profile.biography || '暂未采集到账号简介' }}</p>
        <div class="external-profile__tags">
          <el-tag effect="plain">{{ detail.monitor.business_platform === 'x' ? 'X(Twitter)' : 'Threads' }}</el-tag>
          <el-tag :type="(detail.monitor.activity_status || detail.monitor.status) === 'active' ? 'success' : (detail.monitor.activity_status || detail.monitor.status) === 'retrying' ? 'warning' : 'info'">{{ externalMonitorStatus(detail.monitor) }}</el-tag>
        </div>
      </div>
      <el-link v-if="safeUrl(detail.monitor.profile_url)" class="external-detail-link" :href="safeUrl(detail.monitor.profile_url)" target="_blank" rel="noopener noreferrer" type="primary" :icon="ExternalLink">打开主页</el-link>
    </header>
    <div class="external-profile__metrics">
      <div v-for="metric in metrics" :key="metric.label"><small>{{ metric.label }}</small><strong><CompactFollowerCount v-if="metric.label === '粉丝'" :key="detail.monitor.id" :value="metric.value" /><template v-else>{{ count(metric.value) }}</template></strong></div>
    </div>
    <div class="external-profile__metadata">
      <span>最近整轮成功 <strong>{{ formatDate(detail.monitor.last_success_at) }}</strong></span>
      <span v-if="externalMonitorProgress(detail.monitor.collection_progress)">当前阶段 <strong>{{ externalMonitorProgress(detail.monitor.collection_progress) }}</strong></span>
      <span v-if="detail.monitor.collection_progress?.last_progress_at">最近进展 <strong>{{ formatDate(detail.monitor.collection_progress.last_progress_at) }}</strong></span>
      <span>监听间隔 <strong>{{ detail.monitor.interval_minutes }} 分钟</strong></span>
      <span>下次采集 <strong>{{ detail.monitor.enabled ? formatDate(detail.monitor.next_run_at) : '-' }}</strong></span>
    </div>
    <p v-if="detail.monitor.remark" class="external-profile__remark">备注：{{ detail.monitor.remark }}</p>
    <el-alert v-if="detail.monitor.last_error" :title="detail.monitor.last_error" type="warning" :closable="false" show-icon />
    <el-tabs v-model="tab" class="external-detail-tabs">
      <el-tab-pane label="采集帖子" name="posts">
        <div class="external-posts__heading"><strong>账号内容</strong><span>已采集 {{ count(detail.total) }} 条</span></div>
        <el-table :data="detail.posts" row-key="source_key" border stripe table-layout="fixed" empty-text="暂无已采集帖子">
          <el-table-column type="expand" width="44"><template #default="{ row }">
            <div class="external-post-expanded">
              <ContentPreview :record="postPreview(row)" mode="full" />
            </div>
          </template></el-table-column>
          <el-table-column label="内容信息" min-width="300"><template #default="{ row }">
            <ContentPreview :record="postPreview(row)" section="text" />
            <el-link v-if="safeUrl(row.content_url)" class="external-detail-link external-post-link" :href="safeUrl(row.content_url)" target="_blank" rel="noopener noreferrer" type="primary" :icon="ExternalLink">打开原帖</el-link>
          </template></el-table-column>
          <el-table-column label="媒体" width="128" align="center"><template #default="{ row }"><ContentPreview :record="postPreview(row)" section="media" /></template></el-table-column>
          <el-table-column label="互动数据" width="166"><template #default="{ row }">
            <div class="external-post-metrics"><span><Heart :size="14" />点赞<strong>{{ count(row.report?.metrics?.like_count) }}</strong></span><span><MessageCircle :size="14" />评论<strong>{{ count(row.report?.metrics?.comment_count) }}</strong></span></div>
          </template></el-table-column>
          <el-table-column label="时间" width="230"><template #default="{ row }">
            <div class="external-post-time"><div><small>发布</small><span>{{ formatDate(row.report?.published_at) }}</span></div><div><small>最近采集</small><span>{{ formatDate(row.updated_at) }}</span></div></div>
          </template></el-table-column>
        </el-table>
        <div class="external-detail-pagination"><el-pagination :current-page="page" :page-size="20" :total="detail.total" background layout="total, prev, pager, next" :pager-count="5" @current-change="emit('update:page', $event)" /></div>
      </el-tab-pane>
      <el-tab-pane label="最近采集记录" name="snapshots">
        <el-table :data="detail.snapshots" border stripe table-layout="fixed" empty-text="暂无采集记录">
          <el-table-column label="采集时间" width="180"><template #default="{ row }">{{ formatDate(row.captured_at) }}</template></el-table-column>
          <el-table-column label="粉丝" min-width="100" align="right"><template #default="{ row }"><CompactFollowerCount :key="row.captured_at" :value="row.metrics?.followers_count" /></template></el-table-column>
          <el-table-column label="关注" min-width="100" align="right"><template #default="{ row }">{{ count(row.metrics?.following_count) }}</template></el-table-column>
          <el-table-column label="账号帖子数" min-width="110" align="right"><template #default="{ row }">{{ count(row.metrics?.posts_count) }}</template></el-table-column>
          <el-table-column label="本轮采集帖子" min-width="125" align="right"><template #default="{ row }">{{ count(row.metrics?.collected_post_count) }}</template></el-table-column>
          <el-table-column label="本轮帖子点赞合计" min-width="150" align="right"><template #default="{ row }">{{ count(row.metrics?.collected_like_count) }}</template></el-table-column>
          <el-table-column label="本轮帖子评论合计" min-width="150" align="right"><template #default="{ row }">{{ count(row.metrics?.collected_comment_count) }}</template></el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.external-account-detail { min-width: 0; }
.external-profile { display: flex; align-items: flex-start; gap: 16px; padding: 4px 0 20px; }
.external-profile__avatar { flex-shrink: 0; background: var(--app-surface-muted, #eef7fc); color: var(--app-blue, #316589); }
.external-profile__identity { flex: 1; min-width: 0; }
.external-profile h2 { font-size: 20px; line-height: 1.4; margin: 0; color: var(--app-text, #20384d); overflow-wrap: anywhere; }
.external-profile__handle { margin-top: 4px; font-size: 12px; color: var(--app-text-muted, #718096); overflow-wrap: anywhere; }
.external-profile__bio, .external-profile__remark { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.6; font-size: 13px; }
.external-profile__bio { margin: 8px 0 10px; }
.external-profile__tags { display: flex; gap: 8px; flex-wrap: wrap; }
.external-detail-link { display: inline-flex; align-items: center; flex: 0 0 auto; gap: 5px; white-space: nowrap; }
.external-detail-link :deep(.el-link__inner) { display: inline-flex; align-items: center; gap: 5px; }
.external-profile__metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); background: var(--app-surface-muted, #f6f9fc); border-block: 1px solid var(--app-border, #dce5ed); }
.external-profile__metrics > div { padding: 16px 20px; border-right: 1px solid var(--app-border, #dce5ed); min-width: 0; }
.external-profile__metrics > div:last-child { border: 0; }
.external-profile__metrics small { display: block; color: var(--app-text-muted, #718096); font-size: 12px; }
.external-profile__metrics strong { display: block; margin-top: 5px; font-size: 22px; color: var(--app-text, #20384d); overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
.external-profile__metadata { display: flex; flex-wrap: wrap; gap: 10px 24px; margin: 14px 0; font-size: 12px; color: var(--app-text-muted, #718096); }
.external-profile__metadata strong { margin-left: 6px; font-weight: 400; color: var(--app-text, #40566c); }
.external-detail-tabs :deep(.el-tabs__content) { overflow: visible; }
.external-posts__heading { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 12px; font-size: 13px; }
.external-posts__heading span { color: var(--app-text-muted, #718096); }
.external-post-link { margin-top: 10px; }
.external-post-metrics { display: grid; gap: 9px; font-size: 12px; }
.external-post-metrics > span { display: flex; align-items: center; gap: 6px; color: var(--app-text-muted, #718096); }
.external-post-metrics strong { margin-left: auto; color: var(--app-text, #20384d); font-variant-numeric: tabular-nums; }
.external-post-metrics svg { flex-shrink: 0; }
.external-post-time { display: grid; gap: 8px; font-size: 12px; }
.external-post-time > div { display: grid; grid-template-columns: 48px minmax(0, 1fr); align-items: baseline; gap: 8px; white-space: nowrap; }
.external-post-time small { color: var(--app-text-muted, #718096); }
.external-post-expanded { padding: 16px 24px; max-width: calc(96vw - 64px); }
.external-detail-pagination { display: flex; justify-content: flex-end; padding-top: 16px; overflow-x: auto; }
@media (max-width: 600px) {
  .external-profile { flex-wrap: wrap; gap: 12px; }
  .external-profile__identity { min-width: 160px; }
  .external-profile__metrics > div { padding: 12px 8px; }
  .external-profile__metrics strong { font-size: 18px; }
  .external-post-expanded { padding: 12px; }
}
</style>
