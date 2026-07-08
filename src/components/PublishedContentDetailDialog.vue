<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

import { http, resolveBackendUrl } from '@/api/http'
import StatusBadge from '@/components/StatusBadge.vue'
import type { AnyRecord } from '@/types/api'
import { formatDate, truncateId } from '@/utils/format'
import { notifyError } from '@/utils/notify'

const props = defineProps<{
  modelValue: boolean
  contentId: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

interface CommentNode extends AnyRecord {
  children: CommentNode[]
}

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const loading = ref(false)
const error = ref('')
const activeTab = ref('basic')
const detail = ref<AnyRecord | null>(null)

const content = computed<AnyRecord | null>(() => {
  const value = detail.value?.content
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : null
})
const metrics = computed<AnyRecord[]>(() => Array.isArray(detail.value?.latest_metrics) ? detail.value.latest_metrics : [])
const comments = computed<AnyRecord[]>(() => Array.isArray(detail.value?.comments) ? detail.value.comments : [])
const actions = computed<AnyRecord[]>(() => Array.isArray(detail.value?.actions) ? detail.value.actions : [])
const contentMediaUrls = computed<string[]>(() => {
  const urls = content.value?.media_urls
  return Array.isArray(urls) ? urls.map(String).filter(Boolean) : []
})
const contentUrl = computed(() => String(content.value?.content_url || '').trim())

const dialogTitle = computed(() => {
  const item = content.value
  if (!item) return '发布内容详情'
  return `发布内容详情：${text(item.title || item.platform_content_id || truncateId(item.id))}`
})

const commentTree = computed<CommentNode[]>(() => {
  const map = new Map<string, CommentNode>()
  const roots: CommentNode[] = []
  comments.value.forEach((comment) => {
    map.set(String(comment.id), { ...comment, children: [] })
  })
  map.forEach((node) => {
    const parentId = String(node.parent_comment_id || '')
    const parent = parentId ? map.get(parentId) : null
    if (parent) parent.children.push(node)
    else roots.push(node)
  })
  return roots
})

function text(value: unknown) {
  return value === undefined || value === null || value === '' ? '-' : String(value)
}

function numberText(value: unknown) {
  return value === undefined || value === null || value === '' ? '0' : String(value)
}

function metricValue(key: string) {
  return numberText(content.value?.[key])
}

function mediaUrl(value: unknown) {
  return resolveBackendUrl(value)
}

function isImageUrl(url: string) {
  return /\.(png|jpe?g|webp|gif|bmp|svg)(\?|#|$)/i.test(url)
}

function isVideoUrl(url: string) {
  return /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(url)
}

async function copyText(value: unknown) {
  const textValue = String(value || '')
  if (!textValue) return
  await navigator.clipboard?.writeText(textValue)
  ElMessage.success('已复制')
}

async function loadDetail(contentId: string) {
  loading.value = true
  error.value = ''
  try {
    detail.value = await http.get<AnyRecord>(`/api/interaction-center/published-contents/${encodeURIComponent(contentId)}`)
  } catch (err) {
    error.value = notifyError(err, '加载失败', '加载发布内容详情失败')
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.modelValue, props.contentId] as const,
  ([open, contentId]) => {
    if (open && contentId) {
      activeTab.value = 'basic'
      loadDetail(contentId)
    }
    if (!open) {
      detail.value = null
      error.value = ''
    }
  },
  { immediate: true },
)
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="dialogTitle"
    width="980px"
    class="published-content-detail-dialog"
    destroy-on-close
    append-to-body
    align-center
  >
    <div v-loading="loading" class="published-content-detail">
      <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="mb-3" />

      <template v-if="content">
        <el-tabs v-model="activeTab">
          <el-tab-pane label="基础信息" name="basic">
            <div class="metric-strip">
              <div class="metric-item">
                <span class="metric-label">评论</span>
                <strong>{{ metricValue('comment_count') }}</strong>
              </div>
              <div class="metric-item">
                <span class="metric-label">点赞</span>
                <strong>{{ metricValue('like_count') }}</strong>
              </div>
              <div class="metric-item">
                <span class="metric-label">分享</span>
                <strong>{{ metricValue('share_count') }}</strong>
              </div>
              <div class="metric-item">
                <span class="metric-label">浏览</span>
                <strong>{{ metricValue('view_count') }}</strong>
              </div>
            </div>

            <el-descriptions :column="2" border>
              <el-descriptions-item label="内容 ID">
                <span class="font-mono text-xs" :title="String(content.id || '')">{{ truncateId(content.id) }}</span>
              </el-descriptions-item>
              <el-descriptions-item label="状态">
                <StatusBadge :value="content.status" />
              </el-descriptions-item>
              <el-descriptions-item label="业务 App">{{ text(content.business_platform) }}</el-descriptions-item>
              <el-descriptions-item label="内容类型">{{ text(content.content_type) }}</el-descriptions-item>
              <el-descriptions-item label="平台内容 ID">
                <el-button v-if="content.platform_content_id" text type="primary" @click="copyText(content.platform_content_id)">
                  {{ content.platform_content_id }}
                </el-button>
                <span v-else>-</span>
              </el-descriptions-item>
              <el-descriptions-item label="发布账号">
                <span class="font-mono text-xs" :title="String(content.author_account_id || '')">{{ truncateId(content.author_account_id) }}</span>
              </el-descriptions-item>
              <el-descriptions-item label="发布时间">{{ formatDate(content.published_at) }}</el-descriptions-item>
              <el-descriptions-item label="最近采集">{{ formatDate(content.last_collected_at) }}</el-descriptions-item>
              <el-descriptions-item label="内容链接" :span="2">
                <el-link v-if="contentUrl" :href="contentUrl" target="_blank" type="primary">
                  {{ contentUrl }}
                </el-link>
                <span v-else>-</span>
              </el-descriptions-item>
              <el-descriptions-item label="正文" :span="2">
                <div class="whitespace-pre-wrap leading-6">{{ text(content.text_content) }}</div>
              </el-descriptions-item>
            </el-descriptions>

            <div v-if="contentMediaUrls.length" class="detail-section">
              <div class="detail-section__title">媒体</div>
              <div class="media-grid">
                <div v-for="url in contentMediaUrls" :key="url" class="media-item">
                  <img v-if="isImageUrl(String(url))" :src="mediaUrl(url)" alt="" />
                  <video v-else-if="isVideoUrl(String(url))" :src="mediaUrl(url)" controls />
                  <el-link v-else :href="mediaUrl(url)" target="_blank" type="primary">{{ url }}</el-link>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="指标快照" name="metrics">
            <el-table :data="metrics" border stripe empty-text="暂无指标快照">
              <el-table-column label="采集时间" min-width="170" align="center">
                <template #default="{ row }">{{ formatDate(row.captured_at) }}</template>
              </el-table-column>
              <el-table-column prop="comment_count" label="评论" width="90" align="center" />
              <el-table-column prop="like_count" label="点赞" width="90" align="center" />
              <el-table-column prop="share_count" label="分享" width="90" align="center" />
              <el-table-column prop="view_count" label="浏览" width="90" align="center" />
              <el-table-column prop="source" label="来源" width="110" align="center" />
              <el-table-column label="任务" width="120" align="center">
                <template #default="{ row }">
                  <span class="font-mono text-xs" :title="String(row.task_run_id || '')">{{ truncateId(row.task_run_id) }}</span>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="评论树" name="comments">
            <el-empty v-if="!commentTree.length" description="暂无评论" :image-size="70" />
            <el-tree
              v-else
              :data="commentTree"
              node-key="id"
              default-expand-all
              :expand-on-click-node="false"
              class="comment-tree"
            >
              <template #default="{ data }">
                <div class="comment-node">
                  <div class="comment-node__main">
                    <div class="comment-node__meta">
                      <span class="font-medium text-ink">{{ text(data.author_name || data.author_account_id) }}</span>
                      <StatusBadge :value="data.status" />
                      <span>层级 {{ data.depth }}</span>
                      <span>{{ formatDate(data.commented_at) }}</span>
                    </div>
                    <div class="comment-node__content">{{ data.content }}</div>
                    <div class="comment-node__stats">
                      <span>点赞 {{ numberText(data.like_count) }}</span>
                      <span>回复 {{ numberText(data.reply_count) }}</span>
                      <span class="font-mono" :title="String(data.platform_comment_id || '')">
                        {{ truncateId(data.platform_comment_id) }}
                      </span>
                    </div>
                  </div>
                  <el-button v-if="data.platform_comment_id" text type="primary" @click.stop="copyText(data.platform_comment_id)">
                    复制评论 ID
                  </el-button>
                </div>
              </template>
            </el-tree>
          </el-tab-pane>

          <el-tab-pane label="互动动作" name="actions">
            <el-table :data="actions" border stripe empty-text="暂无互动动作">
              <el-table-column prop="action_type" label="动作" width="120" align="center">
                <template #default="{ row }">
                  <StatusBadge :value="row.action_type" />
                </template>
              </el-table-column>
              <el-table-column prop="operator_username" label="执行账号" min-width="150" align="center" />
              <el-table-column prop="content" label="内容" min-width="240" show-overflow-tooltip />
              <el-table-column prop="status" label="状态" width="100" align="center">
                <template #default="{ row }">
                  <StatusBadge :value="row.status" />
                </template>
              </el-table-column>
              <el-table-column prop="error_message" label="错误信息" min-width="220" show-overflow-tooltip />
              <el-table-column label="执行时间" min-width="170" align="center">
                <template #default="{ row }">{{ formatDate(row.executed_at) }}</template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </template>
    </div>
  </el-dialog>
</template>

<style scoped>
.published-content-detail {
  min-height: 360px;
}

.metric-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.metric-item {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 10px 12px;
  background: #fff;
}

.metric-label {
  display: block;
  margin-bottom: 4px;
  color: #64748b;
  font-size: 12px;
}

.metric-item strong {
  color: #0f172a;
  font-size: 20px;
}

.detail-section {
  margin-top: 16px;
}

.detail-section__title {
  margin-bottom: 10px;
  font-weight: 600;
  color: #0f172a;
}

.media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}

.media-item {
  min-height: 110px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
}

.media-item img,
.media-item video {
  width: 100%;
  max-height: 220px;
  object-fit: contain;
}

.comment-tree {
  --el-tree-node-hover-bg-color: #f8fafc;
}

.comment-node {
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
}

.comment-node__main {
  min-width: 0;
}

.comment-node__meta,
.comment-node__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  color: #64748b;
  font-size: 12px;
}

.comment-node__content {
  margin: 5px 0;
  color: #0f172a;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 768px) {
  .metric-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
