<script setup lang="ts">
import { Cloud, RefreshCw } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'

import { http } from '@/api/http'
import { notifyError } from '@/utils/notify'

interface StorageStatus {
  provider: string
  enabled: boolean
  configured: boolean
  bucket?: string | null
  endpoint?: string | null
  region?: string | null
  sign_ttl_seconds: number
}

const loading = ref(false)
const status = ref<StorageStatus | null>(null)

async function loadStatus() {
  loading.value = true
  try {
    status.value = await http.get<StorageStatus>('/api/system-settings/cloud-phone-storage')
  } catch (error) {
    notifyError(error, '加载失败', '获取云手机存储配置失败')
  } finally {
    loading.value = false
  }
}

function ttlLabel(seconds: number) {
  if (seconds % 3600 === 0) return `${seconds / 3600} 小时`
  if (seconds % 60 === 0) return `${seconds / 60} 分钟`
  return `${seconds} 秒`
}

onMounted(loadStatus)
</script>

<template>
  <section v-loading="loading" class="storage-panel">
    <header class="storage-panel__header">
      <div class="storage-panel__heading">
        <span class="storage-panel__icon"><Cloud :size="19" /></span>
        <div>
          <h2>云手机数据存储</h2>
          <p>VMOS 账号数据包使用阿里云 OSS 保存，密钥仅由服务端环境变量管理。</p>
        </div>
      </div>
      <el-button :icon="RefreshCw" circle title="刷新配置状态" @click="loadStatus" />
    </header>

    <el-alert
      v-if="status && (!status.enabled || !status.configured)"
      :title="status.enabled ? 'OSS 配置不完整' : 'OSS 尚未启用'"
      type="warning"
      show-icon
      :closable="false"
    />

    <el-descriptions v-if="status" :column="2" border class="storage-panel__details">
      <el-descriptions-item label="服务状态">
        <el-tag :type="status.enabled && status.configured ? 'success' : 'warning'" effect="light">
          {{ status.enabled && status.configured ? '已配置' : '待配置' }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="存储供应商">阿里云 OSS</el-descriptions-item>
      <el-descriptions-item label="Bucket">{{ status.bucket || '-' }}</el-descriptions-item>
      <el-descriptions-item label="区域">{{ status.region || '-' }}</el-descriptions-item>
      <el-descriptions-item label="Endpoint">{{ status.endpoint || '-' }}</el-descriptions-item>
      <el-descriptions-item label="临时地址有效期">
        {{ ttlLabel(status.sign_ttl_seconds) }}
      </el-descriptions-item>
    </el-descriptions>
  </section>
</template>

<style scoped>
.storage-panel { min-height: 260px; }
.storage-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e6edf3;
}
.storage-panel__heading { display: flex; align-items: center; gap: 12px; }
.storage-panel__icon {
  display: inline-flex;
  width: 38px;
  height: 38px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #1f668f;
  background: #edf7fd;
}
.storage-panel h2 { color: #1f2933; font-size: 16px; font-weight: 700; }
.storage-panel p { margin-top: 4px; color: #66788a; font-size: 12px; }
.storage-panel :deep(.el-alert) { margin-top: 16px; }
.storage-panel__details { margin-top: 16px; }
.storage-panel__details :deep(.el-descriptions__label) { width: 150px; color: #52606d; }
.storage-panel__details :deep(.el-descriptions__content) { color: #243b53; }
@media (max-width: 720px) {
  .storage-panel__details :deep(.el-descriptions__label) { width: 110px; }
}
</style>