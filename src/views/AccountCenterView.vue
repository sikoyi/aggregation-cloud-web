<script setup lang="ts">
import { Layers3, Plus, RefreshCw, Users } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import CrudPage from '@/components/CrudPage.vue'
import { resources } from '@/config/resources'

type AccountCenterTab = 'accounts' | 'groups'

const route = useRoute()
const router = useRouter()

const accountConfig = computed(() => resources.accounts)
const accountGroupConfig = computed(() => resources.accountGroups)
const activeTab = ref<AccountCenterTab>(normalizeTab(route.query.tab))
const accountPageRef = ref<InstanceType<typeof CrudPage> | null>(null)
const accountGroupPageRef = ref<InstanceType<typeof CrudPage> | null>(null)
const activeConfig = computed(() => (activeTab.value === 'groups' ? accountGroupConfig.value : accountConfig.value))
const activePage = computed(() => (activeTab.value === 'groups' ? accountGroupPageRef.value : accountPageRef.value))
const activeCreateLabel = computed(() => activeConfig.value.createLabel || '新增')

function normalizeTab(value: unknown): AccountCenterTab {
  return value === 'groups' ? 'groups' : 'accounts'
}

function handleTabChange(value: string | number) {
  const tab = normalizeTab(value)
  const query = { ...route.query }
  if (tab === 'groups') query.tab = 'groups'
  else delete query.tab
  router.replace({ path: '/accounts', query })
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
  <section class="account-center">
    <el-card shadow="never" class="account-center__workspace">
      <div class="account-center__header">
        <div class="account-center__title">
          <div class="account-center__icon">
            <Users class="h-5 w-5" />
          </div>
          <div class="min-w-0">
            <h1>账号管理</h1>
            <p>统一维护账号、分组和组内成员。</p>
          </div>
        </div>
        <div class="account-center__actions">
          <el-tooltip content="刷新" placement="bottom">
            <el-button :icon="RefreshCw" circle @click="refreshActivePage" />
          </el-tooltip>
          <el-button type="primary" :icon="Plus" @click="openActiveCreate">
            {{ activeCreateLabel }}
          </el-button>
        </div>
      </div>

      <el-tabs v-model="activeTab" class="account-center__tabs" @tab-change="handleTabChange">
        <el-tab-pane name="accounts" lazy>
          <template #label>
            <span class="account-center__tab-label">
              <Users class="h-4 w-4" />
              账号列表
            </span>
          </template>
          <CrudPage ref="accountPageRef" :config="accountConfig" embedded hide-header-actions />
        </el-tab-pane>
        <el-tab-pane name="groups" lazy>
          <template #label>
            <span class="account-center__tab-label">
              <Layers3 class="h-4 w-4" />
              账号分组
            </span>
          </template>
          <CrudPage ref="accountGroupPageRef" :config="accountGroupConfig" embedded hide-header-actions />
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </section>
</template>

<style scoped>
.account-center__workspace {
  --account-center-content-inset: 16px;
  border-radius: 8px;
  border-color: #d9e2ec;
}

.account-center__workspace :deep(.el-card__body) {
  padding: 0;
}

.account-center__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 13px var(--account-center-content-inset);
  border-bottom: 1px solid #e6edf3;
  background: #ffffff;
}

.account-center__title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.account-center__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.account-center__icon {
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

.account-center__title h1 {
  color: #1f2933;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.25;
}

.account-center__title p {
  margin-top: 3px;
  color: #66788a;
  font-size: 12px;
}

.account-center__tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 var(--account-center-content-inset);
  background: #ffffff;
}

.account-center__tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background: #e6edf3;
}

.account-center__tabs :deep(.el-tabs__item) {
  height: 40px;
  color: #52606d;
  font-size: 13px;
  font-weight: 600;
}

.account-center__tabs :deep(.el-tabs__item.is-active) {
  color: #1f668f;
}

.account-center__tabs :deep(.el-tabs__content) {
  padding: 14px var(--account-center-content-inset) 16px;
  background: #f8fafc;
}

.account-center__tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

@media (max-width: 768px) {
  .account-center__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .account-center__actions {
    width: 100%;
  }

  .account-center__tabs :deep(.el-tabs__content) {
    padding: 12px;
  }
}
</style>
