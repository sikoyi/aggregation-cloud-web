<script setup lang="ts">
import {
  ExternalLink,
  Eye,
  FileText,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  Play,
  RefreshCw,
  Share2,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { http, resolveBackendUrl } from '@/api/http'
import PublishedContentDetailDialog from '@/components/PublishedContentDetailDialog.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { REALTIME_EVENT_NAME, type RealtimeEventPayload } from '@/composables/useRealtimeEvents'
import {
  publishedContentStatusOptions,
  publishedContentTypeOptions,
} from '@/config/options'
import type { AnyRecord, PageResult } from '@/types/api'
import { formatDate, truncateId } from '@/utils/format'
import { notifyError } from '@/utils/notify'

const props = defineProps<{
  account: AnyRecord
}>()

const loading = ref(false)
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const rows = ref<AnyRecord[]>([])
const detailVisible = ref(false)
const detailId = ref<string | null>(null)
let realtimeRefreshTimer: number | undefined

const accountId = computed(() => String(props.account?.id || ''))
const accountName = computed(() =>
  String(
    props.account?.login_username
      || props.account?.username
      || props.account?.display_name
      || props.account?.id
      || '-',
  ),
)

function optionLabel(options: { label: string; value: string | number | boolean }[], value: unknown) {
  const option = options.find((item) => String(item.value) === String(value || ''))
  return option?.label || String(value || '-')
}

function contentTitle(row: AnyRecord) {
  const title = String(row.title || '').trim()
  if (title) return title
  const body = String(row.text_content || '').trim().replace(/\s+/g, ' ')
  return body ? body.slice(0, 60) : '无标题内容'
}

function contentExcerpt(row: AnyRecord) {
  const body = String(row.text_content || '').trim()
  if (!body || body === String(row.title || '').trim()) return '暂无正文内容'
  return body
}

function mediaUrls(row: AnyRecord) {
  if (!Array.isArray(row.media_urls)) return []
  return row.media_urls
    .map((value) => resolveBackendUrl(value))
    .filter(Boolean)
}

function isVideoMedia(row: AnyRecord, url: string) {
  return String(row.content_type || '').toLowerCase() === 'video'
    || /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(url)
}

function isImageMedia(row: AnyRecord, url: string) {
  if (isVideoMedia(row, url)) return false
  const type = String(row.content_type || '').toLowerCase()
  return ['image', 'mixed', 'post', 'thread', 'note'].includes(type)
    || /\.(png|jpe?g|webp|gif|bmp|svg)(\?|#|$)/i.test(url)
}

function imagePreviewUrls(row: AnyRecord) {
  return mediaUrls(row).filter((url) => isImageMedia(row, url))
}

function countText(value: unknown) {
  const count = Number(value || 0)
  if (!Number.isFinite(count)) return '0'
  return Math.max(0, Math.trunc(count)).toLocaleString('zh-CN')
}

async function loadRows() {
  if (!accountId.value) return
  loading.value = true
  try {
    const data = await http.get<PageResult<AnyRecord>>('/api/interaction-center/published-contents', {
      author_account_id: accountId.value,
      page: page.value,
      page_size: pageSize.value,
    })
    rows.value = data.items
    total.value = data.total
  } catch (err) {
    notifyError(err, '加载发布内容失败', '加载账号发布内容失败')
  } finally {
    loading.value = false
  }
}

function openDetail(row: AnyRecord) {
  detailId.value = String(row.id || '')
  detailVisible.value = true
}

function handleSizeChange(size: number) {
  pageSize.value = size
  page.value = 1
  loadRows()
}

function handleRealtimeEvent(event: Event) {
  const payload = (event as CustomEvent<RealtimeEventPayload>).detail
  if (!payload || payload.topic !== 'content_monitor') return
  if (payload.resource_type === 'social_account' && String(payload.resource_id || '') !== accountId.value) return
  if (realtimeRefreshTimer) window.clearTimeout(realtimeRefreshTimer)
  realtimeRefreshTimer = window.setTimeout(loadRows, 500)
}

watch(
  accountId,
  () => {
    page.value = 1
    rows.value = []
    total.value = 0
    loadRows()
  },
  { immediate: true },
)

onMounted(() => window.addEventListener(REALTIME_EVENT_NAME, handleRealtimeEvent))

onBeforeUnmount(() => {
  window.removeEventListener(REALTIME_EVENT_NAME, handleRealtimeEvent)
  if (realtimeRefreshTimer) window.clearTimeout(realtimeRefreshTimer)
})
</script>

<template>
  <div class="account-published-content">
    <div class="account-published-content__header">
      <div>
        <div class="account-published-content__title">账号内容</div>
        <div class="account-published-content__subtitle">
          当前账号：{{ accountName }} · 共 {{ total }} 条内容
        </div>
      </div>
      <el-button :icon="RefreshCw" :loading="loading" @click="loadRows">刷新</el-button>
    </div>

    <el-table
      v-loading="loading"
      :data="rows"
      border
      table-layout="fixed"
      row-key="id"
      class="account-published-content__table"
      empty-text="该账号暂无内容"
    >
      <el-table-column label="ID" width="74" align="center">
        <template #default="{ row }">
          <span class="font-mono text-xs" :title="String(row.id || '')">{{ truncateId(row.id) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="内容信息" min-width="330">
        <template #default="{ row }">
          <div class="content-summary">
            <strong :title="contentTitle(row)">{{ contentTitle(row) }}</strong>
            <p :title="contentExcerpt(row)">{{ contentExcerpt(row) }}</p>
            <div class="content-summary__meta">
              <el-tag size="small" effect="plain" type="info">
                {{ optionLabel(publishedContentTypeOptions, row.content_type) }}
              </el-tag>
              <el-link
                v-if="row.content_url"
                :href="String(row.content_url)"
                target="_blank"
                type="primary"
                :icon="ExternalLink"
              >
                打开原帖
              </el-link>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="媒体" width="104" align="center">
        <template #default="{ row }">
          <div v-if="mediaUrls(row).length" class="content-media">
            <el-image
              v-if="isImageMedia(row, mediaUrls(row)[0])"
              :src="mediaUrls(row)[0]"
              :preview-src-list="imagePreviewUrls(row)"
              preview-teleported
              fit="cover"
            />
            <button
              v-else-if="isVideoMedia(row, mediaUrls(row)[0])"
              type="button"
              class="content-media__video"
              aria-label="查看视频详情"
              @click="openDetail(row)"
            >
              <video :src="mediaUrls(row)[0]" muted playsinline preload="metadata" />
              <span><Play :size="16" /></span>
            </button>
            <div v-else class="content-media__placeholder">
              <FileText :size="22" />
            </div>
            <span v-if="mediaUrls(row).length > 1" class="content-media__count">
              +{{ mediaUrls(row).length - 1 }}
            </span>
          </div>
          <div v-else class="content-media__empty">
            <ImageIcon :size="18" />
            <span>无媒体</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="互动数据" min-width="260">
        <template #default="{ row }">
          <div class="content-metrics">
            <div title="浏览数">
              <Eye :size="15" />
              <span>浏览</span>
              <strong>{{ countText(row.view_count) }}</strong>
            </div>
            <div title="点赞数">
              <Heart :size="15" />
              <span>点赞</span>
              <strong>{{ countText(row.like_count) }}</strong>
            </div>
            <div title="评论数">
              <MessageCircle :size="15" />
              <span>评论</span>
              <strong>{{ countText(row.comment_count) }}</strong>
            </div>
            <div title="分享数">
              <Share2 :size="15" />
              <span>分享</span>
              <strong>{{ countText(row.share_count) }}</strong>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="状态 / 时间" min-width="190">
        <template #default="{ row }">
          <div class="content-state">
            <div>
              <StatusBadge :value="row.status" />
              <span class="sr-only">{{ optionLabel(publishedContentStatusOptions, row.status) }}</span>
            </div>
            <span><em>发布</em>{{ formatDate(row.published_at) }}</span>
            <span><em>采集</em>{{ formatDate(row.last_collected_at) }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="88" align="center" fixed="right">
        <template #default="{ row }">
          <el-tooltip content="查看详情" placement="top">
            <el-button text type="primary" :icon="Eye" @click="openDetail(row)">详情</el-button>
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>

    <div class="account-published-content__pagination">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        background
        layout="total, sizes, prev, pager, next"
        :page-sizes="[10, 20, 50]"
        :total="total"
        @current-change="loadRows"
        @size-change="handleSizeChange"
      />
    </div>

    <PublishedContentDetailDialog
      v-model="detailVisible"
      :content-id="detailId"
    />
  </div>
</template>

<style scoped>
.account-published-content {
  min-width: 0;
}

.account-published-content__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.account-published-content__title {
  color: #0f172a;
  font-size: 15px;
  font-weight: 700;
}

.account-published-content__subtitle {
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
}

.account-published-content__pagination {
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
}

.content-summary {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  padding: 5px 0;
}

.content-summary > strong {
  display: block;
  overflow: hidden;
  color: #102a43;
  font-size: 14px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.content-summary > p {
  display: -webkit-box;
  overflow: hidden;
  margin: 6px 0 8px;
  color: #526d82;
  font-size: 12px;
  line-height: 1.55;
  word-break: break-word;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.content-summary__meta {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
}

.content-summary__meta :deep(.el-link) {
  margin-left: 2px;
  font-size: 12px;
}

.content-media {
  position: relative;
  width: 68px;
  height: 62px;
  margin: 0 auto;
  overflow: hidden;
  border: 1px solid #dbe5ef;
  border-radius: 6px;
  background: #f4f8fb;
}

.content-media :deep(.el-image),
.content-media__video,
.content-media__video video,
.content-media__placeholder {
  width: 100%;
  height: 100%;
}

.content-media__video {
  position: relative;
  display: block;
  padding: 0;
  overflow: hidden;
  border: 0;
  cursor: pointer;
  background: #0f172a;
}

.content-media__video video {
  object-fit: cover;
}

.content-media__video span {
  position: absolute;
  inset: 50% auto auto 50%;
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #fff;
  background: rgb(15 23 42 / 74%);
  transform: translate(-50%, -50%);
}

.content-media__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #829ab1;
}

.content-media__count {
  position: absolute;
  right: 3px;
  bottom: 3px;
  border-radius: 3px;
  padding: 1px 5px;
  color: #fff;
  background: rgb(15 23 42 / 76%);
  font-size: 10px;
  line-height: 16px;
}

.content-media__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: #9fb3c8;
  font-size: 11px;
}

.content-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(104px, 1fr));
  gap: 7px;
}

.content-metrics > div {
  display: grid;
  grid-template-columns: 18px 34px minmax(28px, 1fr);
  align-items: center;
  border-radius: 5px;
  padding: 6px 8px;
  color: #526d82;
  background: #f5f8fb;
  font-size: 12px;
}

.content-metrics > div > strong {
  overflow: hidden;
  color: #102a43;
  font-size: 13px;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.content-state {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 4px 0;
}

.content-state > span {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  gap: 6px;
  color: #526d82;
  font-size: 12px;
  line-height: 1.4;
}

.content-state em {
  color: #829ab1;
  font-style: normal;
}

.account-published-content__table :deep(.el-table__cell) {
  padding: 10px 0;
}

.account-published-content__table :deep(.el-table__row:hover > td.el-table__cell) {
  background: #f7fbff;
}

@media (max-width: 900px) {
  .account-published-content__header {
    align-items: flex-start;
  }

  .account-published-content__pagination {
    overflow-x: auto;
  }
}
</style>
