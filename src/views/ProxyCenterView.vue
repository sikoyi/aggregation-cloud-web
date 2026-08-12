<script setup lang="ts">
import { Layers3, Plus, RefreshCw, ShieldCheck } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import CrudPage from '@/components/CrudPage.vue'
import { resources } from '@/config/resources'
import { useAuthStore } from '@/stores/auth'

type ProxyCenterTab = 'proxies' | 'groups'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const proxyConfig = computed(() => resources.proxies)
const proxyGroupConfig = computed(() => resources.proxyGroups)
const activeTab = ref<ProxyCenterTab>(normalizeTab(route.query.tab))
const proxyPageRef = ref<InstanceType<typeof CrudPage> | null>(null)
const proxyGroupPageRef = ref<InstanceType<typeof CrudPage> | null>(null)
const activeConfig = computed(() => (activeTab.value === 'groups' ? proxyGroupConfig.value : proxyConfig.value))
const activePage = computed(() => (activeTab.value === 'groups' ? proxyGroupPageRef.value : proxyPageRef.value))
const activeCreateLabel = computed(() => activeConfig.value.createLabel || '新增')

function normalizeTab(value: unknown): ProxyCenterTab {
  return value === 'groups' ? 'groups' : 'proxies'
}

function handleTabChange(value: string | number) {
  const tab = normalizeTab(value)
  const query = { ...route.query }
  if (tab === 'groups') query.tab = 'groups'
  else delete query.tab
  router.replace({ path: '/proxies', query })
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
  <section class="proxy-center">
    <el-card shadow="never" class="proxy-center__workspace">
      <div class="proxy-center__header">
        <div class="proxy-center__title">
          <div class="proxy-center__icon">
            <ShieldCheck class="h-5 w-5" />
          </div>
          <div class="min-w-0">
            <h1>代理资源</h1>
            <p>统一维护代理资源、代理分组和组内成员。</p>
          </div>
        </div>
        <div class="proxy-center__actions">
          <el-tooltip content="刷新" placement="bottom">
            <el-button :icon="RefreshCw" circle @click="refreshActivePage" />
          </el-tooltip>
          <el-button v-if="auth.can('proxies.create')" type="primary" :icon="Plus" @click="openActiveCreate">
            {{ activeCreateLabel }}
          </el-button>
        </div>
      </div>

      <el-tabs v-model="activeTab" class="proxy-center__tabs" @tab-change="handleTabChange">
        <el-tab-pane name="proxies" lazy>
          <template #label>
            <span class="proxy-center__tab-label">
              <ShieldCheck class="h-4 w-4" />
              代理列表
            </span>
          </template>
          <CrudPage ref="proxyPageRef" :config="proxyConfig" embedded hide-header-actions />
        </el-tab-pane>
        <el-tab-pane name="groups" lazy>
          <template #label>
            <span class="proxy-center__tab-label">
              <Layers3 class="h-4 w-4" />
              代理分组
            </span>
          </template>
          <CrudPage ref="proxyGroupPageRef" :config="proxyGroupConfig" embedded hide-header-actions />
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </section>
</template>

<style scoped>
.proxy-center__workspace {
  --proxy-center-content-inset: 16px;
  border-radius: 8px;
  border-color: #d9e2ec;
}

.proxy-center__workspace :deep(.el-card__body) {
  padding: 0;
}

.proxy-center__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 13px var(--proxy-center-content-inset);
  border-bottom: 1px solid #e6edf3;
  background: #ffffff;
}

.proxy-center__title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.proxy-center__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.proxy-center__icon {
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

.proxy-center__title h1 {
  color: #1f2933;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.25;
}

.proxy-center__title p {
  margin-top: 3px;
  color: #66788a;
  font-size: 12px;
}

.proxy-center__tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 var(--proxy-center-content-inset);
  background: #ffffff;
}

.proxy-center__tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background: #e6edf3;
}

.proxy-center__tabs :deep(.el-tabs__item) {
  height: 40px;
  color: #52606d;
  font-size: 13px;
  font-weight: 600;
}

.proxy-center__tabs :deep(.el-tabs__item.is-active) {
  color: #1f668f;
}

.proxy-center__tabs :deep(.el-tabs__content) {
  padding: 14px var(--proxy-center-content-inset) 16px;
  background: #f8fafc;
}

.proxy-center__tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

@media (max-width: 768px) {
  .proxy-center__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .proxy-center__actions {
    width: 100%;
  }

  .proxy-center__tabs :deep(.el-tabs__content) {
    padding: 12px;
  }
}
</style>
