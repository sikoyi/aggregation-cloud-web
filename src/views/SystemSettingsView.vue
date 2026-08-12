<script setup lang="ts">
import { Bot, Cloud, Radar, Settings, SlidersHorizontal } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import ApifyMonitorConfigPanel from '@/components/ApifyMonitorConfigPanel.vue'
import CloudPhoneStorageConfigPanel from '@/components/CloudPhoneStorageConfigPanel.vue'
import InteractionAiConfigPanel from '@/components/InteractionAiConfigPanel.vue'
import SystemDefaultsConfigPanel from '@/components/SystemDefaultsConfigPanel.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const canEdit = computed(() => auth.can('system_settings.edit'))

const activeTab = ref('defaults')
const defaultsPanel = ref<{ loadConfig: () => Promise<void> } | null>(null)

function refreshDefaults() {
  void defaultsPanel.value?.loadConfig()
}
</script>

<template>
  <section class="system-settings">
    <el-card shadow="never" class="system-settings__workspace">
      <div class="system-settings__header">
        <div class="system-settings__title">
          <div class="system-settings__icon"><Settings :size="20" /></div>
          <div>
            <h1>系统配置</h1>
            <p>集中维护业务默认选项、服务端采集能力和 AI 模型供应商。</p>
          </div>
        </div>
      </div>

      <el-alert
        v-if="!canEdit"
        title="当前角色仅可查看系统配置"
        type="info"
        :closable="false"
      />
      <el-tabs v-model="activeTab" class="system-settings__tabs" :class="{ 'system-settings__tabs--readonly': !canEdit }">
        <el-tab-pane name="defaults" lazy>
          <template #label><span class="tab-label"><SlidersHorizontal :size="16" />默认选项</span></template>
          <div :inert="!canEdit">
            <SystemDefaultsConfigPanel ref="defaultsPanel" />
          </div>
        </el-tab-pane>
        <el-tab-pane name="monitor" lazy>
          <template #label><span class="tab-label"><Radar :size="16" />内容监听</span></template>
          <div :inert="!canEdit">
            <ApifyMonitorConfigPanel />
          </div>
        </el-tab-pane>
        <el-tab-pane name="cloud-phone-storage" lazy>
          <template #label><span class="tab-label"><Cloud :size="16" />云手机存储</span></template>
          <div :inert="!canEdit">
            <CloudPhoneStorageConfigPanel />
          </div>
        </el-tab-pane>
        <el-tab-pane name="ai" lazy>
          <template #label><span class="tab-label"><Bot :size="16" />互动 AI</span></template>
          <div :inert="!canEdit">
            <InteractionAiConfigPanel @config-saved="refreshDefaults" />
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </section>
</template>

<style scoped>
.system-settings__workspace {
  --content-inset: 16px;
  border-color: #d9e2ec;
  border-radius: 8px;
}
.system-settings__workspace :deep(.el-card__body) { padding: 0; }
.system-settings__header { padding: 13px var(--content-inset); border-bottom: 1px solid #e6edf3; background: #fff; }
.system-settings__title,
.tab-label { display: flex; align-items: center; }
.system-settings__title { gap: 10px; }
.system-settings__icon {
  display: inline-flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #1f668f;
  background: #eef8ff;
}
.system-settings__title h1 { color: #1f2933; font-size: 18px; font-weight: 700; line-height: 1.25; }
.system-settings__title p { margin-top: 3px; color: #66788a; font-size: 12px; }
.system-settings__tabs :deep(.el-tabs__header) { margin: 0; padding: 0 var(--content-inset); background: #fff; }
.system-settings__tabs :deep(.el-tabs__nav-wrap::after) { height: 1px; background: #e6edf3; }
.system-settings__tabs :deep(.el-tabs__item) { height: 40px; color: #52606d; font-size: 13px; font-weight: 600; }
.system-settings__tabs :deep(.el-tabs__item.is-active) { color: #1f668f; }
.system-settings__tabs :deep(.el-tabs__content) { min-height: 500px; padding: 18px var(--content-inset) 22px; background: #f8fafc; }
.system-settings__tabs--readonly :deep(.el-button),
.system-settings__tabs--readonly :deep(.el-switch) { display: none; }
.system-settings__tabs :deep(.el-tab-pane) { padding: 16px; border: 1px solid #dbe4ed; border-radius: 6px; background: #fff; }
.tab-label { gap: 6px; }
@media (max-width: 720px) {
  .system-settings__tabs :deep(.el-tabs__content) { padding: 12px; }
  .system-settings__tabs :deep(.el-tab-pane) { padding: 12px; }
}
</style>
