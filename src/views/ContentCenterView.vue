<script setup lang="ts">
import { FileText, Layers3, Plus, RefreshCw } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import CrudPage from '@/components/CrudPage.vue'
import { resources } from '@/config/resources'

type ContentCenterTab = 'contents' | 'groups'

const route = useRoute()
const router = useRouter()

const contentConfig = computed(() => resources.contents)
const contentGroupConfig = computed(() => resources.contentGroups)
const activeTab = ref<ContentCenterTab>(normalizeTab(route.query.tab))
const contentPageRef = ref<InstanceType<typeof CrudPage> | null>(null)
const contentGroupPageRef = ref<InstanceType<typeof CrudPage> | null>(null)
const activeConfig = computed(() => (activeTab.value === 'groups' ? contentGroupConfig.value : contentConfig.value))
const activePage = computed(() => (activeTab.value === 'groups' ? contentGroupPageRef.value : contentPageRef.value))
const activeCreateLabel = computed(() => activeConfig.value.createLabel || '新增')

function normalizeTab(value: unknown): ContentCenterTab {
  return value === 'groups' ? 'groups' : 'contents'
}

function handleTabChange(value: string | number) {
  const tab = normalizeTab(value)
  const query = { ...route.query }
  if (tab === 'groups') query.tab = 'groups'
  else delete query.tab
  router.replace({ path: '/contents', query })
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
  <section class="content-center">
    <el-card shadow="never" class="content-center__workspace">
      <div class="content-center__header">
        <div class="content-center__title">
          <div class="content-center__icon">
            <FileText class="h-5 w-5" />
          </div>
          <div class="min-w-0">
            <h1>内容库</h1>
            <p>统一维护发布内容、内容池和池内成员。</p>
          </div>
        </div>
        <div class="content-center__actions">
          <el-tooltip content="刷新" placement="bottom">
            <el-button :icon="RefreshCw" circle @click="refreshActivePage" />
          </el-tooltip>
          <el-button type="primary" :icon="Plus" @click="openActiveCreate">
            {{ activeCreateLabel }}
          </el-button>
        </div>
      </div>

      <el-tabs v-model="activeTab" class="content-center__tabs" @tab-change="handleTabChange">
        <el-tab-pane name="contents" lazy>
          <template #label>
            <span class="content-center__tab-label">
              <FileText class="h-4 w-4" />
              内容列表
            </span>
          </template>
          <CrudPage ref="contentPageRef" :config="contentConfig" embedded hide-header-actions />
        </el-tab-pane>
        <el-tab-pane name="groups" lazy>
          <template #label>
            <span class="content-center__tab-label">
              <Layers3 class="h-4 w-4" />
              内容池
            </span>
          </template>
          <CrudPage ref="contentGroupPageRef" :config="contentGroupConfig" embedded hide-header-actions />
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </section>
</template>

<style scoped>
.content-center__workspace {
  --content-center-content-inset: 16px;
  border-radius: 8px;
  border-color: #d9e2ec;
}

.content-center__workspace :deep(.el-card__body) {
  padding: 0;
}

.content-center__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 13px var(--content-center-content-inset);
  border-bottom: 1px solid #e6edf3;
  background: #ffffff;
}

.content-center__title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.content-center__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.content-center__icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  color: #1f668f;
  background: #eef8ff;
}

.content-center__title h1 {
  color: #1f2933;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.25;
}

.content-center__title p {
  margin-top: 3px;
  color: #66788a;
  font-size: 12px;
}

.content-center__tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 var(--content-center-content-inset);
  background: #ffffff;
}

.content-center__tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background: #e6edf3;
}

.content-center__tabs :deep(.el-tabs__item) {
  height: 40px;
  color: #52606d;
  font-size: 13px;
  font-weight: 600;
}

.content-center__tabs :deep(.el-tabs__item.is-active) {
  color: #1f668f;
}

.content-center__tabs :deep(.el-tabs__content) {
  padding: 14px var(--content-center-content-inset) 16px;
  background: #f8fafc;
}

.content-center__tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

@media (max-width: 768px) {
  .content-center__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .content-center__actions {
    width: 100%;
  }

  .content-center__tabs :deep(.el-tabs__content) {
    padding: 12px;
  }
}
</style>
