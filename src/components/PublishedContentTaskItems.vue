<script setup lang="ts">
import { Eye, Trash2 } from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, ref, watch } from 'vue'

import { http } from '@/api/http'
import PublishedContentTableCell from '@/components/PublishedContentTableCell.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import type { AnyRecord, PageResult } from '@/types/api'
import { notifyError } from '@/utils/notify'

const props = defineProps<{
  taskId: string
  canDelete?: boolean
}>()

const emit = defineEmits<{
  openDetail: [contentId: string]
  changed: []
}>()

const loading = ref(false)
const deletingId = ref('')
const rows = ref<AnyRecord[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)

async function loadRows() {
  loading.value = true
  try {
    const data = await http.get<PageResult<AnyRecord>>(
      `/api/interaction-center/published-results/${props.taskId}/items`,
      { page: page.value, page_size: pageSize.value },
    )
    rows.value = data.items
    total.value = data.total
  } catch (error) {
    notifyError(error, '帖子明细加载失败', '帖子明细加载失败')
  } finally {
    loading.value = false
  }
}

async function deleteContent(row: AnyRecord) {
  const contentId = String(row.published_content_id || '')
  if (!contentId) return
  try {
    await ElMessageBox.confirm(
      '确认删除该发布内容？评论、指标快照和监听记录会一起删除。',
      '确认删除',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }

  deletingId.value = contentId
  try {
    await http.delete(`/api/interaction-center/published-contents/${contentId}`)
    ElMessage.success('发布内容已删除')
    if (rows.value.length === 1 && page.value > 1) page.value -= 1
    await loadRows()
    emit('changed')
  } catch (error) {
    notifyError(error, '删除失败', '删除发布内容失败')
  } finally {
    deletingId.value = ''
  }
}

watch(() => props.taskId, () => {
  page.value = 1
  loadRows()
})

onMounted(loadRows)
</script>

<template>
  <section class="published-task-items">
    <div class="published-task-items__header">
      <div>
        <strong>帖子明细</strong>
        <span>共 {{ total }} 个设备执行结果</span>
      </div>
      <small>任务 ID {{ taskId }}</small>
    </div>

    <el-table v-loading="loading" :data="rows" border stripe table-layout="auto" empty-text="暂无设备执行结果">
      <el-table-column label="发布内容" min-width="250">
        <template #default="{ row }">
          <PublishedContentTableCell kind="publishedContentIdentity" :row="row" />
        </template>
      </el-table-column>
      <el-table-column label="账号 / 设备" min-width="190">
        <template #default="{ row }">
          <PublishedContentTableCell kind="publishedContentPublisher" :row="row" />
        </template>
      </el-table-column>
      <el-table-column label="帖子链接" min-width="150">
        <template #default="{ row }">
          <PublishedContentTableCell kind="publishedContentLink" :row="row" />
        </template>
      </el-table-column>
      <el-table-column label="互动数据" min-width="220">
        <template #default="{ row }">
          <PublishedContentTableCell kind="publishedContentMetrics" :row="row" />
        </template>
      </el-table-column>
      <el-table-column label="执行状态" width="120" align="center">
        <template #default="{ row }">
          <StatusBadge :value="row.task_status" />
          <el-popover
            v-if="row.error_message"
            placement="top"
            trigger="click"
            :width="360"
          >
            <template #reference>
              <el-button link type="danger" class="published-task-items__error">查看失败原因</el-button>
            </template>
            <div class="published-task-items__error-detail">
              <strong>失败原因</strong>
              <p>{{ String(row.error_message) }}</p>
            </div>
          </el-popover>
        </template>
      </el-table-column>
      <el-table-column label="发布时间" width="190" align="center">
        <template #default="{ row }">
          <PublishedContentTableCell kind="publishedContentTimeline" :row="row" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="104" align="center">
        <template #default="{ row }">
          <el-tooltip content="查看详情" placement="top">
            <el-button
              text
              circle
              :icon="Eye"
              :disabled="!row.published_content_id"
              @click="emit('openDetail', String(row.published_content_id))"
            />
          </el-tooltip>
          <el-tooltip v-if="canDelete" content="删除" placement="top">
            <el-button
              text
              circle
              type="danger"
              :icon="Trash2"
              :disabled="!row.published_content_id"
              :loading="deletingId === String(row.published_content_id || '')"
              @click="deleteContent(row)"
            />
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="total > pageSize" class="published-task-items__pagination">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        background
        layout="total, sizes, prev, pager, next"
        :page-sizes="[10, 20, 50]"
        :total="total"
        @current-change="loadRows"
        @size-change="page = 1; loadRows()"
      />
    </div>
  </section>
</template>

<style scoped>
.published-task-items { padding: 14px 18px 18px 48px; background: #f8fafc; }
.published-task-items__header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 10px; }
.published-task-items__header > div { display: flex; align-items: baseline; gap: 8px; }
.published-task-items__header strong { color: #243b53; font-size: 13px; }
.published-task-items__header span,
.published-task-items__header small { color: #8293a5; font-size: 11px; }
.published-task-items__error { height: auto; margin-top: 5px; padding: 0; font-size: 10px; line-height: 16px; }
.published-task-items__error-detail { color: #40566c; }
.published-task-items__error-detail strong { display: block; margin-bottom: 7px; color: #b33e3e; font-size: 12px; }
.published-task-items__error-detail p { margin: 0; color: #526578; font-size: 12px; line-height: 20px; overflow-wrap: anywhere; white-space: pre-wrap; }
.published-task-items__pagination { display: flex; justify-content: flex-end; padding-top: 12px; }
</style>
