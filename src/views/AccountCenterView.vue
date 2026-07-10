<script setup lang="ts">
import { Layers3, Users } from 'lucide-vue-next'
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

watch(
  () => route.query.tab,
  (tab) => {
    activeTab.value = normalizeTab(tab)
  },
)
</script>

<template>
  <section class="account-center">
    <div class="account-center__hero">
      <div class="account-center__title">
        <div class="account-center__icon">
          <Users class="h-5 w-5" />
        </div>
        <div>
          <h1>账号管理</h1>
          <p>统一维护账号、分组和组内成员，减少运营在多个页面之间来回切换。</p>
        </div>
      </div>
    </div>

    <el-card shadow="never" class="account-center__tabs-card">
      <el-tabs v-model="activeTab" class="account-center__tabs" @tab-change="handleTabChange">
        <el-tab-pane name="accounts" lazy>
          <template #label>
            <span class="account-center__tab-label">
              <Users class="h-4 w-4" />
              账号列表
            </span>
          </template>
          <CrudPage :config="accountConfig" embedded />
        </el-tab-pane>
        <el-tab-pane name="groups" lazy>
          <template #label>
            <span class="account-center__tab-label">
              <Layers3 class="h-4 w-4" />
              账号分组
            </span>
          </template>
          <CrudPage :config="accountGroupConfig" embedded />
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </section>
</template>

<style scoped>
.account-center {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.account-center__hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border: 1px solid #d9e2ec;
  border-radius: 8px;
  background: #ffffff;
  padding: 16px 18px;
}

.account-center__title {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.account-center__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 8px;
  color: #1f668f;
  background: #eef8ff;
}

.account-center__title h1 {
  color: #1f2933;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.25;
}

.account-center__title p {
  margin-top: 5px;
  color: #66788a;
  font-size: 13px;
}

.account-center__tabs-card {
  border-radius: 8px;
  border-color: #d9e2ec;
}

.account-center__tabs-card :deep(.el-card__body) {
  padding: 0;
}

.account-center__tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 16px;
  background: #ffffff;
}

.account-center__tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background: #e6edf3;
}

.account-center__tabs :deep(.el-tabs__content) {
  padding: 16px;
  background: #f8fafc;
}

.account-center__tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

@media (max-width: 768px) {
  .account-center__hero {
    align-items: flex-start;
    flex-direction: column;
  }

  .account-center__tabs :deep(.el-tabs__content) {
    padding: 12px;
  }
}
</style>
