<script setup lang="ts">
import { Boxes, Layers3, Plus, RefreshCw, RotateCcw } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import CrudPage from '@/components/CrudPage.vue'
import { resources } from '@/config/resources'
import { useAuthStore } from '@/stores/auth'

type DeviceCenterTab = 'slots' | 'groups'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const slotConfig = computed(() => resources.slots)
const slotGroupConfig = computed(() => resources.slotGroups)
const activeTab = ref<DeviceCenterTab>(normalizeTab(route.query.tab))
const slotPageRef = ref<InstanceType<typeof CrudPage> | null>(null)
const slotGroupPageRef = ref<InstanceType<typeof CrudPage> | null>(null)
const activeConfig = computed(() => (activeTab.value === 'groups' ? slotGroupConfig.value : slotConfig.value))
const activePage = computed(() => (activeTab.value === 'groups' ? slotGroupPageRef.value : slotPageRef.value))
const activeCreateLabel = computed(() => activeConfig.value.createLabel || '新增')

function normalizeTab(value: unknown): DeviceCenterTab {
  return value === 'groups' ? 'groups' : 'slots'
}

function handleTabChange(value: string | number) {
  const tab = normalizeTab(value)
  const query = { ...route.query }
  if (tab === 'groups') query.tab = 'groups'
  else delete query.tab
  router.replace({ path: '/slots', query })
}

function refreshActivePage() {
  activePage.value?.loadRows()
}

function openActiveCreate() {
  activePage.value?.openCreate()
}

function openSlotSync() {
  const action = slotConfig.value.headerActions?.find((item) => item.key === 'request-runtime-slot-sync')
  if (action) slotPageRef.value?.runHeaderAction(action)
}

watch(
  () => route.query.tab,
  (tab) => {
    activeTab.value = normalizeTab(tab)
  },
)
</script>

<template>
  <section class="device-center">
    <el-card shadow="never" class="device-center__workspace">
      <div class="device-center__header">
        <div class="device-center__title">
          <div class="device-center__icon">
            <Boxes class="h-5 w-5" />
          </div>
          <div class="min-w-0">
            <h1>设备管理</h1>
            <p>统一维护设备、设备分组和组内成员。</p>
          </div>
        </div>
        <div class="device-center__actions">
          <el-tooltip content="刷新" placement="bottom">
            <el-button :icon="RefreshCw" circle @click="refreshActivePage" />
          </el-tooltip>
          <el-button
            v-if="activeTab === 'slots' && auth.can('devices.sync')"
            :icon="RotateCcw"
            @click="openSlotSync"
          >
            主动同步
          </el-button>
          <el-button v-if="auth.can('devices.create')" type="primary" :icon="Plus" @click="openActiveCreate">
            {{ activeCreateLabel }}
          </el-button>
        </div>
      </div>

      <el-tabs v-model="activeTab" class="device-center__tabs" @tab-change="handleTabChange">
        <el-tab-pane name="slots" lazy>
          <template #label>
            <span class="device-center__tab-label">
              <Boxes class="h-4 w-4" />
              设备列表
            </span>
          </template>
          <CrudPage ref="slotPageRef" :config="slotConfig" embedded hide-header-actions />
        </el-tab-pane>
        <el-tab-pane name="groups" lazy>
          <template #label>
            <span class="device-center__tab-label">
              <Layers3 class="h-4 w-4" />
              设备分组
            </span>
          </template>
          <CrudPage ref="slotGroupPageRef" :config="slotGroupConfig" embedded hide-header-actions />
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </section>
</template>

<style scoped>
.device-center__workspace {
  --device-center-content-inset: 16px;
  border-radius: 8px;
  border-color: #d9e2ec;
}

.device-center__workspace :deep(.el-card__body) {
  padding: 0;
}

.device-center__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 13px var(--device-center-content-inset);
  border-bottom: 1px solid #e6edf3;
  background: #ffffff;
}

.device-center__title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.device-center__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.device-center__icon {
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

.device-center__title h1 {
  color: #1f2933;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.25;
}

.device-center__title p {
  margin-top: 3px;
  color: #66788a;
  font-size: 12px;
}

.device-center__tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 var(--device-center-content-inset);
  background: #ffffff;
}

.device-center__tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background: #e6edf3;
}

.device-center__tabs :deep(.el-tabs__item) {
  height: 40px;
  color: #52606d;
  font-size: 13px;
  font-weight: 600;
}

.device-center__tabs :deep(.el-tabs__item.is-active) {
  color: #1f668f;
}

.device-center__tabs :deep(.el-tabs__content) {
  padding: 14px var(--device-center-content-inset) 16px;
  background: #f8fafc;
}

.device-center__tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

@media (max-width: 768px) {
  .device-center__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .device-center__actions {
    width: 100%;
  }

  .device-center__tabs :deep(.el-tabs__content) {
    padding: 12px;
  }
}
</style>
