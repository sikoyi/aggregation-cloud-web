<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { http } from '@/api/http'
import ApifyMonitorConfigPanel from '@/components/ApifyMonitorConfigPanel.vue'
import CrawlerAccountPoolPanel from '@/components/CrawlerAccountPoolPanel.vue'
import { notifyError } from '@/utils/notify'

const loading = ref(true)
const provider = ref('apify')

async function loadProvider() {
  loading.value = true
  try {
    const config = await http.get<{ provider?: string }>('/api/interaction-center/content-monitor/provider-config/threads')
    provider.value = String(config.provider || 'apify')
  } catch (err) {
    notifyError(err, '加载失败', '内容监听供应方读取失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadProvider)
</script>

<template>
  <div v-loading="loading" class="content-monitor-config">
    <CrawlerAccountPoolPanel v-if="!loading && provider === 'crawler_service'" />
    <ApifyMonitorConfigPanel v-else-if="!loading" />
  </div>
</template>

<style scoped>
.content-monitor-config { min-height: 430px; }
</style>