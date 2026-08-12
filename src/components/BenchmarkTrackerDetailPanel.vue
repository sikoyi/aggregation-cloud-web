<script setup lang="ts">
import {
  ExternalLink,
  FileText,
  Image as ImageIcon,
  RefreshCw,
  Video,
} from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import { ApiError, http, resolveBackendUrl } from '@/api/http'
import type { AnyRecord, PageResult } from '@/types/api'
import { formatDate } from '@/utils/format'
import { notifyError } from '@/utils/notify'

const props = defineProps<{
  account: AnyRecord
}>()

const trackerLoading = ref(false)
const postLoading = ref(false)
const tracker = ref<AnyRecord | null>(null)
const posts = ref<AnyRecord[]>([])
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)

const accountId = computed(() => String(props.account?.id || props.account?.account_id || ''))
const mappingCounts = computed<AnyRecord>(() => {
  const value = tracker.value?.mapping_counts
  return value && typeof value === 'object' ? value as AnyRecord : {}
})
const mappedCount = computed(() => Number(mappingCounts.value.published || 0))
const failedCount = computed(() => (
  Number(mappingCounts.value.publish_failed || 0)
  + Number(mappingCounts.value.delete_failed || 0)
))
const pendingCount = computed(() => (
  Number(mappingCounts.value.pending_publish || 0)
  + Number(mappingCounts.value.publishing || 0)
  + Number(mappingCounts.value.awaiting_capture || 0)
  + Number(mappingCounts.value.pending_delete || 0)
  + Number(mappingCounts.value.deleting || 0)
))

const mappingStatusOptions: Record<string, { label: string; type: 'success' | 'warning' | 'danger' | 'info' | 'primary' }> = {
  baseline: { label: '历史基线', type: 'info' },
  pending_publish: { label: '待复刻', type: 'warning' },
  publishing: { label: '复刻中', type: 'primary' },
  awaiting_capture: { label: '等待监听同步', type: 'warning' },
  published: { label: '已复刻', type: 'success' },
  publish_failed: { label: '复刻失败', type: 'danger' },
  unsupported: { label: '暂不支持', type: 'info' },
  source_deleted: { label: '源帖已删除', type: 'info' },
  pending_delete: { label: '待同步删除', type: 'warning' },
  deleting: { label: '同步删除中', type: 'primary' },
  deleted: { label: '已同步删除', type: 'success' },
  delete_failed: { label: '删除同步失败', type: 'danger' },
}

function statusMeta(value: unknown) {
  return mappingStatusOptions[String(value || '')] || { label: String(value || '未知'), type: 'info' as const }
}

function snapshot(row: AnyRecord) {
  return (row.source_snapshot && typeof row.source_snapshot === 'object')
    ? row.source_snapshot as AnyRecord
    : {}
}

function sourceUrl(row: AnyRecord) {
  return String(row.source_content_url || snapshot(row).content_url || '').trim()
}

function sourceText(row: AnyRecord) {
  return String(snapshot(row).text_content || '').trim()
}

function sourcePublishedAt(row: AnyRecord) {
  return snapshot(row).published_at
}

function mediaUrls(row: AnyRecord) {
  const values = snapshot(row).media_urls
  return Array.isArray(values) ? values.map((value) => resolveBackendUrl(value)).filter(Boolean) : []
}

function isImageUrl(url: string) {
  return /\.(png|jpe?g|webp|gif|bmp|svg)(\?|#|$)/i.test(url)
}

function isVideoUrl(url: string) {
  return /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(url)
}

function mediaKind(row: AnyRecord) {
  const urls = mediaUrls(row)
  if (!urls.length) return ''
  if (urls.some(isVideoUrl)) return 'video'
  if (urls.some(isImageUrl)) return 'image'
  return 'file'
}

function trackerStatusLabel(value: unknown) {
  const labels: Record<string, string> = {
    active: '跟踪中',
    paused: '已关闭',
    abnormal: '跟踪异常',
  }
  return labels[String(value || '')] || String(value || '等待首次采集')
}

function trackerStatusType(value: unknown) {
  if (value === 'active') return 'success'
  if (value === 'abnormal') return 'danger'
  return 'info'
}

async function loadTracker() {
  const requestedAccountId = accountId.value
  if (!requestedAccountId) return false
  trackerLoading.value = true
  try {
    const data = await http.get<AnyRecord>(
      `/api/benchmark-trackers/accounts/${encodeURIComponent(requestedAccountId)}`,
    )
    if (accountId.value !== requestedAccountId) return false
    tracker.value = data
    return true
  } catch (err) {
    if (accountId.value !== requestedAccountId) return false
    tracker.value = null
    // 未配置对标跟踪是正常空状态，不向运营弹出错误通知。
    if (err instanceof ApiError && err.status === 404) return false
    notifyError(err, '加载对标资料失败', '无法读取对标账号资料')
    return false
  } finally {
    if (accountId.value === requestedAccountId) trackerLoading.value = false
  }
}

async function loadPosts() {
  const requestedAccountId = accountId.value
  if (!requestedAccountId) return
  postLoading.value = true
  try {
    const data = await http.get<PageResult<AnyRecord>>(
      `/api/benchmark-trackers/accounts/${encodeURIComponent(requestedAccountId)}/mappings`,
      {
        page: page.value,
        page_size: pageSize.value,
      },
    )
    if (accountId.value !== requestedAccountId) return
    posts.value = data.items
    total.value = data.total
  } catch (err) {
    if (accountId.value !== requestedAccountId) return
    posts.value = []
    total.value = 0
    notifyError(err, '加载对标帖子失败', '无法读取对标账号帖子')
  } finally {
    if (accountId.value === requestedAccountId) postLoading.value = false
  }
}

async function refreshAll() {
  const trackerExists = await loadTracker()
  if (trackerExists) await loadPosts()
}
function handleSizeChange(size: number) {
  pageSize.value = size
  page.value = 1
  void loadPosts()
}

watch(
  accountId,
  () => {
    page.value = 1
    tracker.value = null
    posts.value = []
    total.value = 0
    void refreshAll()
  },
  { immediate: true },
)
</script>

<template>
  <div class="benchmark-detail">
    <div v-loading="trackerLoading" class="benchmark-profile">
      <template v-if="tracker">
        <el-avatar
          :size="72"
          :src="tracker.source_avatar_url ? resolveBackendUrl(tracker.source_avatar_url) : undefined"
          class="benchmark-profile__avatar"
        >
          {{ String(tracker.source_display_name || tracker.source_username || 'B').slice(0, 1).toUpperCase() }}
        </el-avatar>

        <div class="benchmark-profile__main">
          <div class="benchmark-profile__identity">
            <strong>{{ tracker.source_display_name || tracker.source_username || '等待首次采集' }}</strong>
            <span v-if="tracker.source_username">@{{ tracker.source_username }}</span>
          </div>
          <p>{{ tracker.source_biography || '该账号暂未采集到简介' }}</p>
          <div class="benchmark-profile__links">
            <el-link
              v-if="tracker.source_profile_url"
              :href="String(tracker.source_profile_url)"
              target="_blank"
              type="primary"
              :icon="ExternalLink"
            >
              打开对标主页
            </el-link>
            <span v-if="tracker.source_platform_account_id">
              平台账号 ID：{{ tracker.source_platform_account_id }}
            </span>
          </div>
        </div>

        <div class="benchmark-profile__status">
          <el-tag :type="trackerStatusType(tracker.status)" effect="light">
            {{ trackerStatusLabel(tracker.status) }}
          </el-tag>
          <span>最近采集 {{ formatDate(tracker.last_success_at) }}</span>
          <span>下次采集 {{ formatDate(tracker.next_run_at) }}</span>
        </div>
      </template>
      <el-empty v-else-if="!trackerLoading" :image-size="70" description="该账号尚未配置对标跟踪" />
    </div>

    <template v-if="tracker">
      <div class="benchmark-summary">
        <div>
          <span>已采集帖子</span>
          <strong>{{ total }}</strong>
        </div>
        <div>
          <span>已完成复刻</span>
          <strong>{{ mappedCount }}</strong>
        </div>
        <div>
          <span>同步处理中</span>
          <strong>{{ pendingCount }}</strong>
        </div>
        <div>
          <span>同步失败</span>
          <strong :class="{ 'is-danger': failedCount > 0 }">{{ failedCount }}</strong>
        </div>
      </div>

      <div class="benchmark-posts__header">
        <div>
          <strong>对标账号帖子</strong>
          <span>展示采集到的原帖内容，以及当前账号的复刻和删除同步结果。</span>
        </div>
        <el-button :icon="RefreshCw" :loading="trackerLoading || postLoading" @click="refreshAll">
          刷新
        </el-button>
      </div>

      <el-table
        v-loading="postLoading"
        :data="posts"
        border
        stripe
        table-layout="fixed"
        empty-text="暂未采集到帖子"
      >
        <el-table-column label="原帖子" min-width="360">
          <template #default="{ row }">
            <div class="source-post">
              <div class="source-post__media">
                <el-image
                  v-if="mediaKind(row) === 'image'"
                  :src="mediaUrls(row)[0]"
                  :preview-src-list="mediaUrls(row)"
                  preview-teleported
                  fit="cover"
                >
                  <template #error><ImageIcon :size="18" /></template>
                </el-image>
                <Video v-else-if="mediaKind(row) === 'video'" :size="20" />
                <FileText v-else :size="20" />
                <small v-if="mediaUrls(row).length > 1">+{{ mediaUrls(row).length - 1 }}</small>
              </div>
              <div class="source-post__content">
                <p :title="sourceText(row)">{{ sourceText(row) || '仅包含媒体内容' }}</p>
                <div>
                  <span>{{ row.source_platform_content_id || '无平台帖子 ID' }}</span>
                  <el-link
                    v-if="sourceUrl(row)"
                    :href="sourceUrl(row)"
                    target="_blank"
                    type="primary"
                    :icon="ExternalLink"
                  >
                    查看原帖
                  </el-link>
                </div>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="发布时间" width="170" align="center">
          <template #default="{ row }">{{ formatDate(sourcePublishedAt(row)) }}</template>
        </el-table-column>

        <el-table-column label="复刻状态" width="130" align="center">
          <template #default="{ row }">
            <el-tag :type="statusMeta(row.status).type" effect="light">
              {{ statusMeta(row.status).label }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="目标帖子" min-width="220">
          <template #default="{ row }">
            <div class="target-post">
              <el-link
                v-if="row.target_content_url"
                :href="String(row.target_content_url)"
                target="_blank"
                type="primary"
                :icon="ExternalLink"
              >
                打开目标帖子
              </el-link>
              <span v-else-if="row.status === 'awaiting_capture'">等待目标账号下一轮监听补齐</span>
              <span v-else>尚未生成目标帖子</span>
              <small v-if="row.target_platform_content_id">
                {{ row.target_platform_content_id }}
              </small>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="同步信息" min-width="210">
          <template #default="{ row }">
            <div class="sync-info">
              <span>最近采集 {{ formatDate(row.last_seen_at) }}</span>
              <span v-if="row.deleted_at">删除时间 {{ formatDate(row.deleted_at) }}</span>
              <el-text v-if="row.error_message" type="danger" truncated :title="String(row.error_message)">
                {{ row.error_message }}
              </el-text>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="benchmark-posts__pagination">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          background
          layout="total, sizes, prev, pager, next"
          :page-sizes="[10, 20, 50]"
          :total="total"
          @current-change="loadPosts"
          @size-change="handleSizeChange"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.benchmark-detail {
  min-width: 0;
}

.benchmark-profile {
  display: flex;
  min-height: 120px;
  align-items: center;
  gap: 16px;
  border: 1px solid #dbe5ef;
  border-radius: 8px;
  padding: 18px;
  background: #f8fbfe;
}

.benchmark-profile__avatar {
  flex: none;
  border: 1px solid #cfe0ef;
  background: #eaf4fb;
  color: #256894;
  font-size: 24px;
  font-weight: 700;
}

.benchmark-profile__main {
  min-width: 0;
  flex: 1;
}

.benchmark-profile__identity {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.benchmark-profile__identity strong {
  color: #102a43;
  font-size: 18px;
}

.benchmark-profile__identity span,
.benchmark-profile__main p,
.benchmark-profile__links,
.benchmark-profile__status span {
  color: #627d98;
  font-size: 12px;
}

.benchmark-profile__main p {
  margin: 8px 0;
  line-height: 1.7;
  white-space: pre-wrap;
}

.benchmark-profile__links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
}

.benchmark-profile__status {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.benchmark-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin: 14px 0;
}

.benchmark-summary > div {
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 12px 14px;
  background: #fff;
}

.benchmark-summary span {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.benchmark-summary strong {
  display: block;
  margin-top: 5px;
  color: #102a43;
  font-size: 22px;
}

.benchmark-summary strong.is-danger {
  color: #dc2626;
}

.benchmark-posts__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.benchmark-posts__header > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.benchmark-posts__header strong {
  color: #102a43;
  font-size: 15px;
}

.benchmark-posts__header span {
  color: #64748b;
  font-size: 12px;
}

.source-post {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
  padding: 3px 0;
}

.source-post__media {
  position: relative;
  display: flex;
  width: 54px;
  height: 54px;
  flex: none;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid #dbe5ef;
  border-radius: 6px;
  background: #f4f8fb;
  color: #5c7892;
}

.source-post__media :deep(.el-image) {
  width: 100%;
  height: 100%;
}

.source-post__media small {
  position: absolute;
  right: 2px;
  bottom: 2px;
  border-radius: 3px;
  padding: 0 4px;
  background: rgb(15 23 42 / 72%);
  color: #fff;
  font-size: 10px;
}

.source-post__content {
  min-width: 0;
  flex: 1;
}

.source-post__content p {
  display: -webkit-box;
  overflow: hidden;
  margin: 0 0 7px;
  color: #243b53;
  line-height: 1.55;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.source-post__content > div {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  color: #829ab1;
  font-size: 11px;
}

.source-post__content > div > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.target-post,
.sync-info {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
}

.target-post > span,
.target-post small,
.sync-info > span {
  color: #64748b;
  font-size: 12px;
}

.target-post small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.benchmark-posts__pagination {
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
}

@media (max-width: 900px) {
  .benchmark-profile {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .benchmark-profile__status {
    width: 100%;
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
  }

  .benchmark-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
