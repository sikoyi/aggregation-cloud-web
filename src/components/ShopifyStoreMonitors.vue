<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { RefreshCw, RotateCcw, Search } from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import { http } from '@/api/http'
import { formatDate } from '@/utils/format'
import type { AnyRecord } from '@/types/api'

const labels: Record<string, string> = { active: '监听中', retrying: '等待重试', stopped_banned: '封禁状态，停止监听', stopped_exported: '已导出，停止监听', missing_url: '缺少店铺链接', pending: '等待首次检查' }
const rows = ref<AnyRecord[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const state = ref('')
const loading = ref(false)
const error = ref('')
const rechecking = ref('')
let disposed = false
let sequence = 0
let timer: ReturnType<typeof setInterval> | undefined
async function load() {
  const request = ++sequence
  loading.value = true
  error.value = ''
  try {
    const data = await http.get<{ items: AnyRecord[]; total: number }>('/api/accounts/shopify-monitors', { keyword: keyword.value, state: state.value, page: page.value, page_size: pageSize.value })
    if (request !== sequence) return
    rows.value = data.items
    total.value = data.total
  } catch (e) { if (request === sequence) error.value = e instanceof Error ? e.message : '监听数据加载失败' }
  finally { if (request === sequence) loading.value = false }
}
function search() { if (page.value === 1) void load(); else page.value = 1 }
function changePageSize(size: number) { pageSize.value = size; page.value = 1 }
watch([page, pageSize], () => { void load() })
function safeLink(value: unknown) {
  try { const url = new URL(String(value)); return url.protocol === 'https:' && !url.username && !url.password ? url.href : '' } catch { return '' }
}
function recheckLabel(row: AnyRecord) { return row.state === 'stopped_banned' ? '恢复监听' : '重新检测' }
async function recheck(row: AnyRecord) {
  if (rechecking.value || !row.can_recheck || !row.version) return
  rechecking.value = String(row.account_id)
  try {
    const message = row.ban_source === 'system_rule'
      ? `确认恢复 ${row.username || row.account_id} 的店铺监听？将清除本系统按访问失败规则产生的判封，账号登录状态置为未知，并清零失败次数重新排队。这不代表 Shopify 官方解封，也不代表账号已登录。`
      : `确认重新检测 ${row.username || row.account_id} 的店铺？将清零失败次数、使旧检测失效并重新排队，不改变登录事实。`
    try {
      await ElMessageBox.confirm(message, recheckLabel(row), { type: 'warning', confirmButtonText: '确认排队', cancelButtonText: '取消' })
    } catch { return }
    if (disposed) return
    try {
      await http.put(`/api/accounts/shopify-monitors/${encodeURIComponent(String(row.account_id))}/recheck`, { expected_version: row.version })
      if (disposed) return
      ElMessage.success('已排队重新检测，尚未获得新的检测结果')
      await load()
    } catch (e) {
      if (disposed) return
      ElMessage.error(e instanceof Error ? e.message : '重新检测排队失败')
      await load()
    }
  } finally { rechecking.value = '' }
}
onMounted(() => { void load(); timer = setInterval(() => { if (!document.hidden && !loading.value && !rechecking.value) void load() }, 30000) })
onBeforeUnmount(() => { disposed = true; ++sequence; clearInterval(timer) })
</script>
<template>
  <section class="shopify-monitors">
    <div class="shopify-monitors__filters">
      <el-input v-model="keyword" placeholder="账号 / 店铺链接" clearable @keyup.enter="search" />
      <el-select v-model="state" placeholder="全部监听状态" clearable @change="search"><el-option v-for="(label, value) in labels" :key="value" :value="value" :label="label" /></el-select>
      <el-button type="primary" :icon="Search" @click="search">查询</el-button>
      <el-tooltip content="刷新"><el-button :icon="RefreshCw" circle :loading="loading" aria-label="刷新监听" @click="load" /></el-tooltip>
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-table v-loading="loading" :data="rows" stripe border table-layout="fixed" empty-text="暂无 Shopify 账号">
      <el-table-column label="平台账号" min-width="190" show-overflow-tooltip><template #default="{ row }">{{ row.username }}<small class="shopify-monitors__id">ID {{ row.account_id }}</small></template></el-table-column>
      <el-table-column label="店铺链接" min-width="220" show-overflow-tooltip><template #default="{ row }"><a v-if="safeLink(row.storefront_url || row.profile_url)" :href="safeLink(row.storefront_url || row.profile_url)" target="_blank" rel="noopener noreferrer">{{ row.storefront_url || row.profile_url }}</a><span v-else>未填写有效链接</span></template></el-table-column>
      <el-table-column label="监听状态" min-width="170" align="center"><template #default="{ row }"><el-tag :type="row.state === 'stopped_banned' ? 'danger' : row.state === 'retrying' ? 'warning' : row.state === 'active' ? 'success' : 'info'">{{ labels[row.state] || row.state }}</el-tag></template></el-table-column>
      <el-table-column label="判封来源" min-width="145" align="center"><template #default="{ row }"><el-tooltip v-if="row.ban_source === 'system_rule'" content="首次访问失败及 5 次重试均失败后的系统规则判定，不代表 Shopify 官方确认"><span>系统访问规则判定</span></el-tooltip><span v-else>{{ row.ban_source === 'other_or_unknown' ? '其他来源，需核实' : '-' }}</span></template></el-table-column>
      <el-table-column label="检查间隔" width="100" align="center"><template #default="{ row }">{{ row.state === 'retrying' ? '1 分钟' : ['active', 'pending'].includes(row.state) ? '6 小时' : '-' }}</template></el-table-column>
      <el-table-column label="已重试" width="95" align="center"><template #default="{ row }">{{ Math.max(0, Number(row.failures) - 1) }} / 5</template></el-table-column>
      <el-table-column label="最近检查" min-width="175" align="center"><template #default="{ row }">{{ formatDate(row.last_checked_at) }}</template></el-table-column>
      <el-table-column label="下次检查" min-width="175" align="center"><template #default="{ row }">{{ formatDate(row.next_check_at) }}</template></el-table-column>
      <el-table-column prop="last_error" label="异常原因" min-width="240" show-overflow-tooltip />
      <el-table-column label="操作" width="90" align="center" fixed="right">
        <template #default="{ row }">
          <el-tooltip :content="row.recheck_disabled_reason || recheckLabel(row)">
            <span class="shopify-monitors__action">
              <el-button link type="primary" :icon="RotateCcw" :aria-label="recheckLabel(row)" :disabled="!row.can_recheck || !!rechecking" :loading="rechecking === row.account_id" @click="recheck(row)" />
            </span>
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>
    <div class="table-pagination">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        background
        layout="total, sizes, prev, pager, next"
        :page-sizes="[10, 20, 50, 100]"
        :total="total"
        @size-change="changePageSize"
      />
    </div>
  </section>
</template>
<style scoped>
.shopify-monitors { min-width: 0; margin-top: 16px; }
.shopify-monitors__filters { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
.shopify-monitors__filters .el-input, .shopify-monitors__filters .el-select { width: 240px; max-width: 100%; }
.shopify-monitors__id { display: block; color: var(--app-text-muted, #718096); margin-top: 4px; }
.shopify-monitors__action { display: inline-flex; width: 32px; height: 32px; align-items: center; justify-content: center; }
.table-pagination { display: flex; justify-content: flex-end; padding: 14px 16px; border-top: 1px solid var(--app-border, #e6edf3); overflow-x: auto; }
@media (max-width: 640px) { .table-pagination { justify-content: flex-start; } }
a { color: var(--app-blue, #2e6990); }
</style>
