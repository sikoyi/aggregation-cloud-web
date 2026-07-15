<script setup lang="ts">
import { Eye, RefreshCw } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { http } from '@/api/http'
import PublishedContentDetailDialog from '@/components/PublishedContentDetailDialog.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { REALTIME_EVENT_NAME, type RealtimeEventPayload } from '@/composables/useRealtimeEvents'
import {
  businessPlatformOptions,
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
          当前账号：{{ accountName }}
        </div>
      </div>
      <el-button :icon="RefreshCw" :loading="loading" @click="loadRows">刷新</el-button>
    </div>

    <el-table
      v-loading="loading"
      :data="rows"
      border
      stripe
      table-layout="auto"
      empty-text="该账号暂无内容"
    >
      <el-table-column label="ID" width="82" align="center">
        <template #default="{ row }">
          <span class="font-mono text-xs" :title="String(row.id || '')">{{ truncateId(row.id) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="标题" min-width="220" show-overflow-tooltip />
      <el-table-column label="业务 App" width="120" align="center">
        <template #default="{ row }">{{ optionLabel(businessPlatformOptions, row.business_platform) }}</template>
      </el-table-column>
      <el-table-column label="内容类型" width="120" align="center">
        <template #default="{ row }">{{ optionLabel(publishedContentTypeOptions, row.content_type) }}</template>
      </el-table-column>
      <el-table-column prop="comment_count" label="评论" width="84" align="center" />
      <el-table-column prop="like_count" label="点赞" width="84" align="center" />
      <el-table-column label="状态" width="110" align="center">
        <template #default="{ row }">
          <StatusBadge :value="row.status" />
          <span class="sr-only">{{ optionLabel(publishedContentStatusOptions, row.status) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="发布时间" min-width="170" align="center">
        <template #default="{ row }">{{ formatDate(row.published_at) }}</template>
      </el-table-column>
      <el-table-column label="最近采集" min-width="170" align="center">
        <template #default="{ row }">{{ formatDate(row.last_collected_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="90" align="center" fixed="right">
        <template #default="{ row }">
          <el-tooltip content="查看详情" placement="top">
            <el-button text circle :icon="Eye" @click="openDetail(row)" />
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
</style>
