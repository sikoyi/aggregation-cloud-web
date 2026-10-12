<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ClipboardList, ExternalLink, FileText, Heart, MessageCircle, Pause, Play, Plus, RefreshCw, RotateCcw, Search, Send, UserRound, Users } from 'lucide-vue-next'
import { contentSelection, type SelectionOrder, type SelectionPost, type SelectionSource } from '@/api/contentSelection'
import { loadAccountSelectionOptions } from '@/api/selectionOptions'
import { useAuthStore } from '@/stores/auth'
import { useScopedBusinessPlatformOptions } from '@/composables/useScopedBusinessPlatformOptions'
import { formatDate } from '@/utils/format'
import { canRetrySelection, safeSelectionLink, selectionIsVideo, selectionStatus } from '@/utils/contentSelection'
import type { AnyRecord } from '@/types/api'

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
const page = ref(1)
const pageSize = ref(20)
const dates = ref<[string, string] | null>(null)
const filters = reactive({ platform: '', source_id: '', keyword: '', media_type: '', min_likes: undefined as number | undefined, min_comments: undefined as number | undefined, sort_by: 'published_at' })
const hasFilters = computed(() => !!(filters.platform || filters.source_id || filters.keyword || filters.media_type || dates.value || filters.min_likes !== undefined || filters.min_comments !== undefined || filters.sort_by !== 'published_at'))
function resetFilters() {
  Object.assign(filters, { platform: '', source_id: '', keyword: '', media_type: '', min_likes: undefined, min_comments: undefined, sort_by: 'published_at' })
  dates.value = null
  void refresh(true)
}
const sourceVisible = ref(false)
const sourceBusy = ref(false)
const sourceForm = reactive({ business_platform: 'threads', profile_url: '', remark: '', interval_minutes: 60 })
const selected = ref<SelectionPost | null>(null)
const editVisible = ref(false)
const editLoading = ref(false)
const publishBusy = ref(false)
const draft = reactive({ account_id: '', text_body: '', media_indexes: [] as number[] })
const accounts = ref<AnyRecord[]>([])
const previousOrders = ref<SelectionOrder[]>([])
const previousTotal = ref(0)
const previousPage = ref(1)
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
  loading.value = true
  error.value = ''
  const current = tab.value
  try {
    if (current === 'sources') {
      const result = await contentSelection.sources()
      if (id === requestId) { sources.value = result; total.value = result.length }
    } else if (current === 'orders') {
      const result = await contentSelection.orders({ page: page.value, page_size: pageSize.value })
      if (id === requestId) { orders.value = result.items; total.value = result.total }
    } else {
      const result = await contentSelection.posts({ ...filters, page: page.value, page_size: pageSize.value, published_from: dates.value?.[0], published_to: dates.value?.[1] })
      if (id === requestId) { posts.value = result.items; total.value = result.total }
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
  const id = ++editRequestId
  selected.value = null
  previousOrders.value = []
  draft.account_id = ''
  editVisible.value = true
  editLoading.value = true
  previousPage.value = 1
  try {
    const current = await contentSelection.post(post.id)
    if (id !== editRequestId) return
    selected.value = current
    draft.text_body = current.text_body
    draft.media_indexes = current.media.map((_, index) => index)
    const history = await contentSelection.orders({ post_id: post.id, page: 1, page_size: 20 })
    if (id !== editRequestId) return
    previousOrders.value = history.items
    previousTotal.value = history.total
    if (auth.can('operations.dispatch') && auth.can('accounts.view')) {
      const result = await loadAccountSelectionOptions({}, { associationOnly: true })
      if (id === editRequestId) accounts.value = result.filter(a => ['threads', 'x', 'instagram'].includes(String(a.business_platform)) && a.bound_slot_id)
    }
  } catch (e) { if (id === editRequestId) showError(e) }
  finally { if (id === editRequestId) editLoading.value = false }
}
async function loadPrevious() {
  const id = editRequestId
  if (!selected.value) return
  try {
    const result = await contentSelection.orders({ post_id: selected.value.id, page: previousPage.value, page_size: 20 })
    if (id === editRequestId) previousOrders.value = result.items
  } catch (e) { showError(e) }
}
async function publish() {
  if (!selected.value || !draft.account_id || publishBusy.value) return
  try { await ElMessageBox.confirm('将发布到所选账号，确认提交？', '确认发布', { type: 'warning' }) } catch { return }
  if (publishBusy.value || !selected.value) return
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
  sourceForm.business_platform = String(platforms.value[0]?.value || 'threads')
  await refresh()
  try { sources.value = await contentSelection.sources() } catch (e) { showError(e) }
  if (typeof route.query.order_id === 'string') await openOrder(route.query.order_id)
})
onBeforeUnmount(() => { requestId++; editRequestId++; detailRequestId++ })
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
      <div class="filter-title"><Search :size="14" /><span>筛选条件</span></div>
      <el-form class="compact-filter-form" inline label-position="right" label-suffix=":" @submit.prevent="refresh(true)">
        <div class="filter-grid">
      <el-form-item label="来源平台"><el-select v-model="filters.platform" clearable placeholder="全部"><el-option v-for="item in platforms" :key="String(item.value)" v-bind="item" /></el-select></el-form-item>
      <el-form-item label="来源账号"><el-select v-model="filters.source_id" filterable clearable placeholder="全部"><el-option v-for="item in sources" :key="item.id" :value="item.id" :label="`${item.profile?.display_name || sourceUsername(item)} · @${sourceUsername(item)}${item.remark ? ' · ' + item.remark : ''}`" /></el-select></el-form-item>
      <el-form-item label="关键词"><el-input v-model="filters.keyword" placeholder="正文 / 作者" clearable /></el-form-item>
      <el-form-item label="媒体"><el-select v-model="filters.media_type" clearable placeholder="全部"><el-option label="图片" value="image" /><el-option label="视频" value="video" /><el-option label="纯文字" value="text" /></el-select></el-form-item>
      <el-form-item label="发布时间" class="filter-grid__item--wide"><el-date-picker v-model="dates" type="datetimerange" value-format="YYYY-MM-DDTHH:mm:ssZ" range-separator="至" start-placeholder="开始时间" end-placeholder="结束时间" /></el-form-item>
      <el-form-item label="最低点赞"><el-input-number v-model="filters.min_likes" :min="0" controls-position="right" /></el-form-item>
      <el-form-item label="最低评论"><el-input-number v-model="filters.min_comments" :min="0" controls-position="right" /></el-form-item>
      <el-form-item label="排序"><el-select v-model="filters.sort_by"><el-option label="最新发布" value="published_at" /><el-option label="点赞最多" value="likes_count" /><el-option label="评论最多" value="comments_count" /></el-select></el-form-item>
        </div>
        <div class="filter-actions">
          <el-button :icon="RotateCcw" :disabled="!hasFilters" @click="resetFilters">清空</el-button>
          <el-button type="primary" :icon="Search" :loading="loading" native-type="submit">查询</el-button>
        </div>
      </el-form>
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <div v-loading="loading" class="selection-content">
      <template v-if="tab === 'posts'">
        <el-empty v-if="!posts.length && !loading && !error" description="暂无选题" />
        <div class="post-grid">
          <article v-for="post in posts" :key="post.id" class="post-item">
            <header class="author"><el-avatar :src="safeSelectionLink(post.author.avatar_url)"><UserRound :size="20" /></el-avatar><div>
              <a :href="safeSelectionLink(post.author.profile_url)" target="_blank" rel="noopener noreferrer">{{ post.author.display_name || post.author.username }}</a>
              <small>{{ label(post.business_platform) }} · @{{ post.author.username }}</small>
            </div></header>
            <video v-if="post.media[0] && selectionIsVideo(post.media[0])" class="post-cover" :src="safeSelectionLink(post.media[0])" controls preload="metadata" />
            <el-image v-else-if="post.media[0]" class="post-cover" :src="safeSelectionLink(post.media[0])" fit="contain" :preview-src-list="post.media.filter(url => !selectionIsVideo(url)).map(url => safeSelectionLink(url))" preview-teleported><template #error>媒体暂不可用</template></el-image>
            <p class="post-text">{{ post.text_body }}</p>
            <small>{{ post.published_at ? formatDate(post.published_at) : '发布时间未知' }}<span v-if="post.media.length"> · {{ post.media.length }} 项媒体</span></small>
            <footer><span><Heart :size="15" />{{ post.likes_count ?? '未知' }}<MessageCircle :size="15" />{{ post.comments_count ?? '未知' }}</span>
              <el-button @click="openPost(post)">查看选题<ExternalLink :size="14" /></el-button></footer>
          </article>
        </div>
      </template>
      <el-table v-else-if="tab === 'sources'" :data="sources" class="selection-table" row-key="id" border stripe empty-text="暂无来源账号">
        <el-table-column label="来源账号" min-width="260"><template #default="{ row }"><div class="source-identity">
          <el-avatar :size="44" :src="safeSelectionLink(row.profile?.avatar_url)"><UserRound :size="22" /></el-avatar>
          <div><a :href="safeSelectionLink(row.profile_url)" target="_blank" rel="noopener noreferrer"><strong>{{ row.profile?.display_name || sourceUsername(row as SelectionSource) || '待采集账号' }}</strong><small v-if="sourceUsername(row as SelectionSource)">@{{ sourceUsername(row as SelectionSource) }}</small></a></div>
        </div></template></el-table-column>
        <el-table-column label="平台" width="130" align="center"><template #default="{ row }"><el-tag effect="plain">{{ label(row.business_platform) }}</el-tag></template></el-table-column>
        <el-table-column label="状态" width="120" align="center"><template #default="{ row }"><el-tag :type="row.status === 'retrying' ? 'danger' : row.status === 'active' ? 'success' : row.status === 'collecting' ? 'warning' : 'info'">{{ selectionStatus[row.status] || row.status }}</el-tag></template></el-table-column>
        <el-table-column label="历史采集" min-width="170"><template #default="{ row }">{{ row.history_complete ? '可获取历史已完成' : '历史采集中' }}<small>已处理 {{ row.pages_collected }} 页 · {{ row.post_count }} 条主帖</small></template></el-table-column>
        <el-table-column label="备注" prop="remark" min-width="160" show-overflow-tooltip />
        <el-table-column label="异常原因" prop="last_error" min-width="240" show-overflow-tooltip />
        <el-table-column label="操作" width="90" align="center" fixed="right"><template #default="{ row }"><el-tooltip v-if="auth.can('operations.edit')" :content="row.enabled ? '暂停采集' : '继续采集'"><el-button link type="primary" :icon="row.enabled ? Pause : Play" :aria-label="row.enabled ? '暂停采集' : '继续采集'" :disabled="sourceBusy" @click="toggleSource(row as SelectionSource)" /></el-tooltip></template></el-table-column>
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
    <div v-if="tab !== 'sources'" class="selection-pagination selection-pagination--main"><el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" :page-sizes="[10, 20, 50, 100]" :pager-count="5" background layout="total, sizes, prev, pager, next" @current-change="refresh()" @size-change="refresh(true)" /></div>
    </div>

    <el-dialog v-model="sourceVisible" title="添加来源账号" width="520px" align-center :close-on-click-modal="false">
      <el-form label-position="top"><el-form-item label="平台"><el-select v-model="sourceForm.business_platform"><el-option v-for="item in platforms" :key="String(item.value)" v-bind="item" /></el-select></el-form-item>
        <el-form-item label="账号主页" required><el-input v-model="sourceForm.profile_url" placeholder="https://..." /></el-form-item>
        <el-form-item label="备注"><el-input v-model="sourceForm.remark" maxlength="200" /></el-form-item>
        <el-form-item label="增量采集间隔（分钟）"><el-input-number v-model="sourceForm.interval_minutes" :min="1" :max="1440" /></el-form-item></el-form>
      <template #footer><el-button :disabled="sourceBusy" @click="sourceVisible = false">取消</el-button><el-button type="primary" :loading="sourceBusy" @click="createSource">开始采集</el-button></template>
    </el-dialog>
    <el-dialog v-model="editVisible" title="选题发布" width="1140px" align-center :close-on-click-modal="false" :close-on-press-escape="!publishBusy" :show-close="!publishBusy" @closed="editRequestId++">
      <div v-loading="editLoading" class="editor" v-if="selected">
        <section><h3>原帖内容 <a :href="safeSelectionLink(selected.content_url)" target="_blank" rel="noopener noreferrer"><ExternalLink :size="15" />原帖</a></h3><p class="original-text">{{ selected.text_body }}</p>
          <el-checkbox-group v-model="draft.media_indexes" class="media-grid"><div v-for="(url, index) in selected.media" :key="url" class="media-item">
            <video v-if="selectionIsVideo(url)" :src="safeSelectionLink(url)" controls preload="metadata" /><el-image v-else :src="safeSelectionLink(url)" fit="contain" :preview-src-list="[safeSelectionLink(url)]" preview-teleported />
            <el-checkbox :value="index" :disabled="publishBusy">保留第 {{ index + 1 }} 项</el-checkbox>
          </div></el-checkbox-group>
        </section>
        <section><h3>发布稿</h3><el-form label-position="top"><el-form-item label="发布账号" required><el-select v-model="draft.account_id" filterable :disabled="publishBusy || !auth.can('accounts.view')" placeholder="选择账号">
          <el-option v-for="account in accounts" :key="String(account.id)" :value="String(account.id)" :label="`${account.display_name || account.username} · @${account.username || ''} · ${label(String(account.business_platform))} · ID ${account.id}`" />
        </el-select></el-form-item><el-form-item label="发布正文"><el-input v-model="draft.text_body" type="textarea" :rows="9" :maxlength="20000" :disabled="publishBusy" /></el-form-item></el-form>
          <p>已保留 {{ draft.media_indexes.length }} 项媒体</p>
          <el-alert v-if="duplicate" title="此账号已有发布工单，请查看原工单" type="warning" :closable="false" />
          <h3>已使用账号</h3><el-empty v-if="!previousTotal" description="尚未提交发布" :image-size="48" />
          <div v-for="order in previousOrders" :key="order.id" class="previous-order"><span>{{ order.account.display_name || order.account.username }} · {{ selectionStatus[order.status] || order.status }}</span><el-button link type="primary" @click="openOrder(order.id)">查看工单</el-button></div>
          <div v-if="previousTotal > 20" class="selection-pagination"><el-pagination v-model:current-page="previousPage" :total="previousTotal" :page-size="20" :pager-count="5" layout="total, prev, pager, next" @current-change="loadPrevious" /></div>
        </section>
      </div>
      <template #footer><el-button :disabled="publishBusy" @click="editVisible = false">关闭</el-button><el-button v-if="auth.can('operations.dispatch')" type="primary" :loading="publishBusy" :disabled="editLoading || !selected || !draft.account_id || !!duplicate || (!draft.text_body.trim() && !draft.media_indexes.length)" @click="publish"><Send :size="15" />确认发布</el-button></template>
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
.selection-view { min-width: 0; border: 1px solid var(--app-border, #d9e2ec); border-radius: 8px; overflow: hidden; background: var(--app-surface, #fff); }
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
.selection-filters { margin-bottom: 12px; padding: 12px; border: 1px solid var(--app-border, #dbe4ed); border-radius: 6px; background: var(--app-surface, #fff); }
.filter-title { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; color: var(--app-text, #26384a); font-size: 13px; font-weight: 700; }
.filter-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px 14px; }
.filter-grid :deep(.el-form-item) { margin-right: 0; margin-bottom: 0; min-width: 0; }
.filter-grid :deep(.el-form-item__label) { min-width: 72px; justify-content: flex-end; color: var(--app-text, #52606d); font-size: 12px; font-weight: 600; text-align: right; }
.filter-grid :deep(.el-form-item__content) { min-width: 0; }
.filter-grid :deep(.el-select), .filter-grid :deep(.el-input), .filter-grid :deep(.el-date-editor), .filter-grid :deep(.el-input-number) { width: 100%; min-width: 0; }
.filter-grid__item--wide { grid-column: span 2; }
.filter-actions { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.filter-actions :deep(.el-button + .el-button) { margin-left: 0; }
.selection-content { min-height: 200px; background: var(--app-surface, #fff); } .post-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 290px), 1fr)); gap: 16px; }
.post-item { min-width: 0; background: var(--app-surface, #fff); border: 1px solid var(--app-border, #dce3eb); border-radius: 6px; padding: 14px; display: flex; flex-direction: column; gap: 12px; }
.author { min-width: 0; } .author > div { min-width: 0; overflow-wrap: anywhere; } .author :deep(.el-avatar) { flex: 0 0 36px; }
.source-identity { display: flex; align-items: center; gap: 12px; padding: 6px 0; min-width: 0; }
.source-identity :deep(.el-avatar) { flex-shrink: 0; }
.source-identity > div { min-width: 0; overflow-wrap: anywhere; }
.source-identity strong { color: var(--app-text, #26384a); font-size: 14px; font-weight: 700; }
.selection-table :deep(.el-table__header th) { background: var(--app-surface-muted, #f8fafc); color: var(--app-text, #52606d); font-size: 12px; font-weight: 600; }
.post-cover { width: 100%; height: 260px; object-fit: contain; background: var(--app-surface-muted, #f6f8fa); }
.post-text { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0; display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden; min-height: 100px; }
footer { justify-content: space-between; margin-top: auto; flex-wrap: wrap; } footer > span { font-size: 13px; gap: 6px; }
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
@media (max-width: 760px) { .editor { grid-template-columns: minmax(0, 1fr); } .selection-heading { flex-direction: column; align-items: flex-start; } .selection-actions { width: 100%; } .selection-body { padding: 12px; } .selection-filters :deep(.el-date-editor) { width: 100%; min-width: 0; } }
@media (max-width: 640px) { .filter-grid { grid-template-columns: minmax(0, 1fr); } .filter-grid__item--wide { grid-column: auto; } .selection-pagination { justify-content: flex-start; } }
</style>
