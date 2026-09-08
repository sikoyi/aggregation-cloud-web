<script setup lang="ts">
import { Link2, Plus, RefreshCw, Tags, Users } from 'lucide-vue-next'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import AccountTagManager from '@/components/AccountTagManager.vue'

import { getMetaAccountFeatureStatus, type MetaAccountFeatureStatus } from '@/api/accountIdentities'
import AccountIdentityCandidates from '@/components/AccountIdentityCandidates.vue'
import AccountExportRecords from '@/components/AccountExportRecords.vue'
import CrudPage from '@/components/CrudPage.vue'
import { buildAccountIdentityResource } from '@/config/accountIdentityResource'
import { resources } from '@/config/resources'
import { useAuthStore } from '@/stores/auth'

type AccountCenterTab = 'accounts' | 'candidates' | 'exports'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const featureStatus = ref<MetaAccountFeatureStatus>({
  enabled: true,
  dual_write_enabled: true,
  shadow_read_enabled: false,
  runtime_capability: 'runtime.account_snapshot.v1',
})
const accountConfig = computed(() => (
  featureStatus.value?.enabled
    ? buildAccountIdentityResource(resources.accounts)
    : resources.accounts
))
const tagsVisible = ref(route.query.tab === 'tags')
const tagManagerRef = ref<InstanceType<typeof AccountTagManager> | null>(null)
const activeTab = ref<AccountCenterTab>(normalizeTab(route.query.tab))
const accountPageRef = ref<InstanceType<typeof CrudPage> | null>(null)
const accountCandidatePageRef = ref<InstanceType<typeof AccountIdentityCandidates> | null>(null)
const exportPageRef = ref<InstanceType<typeof AccountExportRecords> | null>(null)
const activeCreateLabel = computed(() => accountConfig.value.createLabel || '新增')

function normalizeTab(value: unknown): AccountCenterTab {
  if (value === 'exports') return 'exports'
  if (value === 'candidates') return 'candidates'
  return 'accounts'
}

function handleTabChange(value: string | number) {
  const tab = normalizeTab(value)
  const query = { ...route.query }
  if (tab !== 'accounts') query.tab = tab
  else delete query.tab
  router.replace({ path: '/accounts', query })
}

function refreshActivePage() {
  if (activeTab.value === 'exports') exportPageRef.value?.loadRows()
  else if (activeTab.value === 'candidates') accountCandidatePageRef.value?.loadRows()
  else accountPageRef.value?.loadRows()
}

function openActiveCreate() {
  accountPageRef.value?.openCreate()
}

async function closeTags(done: () => void) {
  if (tagManagerRef.value?.isBusy()) return
  if (tagManagerRef.value?.hasUnsavedChanges()) {
    try { await ElMessageBox.confirm('未保存的标签修改将丢失，确认关闭？', '关闭标签管理', { confirmButtonText: '关闭', cancelButtonText: '继续编辑' }) }
    catch { return }
  }
  done()
}
async function viewTagMembers(tag: { id: string }) {
  tagsVisible.value = false
  activeTab.value = 'accounts'
  handleTabChange('accounts')
  await nextTick()
  accountPageRef.value?.filterByAccountTag(tag.id)
}
function tagsChanged() { accountPageRef.value?.refreshAccountTags() }

async function loadFeatureStatus() {
  try {
    featureStatus.value = await getMetaAccountFeatureStatus()
    if (!featureStatus.value.enabled && activeTab.value === 'candidates') {
      activeTab.value = 'accounts'
      const query = { ...route.query }
      delete query.tab
      await router.replace({ path: route.path, query })
    }
  } catch {
    // 正式版默认使用聚合账号；状态探测失败不能让页面退回旧列表。
  }
}

watch(
  () => route.query.tab,
  (tab) => {
    activeTab.value = normalizeTab(tab)
    if (tab === 'tags') tagsVisible.value = true
  },
)

// 工作台快捷入口进入账号中心后直接打开账号导入表单。
watch(
  () => route.query.action,
  async (action) => {
    if (action !== 'create') return
    activeTab.value = 'accounts'
    await nextTick()
    await accountPageRef.value?.openCreate()
    const query = { ...route.query }
    delete query.action
    await router.replace({ path: route.path, query })
  },
  { immediate: true, flush: 'post' },
)

onMounted(loadFeatureStatus)
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
            <p>统一维护账号、账号标签及其关联关系。</p>
          </div>
        </div>
        <div class="account-center__actions">
          <el-button v-if="auth.can('accounts.view')" :icon="Tags" @click="tagsVisible = true">管理标签</el-button>
          <el-tooltip content="刷新" placement="bottom">
            <el-button :icon="RefreshCw" circle @click="refreshActivePage" />
          </el-tooltip>
          <el-button v-if="activeTab !== 'candidates' && activeTab !== 'exports' && auth.can('accounts.create')" type="primary" :icon="Plus" @click="openActiveCreate">
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
          <el-alert
            v-if="featureStatus?.enabled && !featureStatus.dual_write_enabled"
            class="account-center__feature-warning"
            type="warning"
            :closable="false"
            title="当前租户已开启多平台聚合读取，但新账号双写尚未开启"
          />
          <CrudPage ref="accountPageRef" :config="accountConfig" embedded hide-header-actions @export-records="handleTabChange('exports')" />
        </el-tab-pane>
        <el-tab-pane v-if="featureStatus?.enabled" name="candidates" lazy>
          <template #label>
            <span class="account-center__tab-label">
              <Link2 class="h-4 w-4" />
              关联候选
            </span>
          </template>
          <AccountIdentityCandidates ref="accountCandidatePageRef" />
        </el-tab-pane>
        <el-tab-pane v-if="auth.can('accounts.export')" name="exports" label="导出记录" lazy>
          <AccountExportRecords ref="exportPageRef" />
        </el-tab-pane>
      </el-tabs>
    </el-card>
    <el-dialog v-model="tagsVisible" title="管理账号标签" width="min(1000px, 94vw)" align-center class="account-tag-dialog" destroy-on-close :before-close="closeTags" :close-on-click-modal="false">
      <AccountTagManager v-if="tagsVisible && auth.can('accounts.view')" ref="tagManagerRef" @changed="tagsChanged" @members="viewTagMembers" />
    </el-dialog>
  </section>
</template>

<style scoped>
:deep(.account-tag-dialog .el-dialog__body) {
  max-height: 75vh;
  overflow-y: auto;
}
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

.account-center__feature-warning {
  margin-bottom: 12px;
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
