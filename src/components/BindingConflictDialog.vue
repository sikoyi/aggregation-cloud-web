<script setup lang="ts">
import { RefreshCw } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

import type { BindingConflictTarget } from '@/api/bindingConflicts'
import BindingConflictSlot from '@/components/BindingConflictSlot.vue'
import { useBindingConflicts } from '@/composables/useBindingConflicts'
import { businessPlatformLabel } from '@/config/options'
import { useAuthStore } from '@/stores/auth'
import { formatDate } from '@/utils/format'

const props = defineProps<{ target: BindingConflictTarget | null }>()
const emit = defineEmits<{ close: [] }>()
const router = useRouter()
const auth = useAuthStore()
const { rows, loading, error, reload } = useBindingConflicts(() => props.target)

async function navigate(id: string) {
  if (!auth.can('devices.view')) return
  await router.push({ path: '/slots', query: { slot_id: id } })
  emit('close')
}
</script>

<template>
  <el-dialog :model-value="Boolean(target)" title="绑定冲突" width="min(980px, 94vw)" align-center
    append-to-body destroy-on-close @update:model-value="!$event && emit('close')">
    <section v-loading="loading" class="binding-conflicts" aria-label="绑定冲突详情" :aria-busy="loading">
      <div class="binding-conflicts__toolbar">
        <span>冲突记录 {{ rows.length }}</span>
        <el-tooltip content="刷新冲突记录" placement="top">
          <el-button :icon="RefreshCw" circle text :disabled="loading" aria-label="刷新冲突记录" @click="reload" />
        </el-tooltip>
      </div>
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
      <el-empty v-else-if="!loading && !rows.length" description="暂无绑定冲突" :image-size="64" />
      <article v-for="row in rows" :key="row.id" class="binding-conflicts__record">
        <header>
          <el-tag size="small" effect="plain">{{ businessPlatformLabel(row.business_platform) }}</el-tag>
          <strong>{{ row.username || `账号 #${row.account_id}` }}</strong>
          <small>账号 ID {{ row.account_id }}</small>
        </header>
        <div class="binding-conflicts__environments">
          <div class="binding-conflicts__environment">
            <h3>正式绑定环境</h3>
            <BindingConflictSlot :slot="row.bound_slot" :restricted="row.bound_slot_restricted"
              empty-text="暂无正式绑定" :can-navigate="auth.can('devices.view')" @navigate="navigate" />
          </div>
          <div class="binding-conflicts__environment binding-conflicts__environment--observed">
            <h3>发现冲突环境</h3>
            <BindingConflictSlot :slot="row.observed_slot" :restricted="row.observed_slot_restricted"
              :can-navigate="auth.can('devices.view')" @navigate="navigate" />
          </div>
        </div>
        <footer>
          <span>首次发现 {{ formatDate(row.first_seen_at) }}</span>
          <span>最近发现 {{ formatDate(row.last_seen_at) }}</span>
        </footer>
      </article>
    </section>
    <template #footer><el-button @click="emit('close')">关闭</el-button></template>
  </el-dialog>
</template>

<style scoped>
.binding-conflicts { min-height: 150px; max-height: 65vh; overflow-y: auto; }
.binding-conflicts__toolbar { display: flex; align-items: center; justify-content: space-between; color: #66788a; font-size: 12px; }
.binding-conflicts__record { padding: 14px 0; border-bottom: 1px solid #e6edf3; }
.binding-conflicts__record header { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 12px; }
.binding-conflicts__record header strong { overflow-wrap: anywhere; color: #334e68; font-size: 13px; }
.binding-conflicts__record header small { color: #8494a5; overflow-wrap: anywhere; }
.binding-conflicts__environments { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
.binding-conflicts__environment { min-width: 0; border-left: 3px solid #85baa0; padding-left: 10px; }
.binding-conflicts__environment--observed { border-color: #d9ac51; }
.binding-conflicts__environment h3 { margin: 0 0 6px; font-size: 12px; color: #52697e; font-weight: 600; }
.binding-conflicts__record footer { display: flex; flex-wrap: wrap; gap: 6px 18px; margin-top: 12px; color: #8494a5; font-size: 11px; }
@media (max-width: 640px) { .binding-conflicts__environments { grid-template-columns: minmax(0, 1fr); gap: 14px; } }
</style>
