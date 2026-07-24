<script setup lang="ts">
import { ContactRound, KeyRound, PhoneCall, UserRoundCog } from 'lucide-vue-next'
import { ref } from 'vue'

import RegistrationActivationsPanel from '@/components/registration/RegistrationActivationsPanel.vue'
import RegistrationCredentialsPanel from '@/components/registration/RegistrationCredentialsPanel.vue'
import RegistrationProfilesPanel from '@/components/registration/RegistrationProfilesPanel.vue'
import RegistrationScriptAccountPanel from '@/components/registration/RegistrationScriptAccountPanel.vue'

const activeTab = ref('credentials')
</script>

<template>
  <section class="registration-center">
    <el-card shadow="never" class="registration-center__workspace">
      <div class="registration-center__header">
        <div class="registration-center__title">
          <div class="registration-center__icon"><ContactRound :size="20" /></div>
          <div>
            <h1>注册资源</h1>
            <p>统一管理接码平台、注册个人资料和脚本访问权限。</p>
          </div>
        </div>
      </div>

      <el-tabs v-model="activeTab" class="registration-center__tabs">
        <el-tab-pane name="credentials" lazy>
          <template #label>
            <span class="tab-label"><KeyRound :size="16" />接码平台</span>
          </template>
          <RegistrationCredentialsPanel />
        </el-tab-pane>
        <el-tab-pane name="profiles" lazy>
          <template #label>
            <span class="tab-label"><ContactRound :size="16" />个人资料</span>
          </template>
          <RegistrationProfilesPanel />
        </el-tab-pane>
        <el-tab-pane name="activations" lazy>
          <template #label>
            <span class="tab-label"><PhoneCall :size="16" />接码订单</span>
          </template>
          <RegistrationActivationsPanel />
        </el-tab-pane>
        <el-tab-pane name="script-account" lazy>
          <template #label>
            <span class="tab-label"><UserRoundCog :size="16" />脚本账号</span>
          </template>
          <RegistrationScriptAccountPanel />
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </section>
</template>

<style scoped>
.registration-center__workspace {
  --content-inset: 16px;
  border-color: #d9e2ec;
  border-radius: 8px;
}
.registration-center__workspace :deep(.el-card__body) { padding: 0; }
.registration-center__header { padding: 13px var(--content-inset); border-bottom: 1px solid #e6edf3; background: #fff; }
.registration-center__title,
.tab-label { display: flex; align-items: center; }
.registration-center__title { gap: 10px; }
.registration-center__icon {
  display: inline-flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #1f668f;
  background: #eef8ff;
}
.registration-center__title h1 { color: #1f2933; font-size: 18px; font-weight: 700; line-height: 1.25; }
.registration-center__title p { margin-top: 3px; color: #66788a; font-size: 12px; }
.registration-center__tabs :deep(.el-tabs__header) { margin: 0; padding: 0 var(--content-inset); background: #fff; }
.registration-center__tabs :deep(.el-tabs__nav-wrap::after) { height: 1px; background: #e6edf3; }
.registration-center__tabs :deep(.el-tabs__item) { height: 40px; color: #52606d; font-size: 13px; font-weight: 600; }
.registration-center__tabs :deep(.el-tabs__item.is-active) { color: #1f668f; }
.registration-center__tabs :deep(.el-tabs__content) { min-height: 520px; padding: 16px; background: #f8fafc; }
.tab-label { gap: 6px; }
@media (max-width: 720px) {
  .registration-center__tabs :deep(.el-tabs__content) { padding: 12px; }
}
</style>
