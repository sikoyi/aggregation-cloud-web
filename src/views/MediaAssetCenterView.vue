<script setup lang="ts">
import { Image, Layers3, Plus, RefreshCw } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import CrudPage from '@/components/CrudPage.vue'
import { resources } from '@/config/resources'

type MediaAssetCenterTab = 'assets' | 'groups'

const route = useRoute()
const router = useRouter()
const assetConfig = computed(() => resources.mediaAssets)
const groupConfig = computed(() => resources.mediaAssetGroups)
const activeTab = ref<MediaAssetCenterTab>(normalizeTab(route.query.tab))
const assetPageRef = ref<InstanceType<typeof CrudPage> | null>(null)
const groupPageRef = ref<InstanceType<typeof CrudPage> | null>(null)
const activeConfig = computed(() => (activeTab.value === 'groups' ? groupConfig.value : assetConfig.value))
const activePage = computed(() => (activeTab.value === 'groups' ? groupPageRef.value : assetPageRef.value))
const activeCreateLabel = computed(() => activeConfig.value.createLabel || '新增')

function normalizeTab(value: unknown): MediaAssetCenterTab {
  return value === 'groups' ? 'groups' : 'assets'
}

function handleTabChange(value: string | number) {
  const tab = normalizeTab(value)
  const query = { ...route.query }
  if (tab === 'groups') query.tab = 'groups'
  else delete query.tab
  router.replace({ path: '/media-assets', query })
}

function refreshActivePage() {
  activePage.value?.loadRows()
}

function openActiveCreate() {
  activePage.value?.openCreate()
}

watch(
  () => route.query.tab,
  (tab) => {
    activeTab.value = normalizeTab(tab)
  },
)
</script>

<template>
  <section class="media-center">
    <el-card shadow="never" class="media-center__workspace">
      <div class="media-center__header">
        <div class="media-center__title">
          <div class="media-center__icon"><Image class="h-5 w-5" /></div>
          <div class="min-w-0">
            <h1>素材资源</h1>
            <p>统一维护可供内容、头像和普通脚本任务使用的素材及素材分组。</p>
          </div>
        </div>
        <div class="media-center__actions">
          <el-tooltip content="刷新" placement="bottom">
            <el-button :icon="RefreshCw" circle @click="refreshActivePage" />
          </el-tooltip>
          <el-button type="primary" :icon="Plus" @click="openActiveCreate">
            {{ activeCreateLabel }}
          </el-button>
        </div>
      </div>

      <el-tabs v-model="activeTab" class="media-center__tabs" @tab-change="handleTabChange">
        <el-tab-pane name="assets" lazy>
          <template #label>
            <span class="media-center__tab-label"><Image class="h-4 w-4" />素材列表</span>
          </template>
          <CrudPage ref="assetPageRef" :config="assetConfig" embedded hide-header-actions />
        </el-tab-pane>
        <el-tab-pane name="groups" lazy>
          <template #label>
            <span class="media-center__tab-label"><Layers3 class="h-4 w-4" />素材分组</span>
          </template>
          <CrudPage ref="groupPageRef" :config="groupConfig" embedded hide-header-actions />
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </section>
</template>

<style scoped>
.media-center__workspace { --media-center-content-inset: 16px; border-color: #d9e2ec; border-radius: 8px; }
.media-center__workspace :deep(.el-card__body) { padding: 0; }
.media-center__header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 13px var(--media-center-content-inset); border-bottom: 1px solid #e6edf3; background: #fff; }
.media-center__title { display: flex; align-items: center; gap: 10px; min-width: 0; }
.media-center__actions { display: flex; flex: 0 0 auto; align-items: center; justify-content: flex-end; gap: 10px; }
.media-center__icon { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 8px; color: #1f668f; background: #eef8ff; }
.media-center__title h1 { color: #1f2933; font-size: 18px; font-weight: 700; line-height: 1.25; }
.media-center__title p { margin-top: 3px; color: #66788a; font-size: 12px; }
.media-center__tabs :deep(.el-tabs__header) { margin: 0; padding: 0 var(--media-center-content-inset); background: #fff; }
.media-center__tabs :deep(.el-tabs__nav-wrap::after) { height: 1px; background: #e6edf3; }
.media-center__tabs :deep(.el-tabs__item) { height: 40px; color: #52606d; font-size: 13px; font-weight: 600; }
.media-center__tabs :deep(.el-tabs__item.is-active) { color: #1f668f; }
.media-center__tabs :deep(.el-tabs__content) { padding: 14px var(--media-center-content-inset) 16px; background: #f8fafc; }
.media-center__tab-label { display: inline-flex; align-items: center; gap: 6px; }

@media (max-width: 768px) {
  .media-center__header { align-items: flex-start; flex-direction: column; }
  .media-center__actions { width: 100%; }
  .media-center__tabs :deep(.el-tabs__content) { padding: 12px; }
}
</style>
