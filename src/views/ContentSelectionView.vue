<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, ChevronDown, ChevronUp, Star, ClipboardList, ExternalLink, Eye, FileText, Heart, MessageCircle, Pause, Play, Plus, RefreshCw, RotateCcw, Search, Send, UserRound, Users } from 'lucide-vue-next'
import { contentSelection, type SelectionOrder, type SelectionPost, type SelectionSource } from '@/api/contentSelection'
import { http } from '@/api/http'
import { loadAccountSelectionOptions } from '@/api/selectionOptions'
import { useAuthStore } from '@/stores/auth'
import { useScopedBusinessPlatformOptions } from '@/composables/useScopedBusinessPlatformOptions'
import { formatDate } from '@/utils/format'
import { canRetrySelection, safeSelectionLink, selectionIsVideo, selectionStatus } from '@/utils/contentSelection'
import type { AnyRecord } from '@/types/api'
import SelectionAiEditor from '@/components/SelectionAiEditor.vue'
import SelectionOptionFilter from '@/components/SelectionOptionFilter.vue'
import PersonaCreationPanel from '@/components/PersonaCreationPanel.vue'
import { parseSelectionMarks, selectionDateRange, selectionMarkQuery, selectionStorageKey, type SelectionMarks } from '@/utils/selectionLocalState'

const auth = useAuthStore()
const route = useRoute()
const platforms = useScopedBusinessPlatformOptions([{ label: 'Threads', value: 'threads' }, { label: 'X(Twitter)', value: 'x' }, { label: 'Instagram', value: 'instagram' }])
const tab = ref('posts')
const loading = ref(false)
const error = ref('')
const posts = ref<SelectionPost[]>([])
const sources = ref<SelectionSource[]>([])
const orders = ref<SelectionOrder[]>([])
const total = ref(0)
function metricLabel(value: number | null) {
  if (value == null || !Number.isFinite(value) || value < 0) return '未知'
  return value > 1000 ? `${(value / 1000).toLocaleString('en-US', { maximumFractionDigits: 1, useGrouping: false })}k` : String(value)
}
const page = ref(1)
const pageSize = ref(20)
const dates = ref<[string, string] | null>(null)
const reading = ref('all')
const hideRead = ref(false)
const quickTime = ref('')
const expandedFilters = ref(false)
const storageKey = ref('')
const storageWarning = ref('')
const marks = ref<SelectionMarks>({ read: [], saved: [] })
const readIds = computed(() => new Set(marks.value.read))
const savedIds = computed(() => new Set(marks.value.saved))
const loadMoreAnchor = ref<HTMLElement | null>(null)
const moreLoading = ref(false)
const moreError = ref('')
const hasMore = ref(false)
const expandedPosts = reactive(new Set<string>())
let postQuery: AnyRecord = {}
let feedPage = 1
let observer: IntersectionObserver | null = null
function setMark(id: string, field: 'read' | 'saved', enabled: boolean) {
  if (!storageKey.value) return
  try {
    const latest = parseSelectionMarks(localStorage.getItem(storageKey.value))
    const values = new Set(latest[field])
    if (enabled) values.add(id)
    else values.delete(id)
    if (values.size > 100000) throw new Error('limit')
    latest[field] = [...values]
    localStorage.setItem(storageKey.value, JSON.stringify(latest))
    marks.value = latest
    storageWarning.value = ''
  } catch { storageWarning.value = '浏览器无法保存阅读标记，请检查本地存储空间或隐私设置' }
}
function syncMarks(event: StorageEvent) {
  if (event.key === storageKey.value || event.key === null) {
    try { marks.value = parseSelectionMarks(localStorage.getItem(storageKey.value)) } catch { /* 保留当前浏览状态。 */ }
  }
}
function applyQuickTime() {
  if (quickTime.value === 'custom') return
  dates.value = selectionDateRange(quickTime.value)
  void refresh(true)
}
async function loadMore() {
  if (tab.value !== 'posts' || loading.value || moreLoading.value || !hasMore.value || editVisible.value) return
  const id = requestId
  moreLoading.value = true
  moreError.value = ''
  try {
    const result = await contentSelection.queryPosts({ ...postQuery, page: feedPage + 1, page_size: 20 })
    if (id !== requestId) return
    const existing = new Set(posts.value.map(item => item.id))
    posts.value.push(...result.items.filter(item => !existing.has(item.id)))
    feedPage++
    total.value = result.total
    hasMore.value = result.items.length > 0 && feedPage * 20 < result.total
  } catch (e) { if (id === requestId) moreError.value = e instanceof Error ? e.message : '加载失败，请重试' }
  finally { if (id === requestId) moreLoading.value = false }
}
watch(loadMoreAnchor, element => {
  observer?.disconnect()
  if (element) observer?.observe(element)
})
watch(() => auth.user?.id, () => { storageKey.value = ''; marks.value = { read: [], saved: [] } })
const countryOrder = ref<string[]>([])
const tagOrder = ref<string[]>([])
const configuredTags = ref<{ id: string; name: string }[]>([])
function orderIndex(order: string[], value: string) { const index = order.indexOf(value); return index < 0 ? Number.MAX_SAFE_INTEGER : index }
const sourceCountries = computed(() => [...new Set([...countryOrder.value, ...sources.value.map(item => item.country).filter((value): value is string => !!value)])]
  .sort((a, b) => orderIndex(countryOrder.value, a) - orderIndex(countryOrder.value, b)))
const sourceTags = computed(() => [...new Map([...sources.value.flatMap(item => item.tags || []), ...configuredTags.value].map(tag => [tag.id, tag])).values()]
  .sort((a, b) => orderIndex(tagOrder.value, a.id) - orderIndex(tagOrder.value, b.id)))
const filters = reactive({ countries: [] as string[], tag_ids: [] as string[], country_unset: false, untagged: false, platform: '', source_id: '', keyword: '', media_type: '', min_likes: undefined as number | undefined, min_comments: undefined as number | undefined, sort_by: 'published_at' })
const hasFilters = computed(() => !!(filters.countries.length || filters.tag_ids.length || filters.country_unset || filters.untagged || reading.value !== 'all' || hideRead.value || filters.platform || filters.source_id || filters.keyword || filters.media_type || dates.value || filters.min_likes !== undefined || filters.min_comments !== undefined || filters.sort_by !== 'published_at'))
function filterCountries(values: string[] = [], unset = false) {
  filters.countries = unset ? [] : values
  filters.country_unset = unset
  void refresh(true)
}
function filterTags(values: string[] = [], unset = false) {
  filters.tag_ids = unset ? [] : values
  filters.untagged = unset
  void refresh(true)
}
function resetFilters() {
  Object.assign(filters, { countries: [], tag_ids: [], country_unset: false, untagged: false, platform: '', source_id: '', keyword: '', media_type: '', min_likes: undefined, min_comments: undefined, sort_by: 'published_at' })
  dates.value = null
  reading.value = 'all'
  hideRead.value = false
  quickTime.value = ''
  void refresh(true)
}
const sourceVisible = ref(false)
const sourceBusy = ref(false)
const sourceForm = reactive({ business_platform: 'threads', profile_url: '', remark: '', interval_minutes: 60 })
const selected = ref<SelectionPost | null>(null)
const editVisible = ref(false)
const editLoading = ref(false)
const editError = ref('')
const accountsLoading = ref(false)
const accountsError = ref('')
const historyError = ref('')
const publishBusy = ref(false)
const aiBusy = ref(false)
const draft = reactive({ account_id: '', text_body: '', media_indexes: [] as number[], creation_job_id: undefined as string | undefined })
watch(() => draft.account_id, () => { draft.creation_job_id = undefined })
function applyCreation(text: string, jobId: string) { draft.text_body = text; draft.creation_job_id = jobId; editTab.value = 'content' }
const accounts = ref<AnyRecord[]>([])
const accountOptions = computed(() => accounts.value.map(account => ({
  value: String(account.id),
  label: `${account.display_name || account.username || account.login_username || ''} · @${account.username || ''} · ${label(String(account.business_platform))} · ID ${account.id}`,
  avatar: safeSelectionLink(String(account.avatar_url || '')),
})))
const selectedAccount = computed(() => accounts.value.find(account => String(account.id) === draft.account_id))
const previousOrders = ref<SelectionOrder[]>([])
const previousTotal = ref(0)
const previousPage = ref(1)
const editTab = ref('content')
const creationTotal = ref(0)
const historyLoading = ref(false)
let historyRequestId = 0
const orderVisible = ref(false)
const detail = ref<SelectionOrder | null>(null)
const orderBusy = ref(false)
const duplicate = computed(() => previousOrders.value.find(order => order.account_id === draft.account_id))
let requestId = 0
let editRequestId = 0
let detailRequestId = 0
const label = (platform: string) => platforms.value.find(item => item.value === platform)?.label || platform
const showError = (e: unknown) => ElMessage.error(e instanceof Error ? e.message : '请求失败')
function sourceUsername(source: SelectionSource) {
  if (source.profile?.username) return source.profile.username.replace(/^@/, '')
  try { return new URL(source.profile_url).pathname.split('/').filter(Boolean).pop()?.replace(/^@/, '') || '' }
  catch { return '' }
}

async function refresh(reset = false) {
  if (reset) page.value = 1
  const id = ++requestId
  moreLoading.value = false
  moreError.value = ''
  loading.value = true
  error.value = ''
  const current = tab.value
  if (current === 'posts') hasMore.value = false
  try {
    if (current === 'sources') {
      const result = await contentSelection.sources()
      if (id === requestId) { sources.value = result; total.value = result.length }
    } else if (current === 'orders') {
      const result = await contentSelection.orders({ page: page.value, page_size: pageSize.value })
      if (id === requestId) { orders.value = result.items; total.value = result.total }
    } else {
      postQuery = Object.fromEntries(Object.entries({ ...filters, published_from: dates.value?.[0], published_to: dates.value?.[1] }).filter(([, value]) => value !== '' && value !== undefined))
      Object.assign(postQuery, selectionMarkQuery(marks.value, reading.value, hideRead.value))
      const result = await contentSelection.queryPosts({ ...postQuery, page: 1, page_size: 20 })
      if (id === requestId) { posts.value = result.items; total.value = result.total; feedPage = 1; hasMore.value = result.items.length > 0 && result.total > 20 }
    }
  } catch (e) { if (id === requestId) error.value = e instanceof Error ? e.message : '加载失败' }
  finally { if (id === requestId) loading.value = false }
}
async function createSource() {
  if (sourceBusy.value || !sourceForm.profile_url.trim()) return
  sourceBusy.value = true
  try {
    await contentSelection.createSource({ ...sourceForm })
    sourceVisible.value = false
    sources.value = await contentSelection.sources()
    tab.value = 'sources'
    await refresh(true)
    ElMessage.success('来源已添加，等待历史采集')
  } catch (e) { showError(e) } finally { sourceBusy.value = false }
}
async function toggleSource(source: SelectionSource) {
  if (sourceBusy.value) return
  sourceBusy.value = true
  try {
    await contentSelection.updateSource(source.id, { enabled: !source.enabled, expected_version: source.version, interval_minutes: source.interval_minutes })
    await refresh()
  } catch (e) { showError(e) } finally { sourceBusy.value = false }
}
async function openPost(post: SelectionPost) {
  editTab.value = 'content'
  creationTotal.value = 0
  historyRequestId++
  historyLoading.value = false
  aiBusy.value = false
  const id = ++editRequestId
  selected.value = null
  previousOrders.value = []
  previousTotal.value = 0
  accounts.value = []
  accountsError.value = ''
  historyError.value = ''
  editError.value = ''
  draft.account_id = ''
  draft.creation_job_id = undefined
  editVisible.value = true
  editLoading.value = true
  previousPage.value = 1
  void loadPrevious(post.id)
  void loadPublishAccounts()
  try {
    const current = await contentSelection.post(post.id)
    if (id !== editRequestId) return
    selected.value = current
    setMark(current.id, 'read', true)
    draft.text_body = current.text_body
    draft.media_indexes = current.media.map((_, index) => index)
  } catch (e) { if (id === editRequestId) editError.value = e instanceof Error ? e.message : '帖子加载失败，请关闭后重新打开' }
  finally { if (id === editRequestId) editLoading.value = false }
}
async function loadPublishAccounts() {
  const id = editRequestId
  accountsError.value = ''
  if (!auth.can('operations.dispatch') || !auth.can('accounts.view')) {
    accountsLoading.value = false
    return
  }
  accountsLoading.value = true
  try {
    const result = await loadAccountSelectionOptions({}, { associationOnly: true })
    if (id === editRequestId) accounts.value = result.filter(a => ['threads', 'x', 'instagram'].includes(String(a.business_platform)) && a.bound_slot_id)
  } catch (e) {
    if (id === editRequestId) accountsError.value = e instanceof Error ? e.message : '发布账号加载失败'
  } finally { if (id === editRequestId) accountsLoading.value = false }
}
async function loadPrevious(postId = selected.value?.id) {
  const id = editRequestId
  const request = ++historyRequestId
  if (!postId) return
  historyLoading.value = true
  historyError.value = ''
  try {
    const result = await contentSelection.orders({ post_id: postId, page: previousPage.value, page_size: 20 })
    if (id === editRequestId && request === historyRequestId) {
      previousOrders.value = result.items
      previousTotal.value = result.total
    }
  } catch (e) { if (id === editRequestId && request === historyRequestId) historyError.value = e instanceof Error ? e.message : '发布记录加载失败' }
  finally { if (id === editRequestId && request === historyRequestId) historyLoading.value = false }
}
async function publish() {
  if (!selected.value || !draft.account_id || publishBusy.value || aiBusy.value || editLoading.value || accountsLoading.value || historyLoading.value || editError.value || accountsError.value || historyError.value || duplicate.value) return
  const request = editRequestId
  try { await ElMessageBox.confirm('将发布到所选账号，确认提交？', '确认发布', { type: 'warning' }) } catch { return }
  if (request !== editRequestId || publishBusy.value || aiBusy.value || !selected.value || historyLoading.value || historyError.value || duplicate.value) return
  publishBusy.value = true
  try {
    const order = await contentSelection.publish(selected.value.id, { ...draft, media_indexes: [...draft.media_indexes], source_revision: selected.value.updated_at })
    editVisible.value = false
    detail.value = order
    orderVisible.value = true
    ElMessage.success('已创建工单并提交发布任务')
  } catch (e) { showError(e) } finally { publishBusy.value = false }
}
async function openOrder(id: string) {
  const request = ++detailRequestId
  detail.value = null
  orderVisible.value = true
  orderBusy.value = true
  try { const result = await contentSelection.order(id); if (request === detailRequestId) detail.value = result }
  catch (e) { if (request === detailRequestId) showError(e) }
  finally { if (request === detailRequestId) orderBusy.value = false }
}
async function retryOrder() {
  if (!detail.value || orderBusy.value) return
  try { await ElMessageBox.confirm('确认使用原发布稿重试？请先核对账号主页，避免实际已发布但回报失败造成重复。', '重试发布', { type: 'warning' }) } catch { return }
  if (!detail.value || orderBusy.value) return
  const request = detailRequestId
  const id = detail.value.id
  orderBusy.value = true
  try { const result = await contentSelection.retry(id); if (request === detailRequestId) detail.value = result; await refresh(); ElMessage.success('已从原工单重试') }
  catch (e) { showError(e) } finally { if (request === detailRequestId) orderBusy.value = false }
}
onMounted(async () => {
  window.addEventListener('storage', syncMarks)
  observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting) && !moreError.value) void loadMore()
  }, { rootMargin: '200px' })
  try {
    const scope = await contentSelection.localScope()
    if (scope.user_id === auth.user?.id && scope.tenant_id) {
      storageKey.value = selectionStorageKey(scope.tenant_id, scope.user_id)
      marks.value = parseSelectionMarks(localStorage.getItem(storageKey.value))
    }
  } catch { storageWarning.value = '本地阅读标记暂不可用，请刷新重试' }
  sourceForm.business_platform = String(platforms.value[0]?.value || 'threads')
  await refresh()
  await nextTick()
  if (loadMoreAnchor.value) observer.observe(loadMoreAnchor.value)
  try { sources.value = await contentSelection.sources() } catch (e) { showError(e) }
  try {
    const [countries, tags] = await Promise.all([
      http.get<{ countries: string[] }>('/api/external-account-monitors/country-options'),
      http.get<{ id: string; name: string }[]>('/api/external-account-monitors/tags'),
    ])
    countryOrder.value = countries.countries
    tagOrder.value = tags.map(tag => tag.id)
    configuredTags.value = tags
  } catch (e) { showError(e) }
  if (typeof route.query.order_id === 'string') await openOrder(route.query.order_id)
})
onBeforeUnmount(() => { requestId++; editRequestId++; detailRequestId++; observer?.disconnect(); window.removeEventListener('storage', syncMarks) })
</script>

<template>
  <section class="selection-view">
    <header class="selection-heading"><div class="selection-title"><span class="selection-icon"><ClipboardList :size="20" /></span><h1>选题池</h1></div><div class="selection-actions">
      <el-tooltip content="刷新" placement="bottom"><el-button :disabled="loading" :icon="RefreshCw" circle aria-label="刷新" @click="refresh()" /></el-tooltip>
      <el-button v-if="auth.can('operations.edit')" type="primary" @click="sourceVisible = true"><Plus :size="16" />添加来源账号</el-button>
    </div></header>
    <el-tabs v-model="tab" class="selection-tabs" @tab-change="refresh(true)">
      <el-tab-pane name="posts"><template #label><span class="selection-tab-label"><FileText :size="16" />帖子选题</span></template></el-tab-pane>
      <el-tab-pane name="sources"><template #label><span class="selection-tab-label"><Users :size="16" />来源账号</span></template></el-tab-pane>
      <el-tab-pane name="orders"><template #label><span class="selection-tab-label"><ClipboardList :size="16" />发布工单</span></template></el-tab-pane>
    </el-tabs>
    <div class="selection-body">
    <div v-if="tab === 'posts'" class="selection-filters">
      <div class="filter-title"><Search :size="14" /><span>筛选条件</span><el-button link :icon="expandedFilters ? ChevronUp : ChevronDown" @click="expandedFilters = !expandedFilters">{{ expandedFilters ? '收起筛选' : '更多筛选' }}</el-button></div>
      <div class="feed-controls">
        <el-radio-group v-model="reading" :disabled="!storageKey" aria-label="阅读状态" @change="refresh(true)"><el-radio-button value="all">全部</el-radio-button><el-radio-button value="unread">未读</el-radio-button><el-radio-button value="saved">收藏</el-radio-button><el-radio-button value="read">已读</el-radio-button></el-radio-group>
        <el-checkbox v-model="hideRead" :disabled="!storageKey || reading === 'read'" @change="refresh(true)">隐藏已读</el-checkbox>
        <el-select v-model="quickTime" placeholder="时间不限" aria-label="快捷时间" @change="applyQuickTime"><el-option label="时间不限" value="" /><el-option label="今天" value="1" /><el-option label="昨天" value="yesterday" /><el-option label="近 3 天" value="3" /><el-option label="近 7 天" value="7" /><el-option label="近 30 天" value="30" /><el-option v-if="quickTime === 'custom'" label="自定义时间" value="custom" /></el-select>
        <el-select v-model="filters.sort_by" aria-label="帖子排序" @change="refresh(true)"><el-option label="最新发布" value="published_at" /><el-option label="点赞最多" value="likes_count" /><el-option label="评论最多" value="comments_count" /><el-option label="最新采集" value="collected_at" /></el-select>
        <el-input v-model="filters.keyword" placeholder="正文 / 作者" clearable @keyup.enter="refresh(true)" @clear="refresh(true)" />
        <el-button :icon="Search" type="primary" :loading="loading" @click="refresh(true)">查询</el-button>
      </div>
      <el-form class="selection-option-filters" label-width="72px" @submit.prevent>
        <el-form-item label="国家"><SelectionOptionFilter :model-value="filters.countries" :unset="filters.country_unset" unset-label="未设置国家" label="国家筛选" :options="sourceCountries.map(country => ({ value: country, label: country }))" @change="filterCountries" /></el-form-item>
        <el-form-item label="账号标签"><SelectionOptionFilter :model-value="filters.tag_ids" :unset="filters.untagged" unset-label="未设置标签" label="账号标签筛选" :options="sourceTags.map(tag => ({ value: tag.id, label: tag.name }))" @change="filterTags" /></el-form-item>
      </el-form>
      <el-form v-show="expandedFilters" class="compact-filter-form" inline label-position="right" label-suffix=":" @submit.prevent="refresh(true)">
        <div class="filter-grid">
      <el-form-item label="来源平台"><el-select v-model="filters.platform" clearable placeholder="全部"><el-option v-for="item in platforms" :key="String(item.value)" v-bind="item" /></el-select></el-form-item>
      <el-form-item label="来源账号"><el-select v-model="filters.source_id" filterable clearable placeholder="全部"><el-option v-for="item in sources" :key="item.id" :value="item.id" :label="`${item.profile?.display_name || sourceUsername(item)} · @${sourceUsername(item)}${item.remark ? ' · ' + item.remark : ''}`" /></el-select></el-form-item>
      <el-form-item label="媒体"><el-select v-model="filters.media_type" clearable placeholder="全部"><el-option label="图片" value="image" /><el-option label="视频" value="video" /><el-option label="纯文字" value="text" /></el-select></el-form-item>
      <el-form-item label="发布时间" class="filter-grid__item--wide"><el-date-picker v-model="dates" type="datetimerange" value-format="YYYY-MM-DDTHH:mm:ssZ" range-separator="至" start-placeholder="开始时间" end-placeholder="结束时间" @change="quickTime = dates ? 'custom' : ''" /></el-form-item>
      <el-form-item label="最低点赞"><el-input-number v-model="filters.min_likes" :min="0" controls-position="right" /></el-form-item>
      <el-form-item label="最低评论"><el-input-number v-model="filters.min_comments" :min="0" controls-position="right" /></el-form-item>
        </div>
        <div class="filter-actions">
          <el-button :icon="RotateCcw" :disabled="!hasFilters" @click="resetFilters">清空</el-button>
          <el-button type="primary" :icon="Search" :loading="loading" native-type="submit">查询</el-button>
        </div>
      </el-form>
    </div>
    <el-alert v-if="storageWarning" :title="storageWarning" type="warning" :closable="false" />
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <div v-loading="loading" class="selection-content">
      <template v-if="tab === 'posts'">
        <el-empty v-if="!posts.length && !loading && !error" description="暂无选题" />
        <div class="post-grid">
          <article v-for="post in posts" :key="post.id" class="post-item">
            <header class="author"><el-avatar :src="safeSelectionLink(post.author.avatar_url)"><UserRound :size="20" /></el-avatar><div>
              <a :href="safeSelectionLink(post.author.profile_url)" target="_blank" rel="noopener noreferrer">{{ post.author.display_name || post.author.username }}</a>
              <small>{{ label(post.business_platform) }} · @{{ post.author.username }}</small>
            </div><div class="post-marks"><small v-if="readIds.has(post.id)">已读</small><el-tooltip :content="savedIds.has(post.id) ? '取消收藏' : '收藏'"><el-button :icon="Star" :type="savedIds.has(post.id) ? 'warning' : 'default'" :aria-label="savedIds.has(post.id) ? '取消收藏' : '收藏'" :aria-pressed="savedIds.has(post.id)" :disabled="!storageKey" circle @click="setMark(post.id, 'saved', !savedIds.has(post.id))" /></el-tooltip><el-tooltip v-if="readIds.has(post.id)" content="标为未读"><el-button :icon="Check" aria-label="标为未读" circle @click="setMark(post.id, 'read', false)" /></el-tooltip></div></header>
            <p class="post-text">{{ expandedPosts.has(post.id) ? post.text_body : post.text_body.slice(0, 400).split('\n').slice(0, 8).join('\n') }}</p>
            <el-button v-if="post.text_body.length > 400 || post.text_body.split('\n').length > 8" link type="primary" class="expand-post" @click="expandedPosts.has(post.id) ? expandedPosts.delete(post.id) : expandedPosts.add(post.id)">{{ expandedPosts.has(post.id) ? '收起正文' : '展开全文' }}</el-button>
            <div v-if="post.media.length" class="feed-media"><div v-for="(url, mediaIndex) in post.media" :key="`${mediaIndex}:${url}`">
              <video v-if="selectionIsVideo(url)" :src="safeSelectionLink(url)" controls preload="none" />
              <el-image v-else :src="safeSelectionLink(url)" loading="lazy" fit="contain" :preview-src-list="post.media.filter(item => !selectionIsVideo(item)).map(item => safeSelectionLink(item))" :initial-index="post.media.slice(0, mediaIndex).filter(item => !selectionIsVideo(item)).length" preview-teleported><template #error>媒体暂不可用</template></el-image>
            </div></div>
            <small>{{ post.published_at ? formatDate(post.published_at) : '发布时间未知' }}<span v-if="post.media.length"> · {{ post.media.length }} 项媒体</span></small>
            <footer><span><span :title="post.views_count?.toLocaleString('zh-CN')"><Eye :size="15" aria-label="浏览量" />浏览 {{ metricLabel(post.views_count) }}</span><span :title="post.likes_count?.toLocaleString('zh-CN')"><Heart :size="15" aria-label="点赞数" />{{ metricLabel(post.likes_count) }}</span><span :title="post.comments_count?.toLocaleString('zh-CN')"><MessageCircle :size="15" aria-label="评论数" />{{ metricLabel(post.comments_count) }}</span></span>
              <el-button @click="openPost(post)">查看选题<ExternalLink :size="14" /></el-button></footer>
          </article>
        </div>
        <div v-if="hasMore" ref="loadMoreAnchor" class="feed-more"><el-alert v-if="moreError" :title="moreError" type="error" :closable="false" /><el-button :loading="moreLoading" :disabled="loading" @click="loadMore">{{ moreError ? '重试加载' : '加载更多' }}</el-button><small>已加载 {{ posts.length }} / {{ total }} 条</small></div>
        <small v-else-if="posts.length" class="feed-more">已加载全部 {{ posts.length }} 条</small>
      </template>
      <el-table v-else-if="tab === 'sources'" :data="sources" class="selection-table" row-key="id" border stripe empty-text="暂无来源账号">
        <el-table-column label="来源账号" min-width="260"><template #default="{ row }"><div class="source-identity">
          <el-avatar :size="44" :src="safeSelectionLink(row.profile?.avatar_url)"><UserRound :size="22" /></el-avatar>
          <div><a :href="safeSelectionLink(row.profile_url)" target="_blank" rel="noopener noreferrer"><strong>{{ row.profile?.display_name || sourceUsername(row as SelectionSource) || '待采集账号' }}</strong><small v-if="sourceUsername(row as SelectionSource)">@{{ sourceUsername(row as SelectionSource) }}</small></a></div>
        </div></template></el-table-column>
        <el-table-column label="平台" width="130" align="center"><template #default="{ row }"><el-tag effect="plain">{{ label(row.business_platform) }}</el-tag></template></el-table-column>
        <el-table-column label="状态" width="120" align="center"><template #default="{ row }"><el-tag :type="row.status === 'attention' ? 'danger' : row.status === 'active' ? 'success' : row.status === 'collecting' ? 'warning' : 'info'">{{ selectionStatus[row.status] || row.status }}</el-tag></template></el-table-column>
        <el-table-column label="历史采集" min-width="170"><template #default="{ row }"><template v-if="row.external_monitor_id">外部监听同步<small>已收录 {{ row.post_count }} 条主帖</small></template><template v-else>{{ row.history_complete ? '可获取历史已完成' : '历史采集中' }}<small>已处理 {{ row.pages_collected }} 页 · {{ row.post_count }} 条主帖</small></template></template></el-table-column>
        <el-table-column label="备注" prop="remark" min-width="160" show-overflow-tooltip />
        <el-table-column label="采集提示" min-width="240"><template #default="{ row }"><span v-if="row.status === 'retrying'">采集暂缓，稍后自动重试</span><el-popover v-else-if="row.status === 'attention'" trigger="click" title="处理提示" :width="300"><template #reference><el-button link type="warning">查看处理提示</el-button></template>{{ row.last_error }}</el-popover><span v-else>-</span></template></el-table-column>
        <el-table-column label="操作" width="130" align="center" fixed="right"><template #default="{ row }"><span v-if="row.external_monitor_id">外部监听管理</span><el-tooltip v-else-if="auth.can('operations.edit')" :content="row.enabled ? '暂停采集' : '继续采集'"><el-button link type="primary" :icon="row.enabled ? Pause : Play" :aria-label="row.enabled ? '暂停采集' : '继续采集'" :disabled="sourceBusy" @click="toggleSource(row as SelectionSource)" /></el-tooltip></template></el-table-column>
      </el-table>
      <el-table v-else :data="orders" class="selection-table" row-key="id" border stripe empty-text="暂无发布工单">
        <el-table-column label="工单 ID" prop="id" min-width="250" />
        <el-table-column label="发布账号" min-width="180"><template #default="{ row }">{{ row.account.display_name || row.account.username }}<small>{{ label(row.business_platform) }} · @{{ row.account.username }}</small></template></el-table-column>
        <el-table-column label="发布稿" min-width="280"><template #default="{ row }"><p class="list-text">{{ row.draft.text_body }}</p></template></el-table-column>
        <el-table-column label="状态" width="130"><template #default="{ row }"><el-tag :type="canRetrySelection(row.status) ? 'danger' : row.status === 'succeeded' ? 'success' : 'info'">{{ selectionStatus[row.status] || row.status }}</el-tag></template></el-table-column>
        <el-table-column label="提交时间" min-width="175"><template #default="{ row }">{{ formatDate(row.created_at) }}</template></el-table-column>
        <el-table-column label="操作" width="100" align="center" fixed="right"><template #default="{ row }"><el-button link type="primary" @click="openOrder(row.id)">查看工单</el-button></template></el-table-column>
      </el-table>
    </div>
    <div v-if="tab === 'orders'" class="selection-pagination selection-pagination--main"><el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" :page-sizes="[10, 20, 50, 100]" :pager-count="5" background layout="total, sizes, prev, pager, next" @current-change="refresh()" @size-change="refresh(true)" /></div>
    </div>

    <el-dialog v-model="sourceVisible" title="添加来源账号" width="520px" align-center :close-on-click-modal="false">
      <el-form label-position="top"><el-form-item label="平台"><el-select v-model="sourceForm.business_platform"><el-option v-for="item in platforms" :key="String(item.value)" v-bind="item" /></el-select></el-form-item>
        <el-form-item label="账号主页" required><el-input v-model="sourceForm.profile_url" placeholder="https://..." /></el-form-item>
        <el-form-item label="备注"><el-input v-model="sourceForm.remark" maxlength="200" /></el-form-item>
        <el-form-item label="增量采集间隔（分钟）"><el-input-number v-model="sourceForm.interval_minutes" :min="1" :max="1440" /></el-form-item></el-form>
      <template #footer><el-button :disabled="sourceBusy" @click="sourceVisible = false">取消</el-button><el-button type="primary" :loading="sourceBusy" @click="createSource">开始采集</el-button></template>
    </el-dialog>
    <el-dialog v-model="editVisible" class="selection-publish-dialog" title="选题发布" width="1140px" align-center :close-on-click-modal="false" :close-on-press-escape="!publishBusy" :show-close="!publishBusy" @close="editRequestId++; historyRequestId++">
      <el-skeleton v-if="editLoading" :rows="8" animated />
      <el-alert v-else-if="editError" :title="editError" type="error" :closable="false" />
      <div class="publish-body" v-else-if="selected">
        <el-tabs v-model="editTab" class="publish-tabs">
          <el-tab-pane label="内容编辑" name="content" />
          <el-tab-pane v-if="auth.can('operations.dispatch')" :label="`创作记录（${creationTotal}）`" name="creation" />
          <el-tab-pane :label="`发布记录（${previousTotal}）`" name="history" />
        </el-tabs>
        <el-form v-show="editTab !== 'history'" class="publish-account" label-position="left" label-width="80px"><el-form-item label="发布账号" required>
          <el-select-v2 v-model="draft.account_id" :options="accountOptions" filterable :loading="accountsLoading" :disabled="publishBusy || accountsLoading || !auth.can('accounts.view')" placeholder="选择账号">
            <template #prefix><el-avatar :size="26" :src="safeSelectionLink(String(selectedAccount?.avatar_url || ''))"><UserRound :size="16" /></el-avatar></template>
            <template #default="{ item }"><div class="account-option"><el-avatar :size="28" :src="item.avatar"><UserRound :size="16" /></el-avatar><span>{{ item.label }}</span></div></template>
          </el-select-v2>
        </el-form-item></el-form>
        <el-alert v-if="accountsError" :title="accountsError" type="error" :closable="false"><el-button :icon="RefreshCw" :loading="accountsLoading" @click="loadPublishAccounts">重试加载账号</el-button></el-alert>
        <el-alert v-if="historyError" :title="historyError" type="error" :closable="false"><el-button :icon="RefreshCw" :loading="historyLoading" @click="loadPrevious()">重试加载发布记录</el-button></el-alert>
        <div v-show="editTab === 'content'">
        <el-alert v-if="duplicate" title="此账号已有发布工单，请查看原工单" type="warning" :closable="false" />
        <div class="publish-comparison">
        <section><h3 class="original-heading">原帖内容 <a :href="safeSelectionLink(selected.content_url)" target="_blank" rel="noopener noreferrer"><ExternalLink :size="15" />原帖</a></h3><p class="original-text publish-original">{{ selected.text_body || '无正文' }}</p></section>
        <section>
          <SelectionAiEditor v-if="editVisible && auth.can('operations.dispatch')" v-model="draft.text_body" :post-id="selected.id" :revision="selected.updated_at" :account-id="draft.account_id" :platform="String(selectedAccount?.business_platform || '')" :disabled="publishBusy" @busy="aiBusy = $event">
            <el-input v-model="draft.text_body" class="publish-text" aria-label="发布正文" type="textarea" :rows="8" :maxlength="20000" :disabled="publishBusy" resize="none" />
          </SelectionAiEditor>
          <template v-else><h3 class="original-heading">发布稿</h3><el-input v-model="draft.text_body" class="publish-text" aria-label="发布正文" type="textarea" :rows="8" :maxlength="20000" :disabled="publishBusy" resize="none" /></template>
          <PersonaCreationPanel v-if="editVisible && auth.can('operations.dispatch')" :key="`${selected.id}:${draft.account_id}:${selected.updated_at}`"
            :source-id="selected.source_id" :source-name="selected.author.display_name || selected.author.username || '原帖作者'"
            :account-id="draft.account_id" :post-id="selected.id" :revision="selected.updated_at" :model-value="draft.text_body" :disabled="publishBusy || aiBusy"
            history-target="#selection-creation-history" @history-count="creationTotal = $event" @apply="applyCreation" />
        </section>
        </div>
        <section v-if="selected.media.length" class="publish-media"><h3>媒体 <small>已保留 {{ draft.media_indexes.length }} / {{ selected.media.length }} 项</small></h3>
          <el-checkbox-group v-model="draft.media_indexes" class="media-grid"><div v-for="(url, index) in selected.media" :key="url" class="media-item">
            <video v-if="selectionIsVideo(url)" :src="safeSelectionLink(url)" controls preload="metadata" /><el-image v-else :src="safeSelectionLink(url)" fit="contain" :preview-src-list="[safeSelectionLink(url)]" preview-teleported />
            <el-checkbox :value="index" :disabled="publishBusy">保留第 {{ index + 1 }} 项</el-checkbox>
          </div></el-checkbox-group>
        </section>
        </div>
        <div id="selection-creation-history" v-show="editTab === 'creation'" />
        <div v-show="editTab === 'history'" class="publish-history">
          <el-table v-loading="historyLoading" :data="previousOrders" class="selection-table" row-key="id" border stripe max-height="380" empty-text="暂无发布记录">
            <el-table-column label="发布账号" min-width="260"><template #default="{ row }"><div class="source-identity">
              <el-avatar :size="36" :src="safeSelectionLink(row.account.avatar_url)"><UserRound :size="18" /></el-avatar>
              <div><strong>{{ row.account.display_name || row.account.username }}</strong><small>@{{ row.account.username }} · {{ label(row.business_platform) }}</small></div>
            </div></template></el-table-column>
            <el-table-column label="状态" width="120"><template #default="{ row }"><el-tag :type="canRetrySelection(row.status) ? 'danger' : row.status === 'succeeded' ? 'success' : 'info'">{{ selectionStatus[row.status] || row.status }}</el-tag></template></el-table-column>
            <el-table-column label="提交时间" min-width="175"><template #default="{ row }">{{ formatDate(row.created_at) }}</template></el-table-column>
            <el-table-column label="操作" width="110" fixed="right"><template #default="{ row }"><el-button link type="primary" @click="openOrder(row.id)">查看工单</el-button></template></el-table-column>
          </el-table>
          <div class="selection-pagination"><el-pagination v-model:current-page="previousPage" :total="previousTotal" :page-size="20" :pager-count="5" :disabled="historyLoading || editLoading" background layout="total, prev, pager, next" @current-change="loadPrevious()" /></div>
        </div>
      </div>
      <template #footer><el-button :disabled="publishBusy" @click="editVisible = false">关闭</el-button><el-button v-if="auth.can('operations.dispatch')" type="primary" :loading="publishBusy" :disabled="editLoading || accountsLoading || historyLoading || !!editError || !!accountsError || !!historyError || aiBusy || !selected || !draft.account_id || !!duplicate || (!draft.text_body.trim() && !draft.media_indexes.length)" @click="publish"><Send :size="15" />确认发布</el-button></template>
    </el-dialog>
    <el-dialog v-model="orderVisible" title="选题发布工单" width="980px" align-center :close-on-click-modal="false" @closed="detailRequestId++">
      <div v-loading="orderBusy" class="order-body" v-if="detail"><p class="order-id">工单 ID：{{ detail.id }}</p><p>{{ detail.account.display_name || detail.account.username }} · {{ label(detail.business_platform) }} · {{ selectionStatus[detail.status] || detail.status }}</p>
        <a :href="safeSelectionLink(detail.original.content_url)" target="_blank" rel="noopener noreferrer">打开原帖</a>
        <el-alert v-if="detail.error_message" :title="detail.error_message" type="error" :closable="false" />
        <div class="editor"><section><h3>原文快照</h3><p class="original-text">{{ detail.original.text_body }}</p></section><section><h3>发布稿</h3><p class="original-text">{{ detail.draft.text_body }}</p><div class="media-grid"><div v-for="url in detail.draft.media" :key="url" class="media-item"><video v-if="selectionIsVideo(url)" :src="safeSelectionLink(url)" controls preload="metadata" /><el-image v-else :src="safeSelectionLink(url)" fit="contain" :preview-src-list="[safeSelectionLink(url)]" preview-teleported /></div></div></section></div>
        <h3>执行记录</h3><el-table :data="detail.attempts"><el-table-column label="任务 ID" prop="task_id" width="130" /><el-table-column label="状态" width="130"><template #default="{ row }">{{ selectionStatus[row.status] || row.status }}</template></el-table-column><el-table-column label="执行结果" prop="error_message" min-width="240" /><el-table-column label="创建时间" width="180"><template #default="{ row }">{{ formatDate(row.created_at) }}</template></el-table-column></el-table>
      </div>
      <template #footer><el-button v-if="detail" :disabled="orderBusy" @click="openOrder(detail.id)"><RefreshCw :size="15" />刷新状态</el-button><el-button v-if="detail && canRetrySelection(detail.status) && auth.can('operations.retry')" type="primary" :loading="orderBusy" @click="retryOrder"><RotateCcw :size="15" />重试发布</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
:global(.selection-publish-dialog) { max-height: calc(100dvh - 32px); display: flex; flex-direction: column; margin: auto !important; }
:global(.selection-publish-dialog .el-dialog__body) { min-height: 0; overflow-y: auto; }
:global(.selection-publish-dialog .el-dialog__header), :global(.selection-publish-dialog .el-dialog__footer) { flex-shrink: 0; }
.publish-account { padding-bottom: 16px; border-bottom: 1px solid var(--app-border, #dce3eb); margin-bottom: 16px; }
.publish-account :deep(.el-form-item) { margin-bottom: 0; }
.publish-account :deep(.el-select) { max-width: 720px; }
.account-option { display: flex; align-items: center; gap: 8px; min-width: 0; }
.account-option :deep(.el-avatar) { flex-shrink: 0; }
.account-option span { overflow: hidden; text-overflow: ellipsis; }
.publish-comparison { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; }
.publish-comparison > section { min-width: 0; }
.original-heading { display: flex; align-items: center; justify-content: space-between; min-height: 40px; margin: 0 0 12px; }
.publish-original { height: 212px; overflow-y: auto; padding: 10px 12px; box-sizing: border-box; background: var(--app-surface-muted, #f8fafc); border: 1px solid var(--app-border, #dce3eb); border-radius: 4px; }
.publish-text :deep(textarea) { height: 212px; min-height: 212px !important; line-height: 1.7; padding: 10px 12px; }
.publish-media { padding-top: 16px; border-top: 1px solid var(--app-border, #dce3eb); }
.publish-media h3 { display: flex; align-items: center; gap: 12px; }
.publish-tabs :deep(.el-tabs__header) { margin-bottom: 16px; }
.publish-history { min-width: 0; }
@media (max-width: 760px) { .publish-comparison { grid-template-columns: minmax(0, 1fr); gap: 16px; } .publish-original { height: auto; max-height: 212px; } }
.selection-view { min-width: 0; border: 1px solid var(--app-border, #d9e2ec); border-radius: 8px; overflow: clip; background: var(--app-surface, #fff); }
.selection-heading, .selection-heading > div, .author, footer, footer > span { display: flex; align-items: center; gap: 12px; }
.selection-heading { justify-content: space-between; gap: 16px; min-height: 70px; padding: 13px 16px; border-bottom: 1px solid var(--app-border, #e6edf3); }
.selection-title { min-width: 0; gap: 10px; }
.selection-icon { display: inline-flex; flex: 0 0 34px; align-items: center; justify-content: center; height: 34px; border-radius: 8px; color: var(--app-blue, #1f668f); background: var(--app-surface-muted, #eef8ff); }
.selection-actions { flex-shrink: 0; justify-content: flex-end; gap: 10px; }
h1 { margin: 0; color: var(--app-text, #1f2933); font-size: 18px; font-weight: 700; line-height: 1.25; } h3 { font-size: 15px; margin: 0 0 14px; }
.selection-tabs :deep(.el-tabs__header) { margin: 0; padding: 0 16px; }
.selection-tabs :deep(.el-tabs__nav-wrap::after) { height: 1px; background: var(--app-border, #e6edf3); }
.selection-tabs :deep(.el-tabs__item) { height: 40px; color: var(--app-text, #52606d); font-size: 13px; font-weight: 600; }
.selection-tabs :deep(.el-tabs__item.is-active) { color: var(--app-blue, #1f668f); }
.selection-tab-label { display: inline-flex; align-items: center; gap: 6px; }
.selection-body { padding: 14px 16px 16px; background: var(--app-surface-muted, #f8fafc); }
h3 a { float: right; display: inline-flex; align-items: center; gap: 4px; font-size: 13px; } a { color: var(--app-blue, #28678d); overflow-wrap: anywhere; }
small { display: block; color: var(--app-text-muted, #697786); font-size: 12px; line-height: 1.7; }
/* Match the shell navigation, including its extra mobile navigation row. */
.selection-filters { --filter-top: 73px; position: sticky; top: var(--filter-top); z-index: 20; max-height: calc(100dvh - var(--filter-top) - 120px); overflow-y: auto; box-sizing: border-box; margin-bottom: 12px; padding: 12px; border: 1px solid var(--app-border, #dbe4ed); border-radius: 6px; background: var(--app-surface, #fff); }
.filter-title { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; color: var(--app-text, #26384a); font-size: 13px; font-weight: 700; }
.filter-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px 14px; }
.filter-grid :deep(.el-form-item) { margin-right: 0; margin-bottom: 0; min-width: 0; }
.filter-grid :deep(.el-form-item__label) { min-width: 72px; justify-content: flex-end; color: var(--app-text, #52606d); font-size: 12px; font-weight: 600; text-align: right; }
.filter-grid :deep(.el-form-item__content) { min-width: 0; }
.filter-grid :deep(.el-select), .filter-grid :deep(.el-input), .filter-grid :deep(.el-date-editor), .filter-grid :deep(.el-input-number) { width: 100%; min-width: 0; }
.filter-grid__item--wide { grid-column: span 2; }
.filter-actions { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.filter-actions :deep(.el-button + .el-button) { margin-left: 0; }
.selection-content { min-height: 200px; } .post-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; max-width: 960px; margin: auto; }
.post-item { min-width: 0; background: var(--app-surface, #fff); border: 1px solid var(--app-border, #dce3eb); border-radius: 6px; padding: 14px; display: flex; flex-direction: column; gap: 12px; }
.author { min-width: 0; } .author > div { min-width: 0; overflow-wrap: anywhere; } .author :deep(.el-avatar) { flex: 0 0 36px; }
.source-identity { display: flex; align-items: center; gap: 12px; padding: 6px 0; min-width: 0; }
.source-identity :deep(.el-avatar) { flex-shrink: 0; }
.source-identity > div { min-width: 0; overflow-wrap: anywhere; }
.source-identity strong { color: var(--app-text, #26384a); font-size: 14px; font-weight: 700; }
.selection-table :deep(.el-table__header th) { background: var(--app-surface-muted, #f8fafc); color: var(--app-text, #52606d); font-size: 12px; font-weight: 600; }
.post-cover { width: 100%; height: 260px; object-fit: contain; background: var(--app-surface-muted, #f6f8fa); }
.post-text { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0; line-height: 1.8; font-size: 15px; }
.expand-post { align-self: flex-start; }
.post-marks { display: flex; align-items: center; gap: 8px; margin-left: auto; flex-shrink: 0; }
.feed-media { display: flex; overflow-x: auto; gap: 12px; scroll-snap-type: x proximity; }
.feed-media > div { flex: 0 0 min(100%, 360px); scroll-snap-align: start; }
.feed-media video, .feed-media .el-image { width: 100%; height: 320px; object-fit: contain; background: var(--app-surface-muted, #f8fafc); }
.feed-more { text-align: center; padding: 20px; }
.feed-controls { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.feed-controls .el-select { width: 132px; }
.feed-controls .el-input { width: 220px; max-width: 100%; }
.feed-controls + .el-form { margin-top: 16px; }
.filter-title .el-button { margin-left: auto; }
footer { justify-content: space-between; margin-top: auto; flex-wrap: wrap; } footer > span { font-size: 13px; gap: 6px; flex-wrap: wrap; }
footer > span > span { display: inline-flex; align-items: center; gap: 6px; }
.selection-option-filters { margin-top: 12px; }
.selection-option-filters :deep(.el-form-item) { margin-bottom: 12px; }
.selection-option-filters :deep(.el-form-item__content) { min-width: 0; }
.selection-pagination { display: flex; justify-content: flex-end; padding-top: 16px; overflow-x: auto; }
.selection-pagination--main { padding: 14px 16px; border: 1px solid var(--app-border, #e6edf3); background: var(--app-surface, #fff); }
.editor { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; max-height: 65vh; overflow-y: auto; }
.editor > section { min-width: 0; } .editor .el-select { width: 100%; }
.original-text { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.7; margin: 0 0 18px; }
.media-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 12px; }
.media-item { min-width: 0; } .media-item video, .media-item .el-image { width: 100%; height: 250px; object-fit: contain; background: var(--app-surface-muted, #f6f8fa); }
.previous-order { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--app-border, #dce3eb); overflow-wrap: anywhere; }
.list-text { white-space: pre-wrap; margin: 0; max-height: 70px; overflow: hidden; overflow-wrap: anywhere; }
.order-body { max-height: 68vh; overflow-y: auto; } .order-body .editor { max-height: none; margin-top: 20px; } .order-id { overflow-wrap: anywhere; }
:deep(.el-button > span) { gap: 6px; }
@media (max-width: 1023px) { .selection-filters { --filter-top: 122px; } }
@media (max-width: 760px) { .editor { grid-template-columns: minmax(0, 1fr); } .selection-heading { flex-direction: column; align-items: flex-start; } .selection-actions { width: 100%; } .selection-body { padding: 12px; } .selection-filters :deep(.el-date-editor) { width: 100%; min-width: 0; } }
@media (max-width: 640px) { .filter-grid { grid-template-columns: minmax(0, 1fr); } .filter-grid__item--wide { grid-column: auto; } .selection-pagination { justify-content: flex-start; } }
</style>
