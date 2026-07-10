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

type MetricKey = 'comment_count' | 'like_count' | 'share_count' | 'view_count'
type PeriodValue = '24h' | '7d' | '30d' | 'all'
type MonitorMode = 'system' | 'high_frequency' | 'low_frequency' | 'custom'

const metricDefs: Array<{ key: MetricKey; label: string; color: string }> = [
  { key: 'comment_count', label: '评论', color: '#2563eb' },
  { key: 'like_count', label: '点赞', color: '#16a34a' },
  { key: 'share_count', label: '分享', color: '#f97316' },
  { key: 'view_count', label: '浏览', color: '#9333ea' },
]
const periodOptions: Array<{ label: string; value: PeriodValue }> = [
  { label: '近 24 小时', value: '24h' },
  { label: '近 7 天', value: '7d' },
  { label: '近 30 天', value: '30d' },
  { label: '全部', value: 'all' },
]
const monitorModeOptions: Array<{ label: string; value: MonitorMode; description: string }> = [
  { label: '系统默认', value: 'system', description: '按发布时间自动调整监听频率' },
  { label: '高频监听', value: 'high_frequency', description: '适合重点内容，约 5 分钟一次' },
  { label: '低频监听', value: 'low_frequency', description: '适合普通内容，约 6 小时一次' },
  { label: '自定义', value: 'custom', description: '运营手动设置固定监听间隔' },
]

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const loading = ref(false)
const curveLoading = ref(false)
const monitorSaving = ref(false)
const error = ref('')
const activeTab = ref('basic')
const metricPeriod = ref<PeriodValue>('7d')
const detail = ref<AnyRecord | null>(null)
const monitorForm = ref<{ mode: MonitorMode; enabled: boolean; interval_minutes: number }>({
  mode: 'system',
  enabled: true,
  interval_minutes: 30,
})

const content = computed<AnyRecord | null>(() => {
  const value = detail.value?.content
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : null
})
const metrics = computed<AnyRecord[]>(() => Array.isArray(detail.value?.latest_metrics) ? detail.value.latest_metrics : [])
const metricCurve = computed<AnyRecord | null>(() => {
  const value = detail.value?.metric_curve
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : null
})
const curvePoints = computed<AnyRecord[]>(() => {
  const points = metricCurve.value?.points
  if (Array.isArray(points)) return points as AnyRecord[]
  return [...metrics.value].sort((a, b) => new Date(String(a.captured_at || '')).getTime() - new Date(String(b.captured_at || '')).getTime())
})
const trendItems = computed<AnyRecord[]>(() => Array.isArray(metricCurve.value?.trends) ? metricCurve.value.trends as AnyRecord[] : [])
const monitorSetting = computed<AnyRecord | null>(() => {
  const value = detail.value?.monitor_setting
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : null
})
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

function metricNumber(value: unknown) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function trendFor(key: MetricKey) {
  return trendItems.value.find((item) => item.metric_key === key) || {}
}

function trendRate(value: unknown) {
  const numberValue = metricNumber(value)
  if (numberValue === null) return '-'
  return `${(numberValue * 100).toFixed(1)}%`
}

function deltaText(value: unknown) {
  const numberValue = metricNumber(value)
  if (numberValue === null) return '-'
  if (numberValue > 0) return `+${numberValue}`
  return String(numberValue)
}

function trendType(value: unknown) {
  const direction = String(value || '')
  if (direction === 'up') return 'success'
  if (direction === 'down') return 'danger'
  if (direction === 'flat') return 'info'
  return 'info'
}

function trendLabel(value: unknown) {
  const direction = String(value || '')
  const labels: Record<string, string> = {
    up: '上升',
    down: '下降',
    flat: '持平',
    unknown: '暂无趋势',
  }
  return labels[direction] || '暂无趋势'
}

function monitorModeLabel(value: unknown) {
  const mode = String(value || '')
  return monitorModeOptions.find((item) => item.value === mode)?.label || mode || '-'
}

function monitorModeDescription(value: unknown) {
  const mode = String(value || '')
  return monitorModeOptions.find((item) => item.value === mode)?.description || ''
}

function resetMonitorForm(setting: AnyRecord | null) {
  monitorForm.value = {
    mode: String(setting?.mode || 'system') as MonitorMode,
    enabled: setting?.enabled !== false,
    interval_minutes: Number(setting?.interval_minutes || setting?.effective_interval_minutes || 30),
  }
}

function chartPolyline(key: MetricKey) {
  const points = curvePoints.value
  if (points.length < 2) return ''
  const values = points.map((point) => metricNumber(point[key]))
  const validValues = values.filter((value): value is number => value !== null)
  if (!validValues.length) return ''
  const min = Math.min(...validValues)
  const max = Math.max(...validValues)
  const range = max - min || 1
  return values
    .map((value, index) => {
      const x = 36 + (index * 648) / Math.max(points.length - 1, 1)
      const normalized = value === null ? min : value
      const y = 176 - ((normalized - min) * 136) / range
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

function chartDateRange() {
  const points = curvePoints.value
  if (!points.length) return '暂无采集数据'
  const first = formatDate(points[0]?.captured_at)
  const last = formatDate(points[points.length - 1]?.captured_at)
  return first === last ? first : `${first} ~ ${last}`
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
    resetMonitorForm(monitorSetting.value)
    await loadMetricCurve(contentId)
  } catch (err) {
    error.value = notifyError(err, '加载失败', '加载发布内容详情失败')
  } finally {
    loading.value = false
  }
}

async function saveMonitorSetting() {
  if (!props.contentId) return
  monitorSaving.value = true
  try {
    const payload = {
      mode: monitorForm.value.mode,
      enabled: monitorForm.value.enabled,
      interval_minutes: monitorForm.value.mode === 'custom' ? monitorForm.value.interval_minutes : undefined,
    }
    const setting = await http.put<AnyRecord>(
      `/api/interaction-center/published-contents/${encodeURIComponent(props.contentId)}/monitor-setting`,
      payload,
    )
    if (detail.value) detail.value = { ...detail.value, monitor_setting: setting }
    resetMonitorForm(setting)
    ElMessage.success('监听配置已保存')
  } catch (err) {
    notifyError(err, '保存监听配置失败', '保存监听配置失败')
  } finally {
    monitorSaving.value = false
  }
}

async function loadMetricCurve(contentId: string) {
  curveLoading.value = true
  try {
    const curve = await http.get<AnyRecord>(
      `/api/interaction-center/published-contents/${encodeURIComponent(contentId)}/metrics/curve`,
      { period: metricPeriod.value },
    )
    if (detail.value) detail.value = { ...detail.value, metric_curve: curve }
  } catch (err) {
    notifyError(err, '加载趋势失败', '加载发布内容趋势失败')
  } finally {
    curveLoading.value = false
  }
}

watch(
  () => [props.modelValue, props.contentId] as const,
  ([open, contentId]) => {
    if (open && contentId) {
      activeTab.value = 'basic'
      metricPeriod.value = '7d'
      loadDetail(contentId)
    }
    if (!open) {
      detail.value = null
      error.value = ''
      resetMonitorForm(null)
    }
  },
  { immediate: true },
)

watch(metricPeriod, () => {
  if (props.modelValue && props.contentId) loadMetricCurve(props.contentId)
})
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
                <span :title="String(content.author_account_id || '')">
                  {{ text(content.author_account_name || content.author_login_username || content.author_username || truncateId(content.author_account_id)) }}
                </span>
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

          <el-tab-pane label="监听配置" name="monitor">
            <div class="monitor-panel">
              <div class="monitor-summary">
                <div>
                  <span>当前模式</span>
                  <strong>{{ monitorModeLabel(monitorSetting?.mode) }}</strong>
                  <small>{{ monitorModeDescription(monitorSetting?.mode) }}</small>
                </div>
                <div>
                  <span>监听状态</span>
                  <strong>{{ monitorSetting?.enabled === false ? '已暂停' : '监听中' }}</strong>
                  <small>下次监听：{{ formatDate(monitorSetting?.next_run_at) }}</small>
                </div>
                <div>
                  <span>生效间隔</span>
                  <strong>{{ numberText(monitorSetting?.effective_interval_minutes) }} 分钟</strong>
                  <small>上次监听：{{ formatDate(monitorSetting?.last_run_at) }}</small>
                </div>
              </div>

              <el-form label-position="top" class="monitor-form">
                <el-form-item label="监听模式">
                  <el-radio-group v-model="monitorForm.mode">
                    <el-radio-button v-for="option in monitorModeOptions" :key="option.value" :label="option.value">
                      {{ option.label }}
                    </el-radio-button>
                  </el-radio-group>
                  <div class="monitor-form__hint">{{ monitorModeDescription(monitorForm.mode) }}</div>
                </el-form-item>

                <div class="monitor-form__row">
                  <el-form-item label="是否启用">
                    <el-switch
                      v-model="monitorForm.enabled"
                      active-text="启用监听"
                      inactive-text="暂停监听"
                    />
                  </el-form-item>
                  <el-form-item label="自定义间隔">
                    <el-input-number
                      v-model="monitorForm.interval_minutes"
                      :min="1"
                      :max="1440"
                      :disabled="monitorForm.mode !== 'custom'"
                      controls-position="right"
                    />
                    <span class="monitor-form__unit">分钟</span>
                  </el-form-item>
                </div>

                <div class="monitor-actions">
                  <el-alert
                    type="info"
                    :closable="false"
                    show-icon
                    title="第一版会先保存监听规则和下次监听时间；后续采集调度器会按 next_run_at 自动生成采集任务。"
                  />
                  <el-button type="primary" :loading="monitorSaving" @click="saveMonitorSetting">
                    保存监听配置
                  </el-button>
                </div>
              </el-form>
            </div>
          </el-tab-pane>

          <el-tab-pane label="趋势分析" name="metrics">
            <div v-loading="curveLoading" class="trend-panel">
              <div class="trend-toolbar">
                <div>
                  <strong>趋势周期</strong>
                  <span>按采集时间过滤指标快照</span>
                </div>
                <el-radio-group v-model="metricPeriod" size="small">
                  <el-radio-button v-for="option in periodOptions" :key="option.value" :label="option.value">
                    {{ option.label }}
                  </el-radio-button>
                </el-radio-group>
              </div>

              <div class="trend-grid">
              <div v-for="metric in metricDefs" :key="metric.key" class="trend-card">
                <div class="trend-card__head">
                  <span>{{ metric.label }}</span>
                  <el-tag size="small" :type="trendType(trendFor(metric.key).direction)" effect="light">
                    {{ trendLabel(trendFor(metric.key).direction) }}
                  </el-tag>
                </div>
                <strong>{{ numberText(trendFor(metric.key).latest_value ?? content?.[metric.key]) }}</strong>
                <div class="trend-card__meta">
                  <span>总增长 {{ deltaText(trendFor(metric.key).total_delta) }}</span>
                  <span>最近 {{ deltaText(trendFor(metric.key).latest_delta) }}</span>
                  <span>增长率 {{ trendRate(trendFor(metric.key).growth_rate) }}</span>
                </div>
              </div>
            </div>

              <div class="trend-chart">
              <div class="trend-chart__header">
                <div>
                  <strong>指标走势</strong>
                  <span>{{ chartDateRange() }}</span>
                </div>
                <div class="trend-chart__legend">
                  <span v-for="metric in metricDefs" :key="metric.key">
                    <i :style="{ backgroundColor: metric.color }" />
                    {{ metric.label }}
                  </span>
                </div>
              </div>
              <el-empty v-if="curvePoints.length < 2" description="至少需要 2 次指标采集才能形成曲线" :image-size="70" />
              <svg v-else viewBox="0 0 720 220" role="img" class="trend-chart__svg">
                <line x1="36" y1="40" x2="36" y2="176" class="axis-line" />
                <line x1="36" y1="176" x2="684" y2="176" class="axis-line" />
                <line v-for="y in [74, 108, 142]" :key="y" x1="36" :y1="y" x2="684" :y2="y" class="grid-line" />
                <polyline
                  v-for="metric in metricDefs"
                  :key="metric.key"
                  :points="chartPolyline(metric.key)"
                  fill="none"
                  :stroke="metric.color"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <text x="36" y="204" class="chart-label">{{ formatDate(curvePoints[0]?.captured_at) }}</text>
                <text x="684" y="204" text-anchor="end" class="chart-label">
                  {{ formatDate(curvePoints[curvePoints.length - 1]?.captured_at) }}
                </text>
              </svg>
            </div>
            </div>

            <el-table :data="curvePoints" border stripe empty-text="暂无指标快照">
              <el-table-column label="采集时间" min-width="170" align="center">
                <template #default="{ row }">{{ formatDate(row.captured_at) }}</template>
              </el-table-column>
              <el-table-column prop="comment_count" label="评论" width="90" align="center" />
              <el-table-column prop="like_count" label="点赞" width="90" align="center" />
              <el-table-column prop="share_count" label="分享" width="90" align="center" />
              <el-table-column prop="view_count" label="浏览" width="90" align="center" />
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

.monitor-panel {
  display: grid;
  gap: 16px;
}

.monitor-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.monitor-summary > div {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 12px;
  background: #fff;
}

.monitor-summary span,
.monitor-summary small {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.monitor-summary strong {
  display: block;
  margin: 6px 0;
  color: #0f172a;
  font-size: 20px;
}

.monitor-form {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 14px;
  background: #fff;
}

.monitor-form__hint {
  margin-top: 8px;
  color: #64748b;
  font-size: 12px;
}

.monitor-form__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  align-items: end;
}

.monitor-form__unit {
  margin-left: 8px;
  color: #64748b;
  font-size: 12px;
}

.monitor-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.monitor-actions .el-alert {
  flex: 1;
}

.trend-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.trend-panel {
  min-height: 260px;
}

.trend-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.trend-toolbar strong {
  display: block;
  color: #0f172a;
}

.trend-toolbar span {
  color: #64748b;
  font-size: 12px;
}

.trend-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 12px;
  background: #fff;
}

.trend-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #64748b;
  font-size: 12px;
}

.trend-card strong {
  display: block;
  margin-top: 8px;
  color: #0f172a;
  font-size: 22px;
}

.trend-card__meta {
  display: grid;
  gap: 4px;
  margin-top: 8px;
  color: #64748b;
  font-size: 12px;
}

.trend-chart {
  margin-bottom: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 12px;
  background: #fff;
}

.trend-chart__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.trend-chart__header strong {
  display: block;
  color: #0f172a;
}

.trend-chart__header span {
  color: #64748b;
  font-size: 12px;
}

.trend-chart__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.trend-chart__legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #475569;
}

.trend-chart__legend i {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 999px;
}

.trend-chart__svg {
  width: 100%;
  height: 240px;
}

.axis-line {
  stroke: #cbd5e1;
  stroke-width: 1.5;
}

.grid-line {
  stroke: #e2e8f0;
  stroke-width: 1;
  stroke-dasharray: 4 4;
}

.chart-label {
  fill: #64748b;
  font-size: 12px;
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

:deep(.comment-tree .el-tree-node__content) {
  height: auto;
  min-height: 44px;
  align-items: flex-start;
  padding: 4px 0;
}

:deep(.comment-tree .el-tree-node__expand-icon) {
  margin-top: 14px;
}

:deep(.comment-tree .el-tree-node__children) {
  overflow: visible;
}

.comment-node {
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid #eef2f7;
  line-height: 1.45;
}

.comment-node__main {
  min-width: 0;
  flex: 1;
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

  .monitor-summary,
  .monitor-form__row {
    grid-template-columns: 1fr;
  }

  .monitor-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .trend-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .trend-chart__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .trend-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
