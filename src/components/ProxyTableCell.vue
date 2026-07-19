<script setup lang="ts">
import { Layers3, Network, ShieldCheck } from 'lucide-vue-next'
import { computed } from 'vue'

import { proxyModeOptions, proxyProtocolOptions } from '@/config/options'
import type { AnyRecord } from '@/types/api'
import type { ColumnConfig } from '@/types/crud'

type ProxyCellKind = 'proxyIdentity' | 'proxyGroup' | 'proxyEndpoint' | 'proxyProfile'

const props = defineProps<{
  kind: ProxyCellKind
  row: AnyRecord
  column: ColumnConfig
}>()

function text(value: unknown) {
  return value === undefined || value === null || value === '' ? '-' : String(value)
}

function optionLabel(options: Array<{ label: string; value: unknown }>, value: unknown) {
  return options.find((item) => String(item.value) === String(value))?.label || text(value)
}

function compactDate(value: unknown) {
  if (!value) return '-'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  const part = (number: number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())} ${part(date.getHours())}:${part(date.getMinutes())}`
}

const proxyName = computed(() => text(props.row.name))
const proxyId = computed(() => text(props.row.id))
const proxyUrl = computed(() => text(props.row.source_proxy_url))
const groupNames = computed(() => {
  if (Array.isArray(props.row.group_names)) {
    return props.row.group_names.map((item) => String(item).trim()).filter(Boolean)
  }
  return String(props.row.group_names || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
})
const protocol = computed(() => optionLabel(proxyProtocolOptions, props.row.proxy_type))
const mode = computed(() => optionLabel(proxyModeOptions, props.row.proxy_mode))
</script>

<template>
  <div v-if="kind === 'proxyIdentity'" class="proxy-cell proxy-identity">
    <span class="proxy-identity__icon"><ShieldCheck /></span>
    <span class="proxy-identity__content">
      <el-tooltip :content="proxyName" placement="top" :show-after="500">
        <strong>{{ proxyName }}</strong>
      </el-tooltip>
      <span class="proxy-identity__meta">
        <code>#{{ proxyId }}</code>
        <small>{{ compactDate(row.created_at) }}</small>
      </span>
    </span>
  </div>

  <div v-else-if="kind === 'proxyGroup'" class="proxy-cell proxy-groups">
    <template v-if="groupNames.length">
      <el-tag
        v-for="group in groupNames"
        :key="group"
        type="primary"
        effect="plain"
        round
        class="proxy-group-tag"
      >
        <Layers3 />
        <span>{{ group }}</span>
      </el-tag>
    </template>
    <el-tag v-else type="info" effect="plain" round>未分组</el-tag>
  </div>

  <div v-else-if="kind === 'proxyEndpoint'" class="proxy-cell proxy-endpoint">
    <el-tooltip :content="proxyUrl" placement="top" :show-after="400">
      <div class="proxy-endpoint__url">
        <Network />
        <code>{{ proxyUrl }}</code>
      </div>
    </el-tooltip>
  </div>

  <div v-else class="proxy-cell proxy-profile">
    <el-tag size="small" type="primary" effect="light" round>{{ protocol }}</el-tag>
    <el-tag size="small" type="info" effect="plain" round>{{ mode }}</el-tag>
  </div>
</template>

<style scoped>
.proxy-cell { min-width: 0; }
.proxy-identity { display: flex; align-items: center; gap: 10px; }
.proxy-identity__icon { display: inline-flex; width: 36px; height: 36px; flex: 0 0 36px; align-items: center; justify-content: center; border: 1px solid #cfe1f2; border-radius: 8px; color: #245f87; background: #edf6fc; }
.proxy-identity__icon svg { width: 18px; height: 18px; }
.proxy-identity__content { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
.proxy-identity__content strong,
.proxy-identity__content span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.proxy-identity__content strong { color: #243b53; font-size: 13px; }
.proxy-identity__meta { display: flex; min-width: 0; align-items: center; gap: 6px; }
.proxy-identity__meta code { color: #28719f; font-size: 11px; }
.proxy-identity__meta small { overflow: hidden; color: #8293a5; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.proxy-groups { display: flex; flex-wrap: wrap; gap: 5px; }
.proxy-group-tag { display: inline-flex; max-width: 100%; align-items: center; }
.proxy-group-tag :deep(.el-tag__content) { display: inline-flex; min-width: 0; align-items: center; gap: 4px; }
.proxy-group-tag svg { width: 12px; height: 12px; flex: 0 0 12px; }
.proxy-group-tag span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.proxy-endpoint { min-width: 0; }
.proxy-endpoint__url { display: flex; min-width: 0; align-items: center; gap: 7px; }
.proxy-endpoint__url svg { width: 15px; height: 15px; flex: 0 0 15px; color: #39759b; }
.proxy-endpoint__url code { min-width: 0; overflow: hidden; color: #243b53; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.proxy-profile { display: flex; flex-wrap: nowrap; align-items: center; justify-content: center; gap: 8px; padding: 0 4px; white-space: nowrap; }
</style>
