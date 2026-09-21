<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import { http } from '@/api/http'
import { formatDate } from '@/utils/format'

interface Service {
  id: string
  name: string
  configured: boolean
  enabled: boolean
  telemetry_available?: boolean
  network?: { status: string; at: string | null } | null
  last_result?: { success: boolean; status: string | number | null; at: string } | null
  today_requests?: number | null
  today_failed?: number | null
  counting_since?: string | null
}
const services = ref<Service[]>([])
const loading = ref(false)
const error = ref('')
const day = ref('')
const networkLabels: Record<string, string> = {
  reachable: '网络可达', unreachable: 'Ping 未响应', unavailable: '检测不可用',
  invalid_address: '地址无效', checking: '检测中',
}
async function load() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    const data = await http.get<{ services: Service[]; date: string }>('/api/dashboard/services')
    services.value = data.services
    day.value = data.date
  } catch {
    error.value = '服务状态加载失败，请重试'
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>

<template>
  <section class="service-status">
    <header>
      <h2>服务状态</h2>
      <span>{{ day }} · 北京时间</span>
      <el-button :icon="RefreshCw" :loading="loading" circle aria-label="刷新服务状态" title="刷新服务状态" @click="load" />
    </header>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-table v-loading="loading" :data="services" row-key="id">
      <el-table-column prop="name" label="服务" min-width="220" />
      <el-table-column label="配置" width="150">
        <template #default="{ row }">
          <el-tag :type="row.configured ? (row.enabled ? 'success' : 'info') : 'warning'">
            {{ !row.configured ? '未配置' : row.enabled ? '已启用' : '已配置 / 停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="网络检测" min-width="165">
        <template #default="{ row }">
          <el-tooltip v-if="row.network" content="Ping 仅验证主机可达，不代表接口业务正常；未响应也可能是主机禁用 ICMP。">
            <span>{{ networkLabels[row.network.status] }}</span>
          </el-tooltip>
          <span v-else>—</span>
          <small v-if="row.network?.at">{{ formatDate(row.network.at) }}</small>
        </template>
      </el-table-column>
      <el-table-column label="最近调用" min-width="195">
        <template #default="{ row }">
          <span v-if="row.telemetry_available === false">状态暂不可用</span>
          <template v-else-if="row.last_result">
            <el-tag :type="row.last_result.success ? 'success' : 'danger'">
              {{ row.last_result.success ? '最近调用成功' : '最近调用失败' }}
            </el-tag>
            <span v-if="row.last_result.status"> {{ row.last_result.status }}</span>
            <small>{{ formatDate(row.last_result.at) }}</small>
          </template>
          <span v-else>{{ row.configured ? '未验证' : '—' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="今日内部请求" min-width="145" align="right">
        <template #default="{ row }">
          <el-tooltip :disabled="!row.counting_since" :content="`统计始于 ${formatDate(row.counting_since)}，包含重试，不含健康检测；首次启用当天为部分数据。`">
            <strong>{{ row.today_requests == null ? '—' : row.today_requests.toLocaleString() }}</strong>
          </el-tooltip>
          <small v-if="row.today_failed != null">失败 {{ row.today_failed.toLocaleString() }}</small>
        </template>
      </el-table-column>
    </el-table>
  </section>
</template>

<style scoped>
.service-status { min-width: 0; border-top: 1px solid var(--el-border-color-light); padding-top: 16px; }
header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
h2 { margin: 0; font-size: 16px; }
header > span { margin-left: auto; color: var(--el-text-color-secondary); font-size: 12px; }
small { display: block; color: var(--el-text-color-secondary); margin-top: 4px; font-size: 12px; }
</style>
