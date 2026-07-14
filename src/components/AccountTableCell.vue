<script setup lang="ts">
import { KeyRound, MapPin, MonitorSmartphone, ShieldCheck, Users } from 'lucide-vue-next'
import { computed } from 'vue'

import RelationCell from '@/components/RelationCell.vue'
import { businessPlatformOptions, providerOptions, runtimePlatformOptions } from '@/config/options'
import type { AnyRecord } from '@/types/api'
import type { ColumnConfig } from '@/types/crud'

type AccountCellKind =
  | 'accountIdentity'
  | 'accountGroup'
  | 'accountCredentials'
  | 'accountPlatform'
  | 'accountEnvironment'

const props = defineProps<{
  kind: AccountCellKind
  row: AnyRecord
  column: ColumnConfig
}>()

function text(value: unknown) {
  return value === undefined || value === null || value === '' ? '-' : String(value)
}

function optionLabel(options: typeof businessPlatformOptions, value: unknown) {
  return options.find((item) => String(item.value) === String(value))?.label || text(value)
}

const loginName = computed(() => text(props.row.login_username))
const publicName = computed(() => {
  const value = String(props.row.username || '').trim()
  return value && value !== loginName.value ? `@${value}` : `账号 #${text(props.row.id)}`
})
const identityInitial = computed(() => loginName.value.slice(0, 1).toUpperCase())
const groupName = computed(() => String(props.row.group_name || '').trim())
const businessPlatform = computed(() => optionLabel(businessPlatformOptions, props.row.business_platform))
const runtimePlatform = computed(() => optionLabel(runtimePlatformOptions, props.row.bound_slot_runtime_platform))
const provider = computed(() => optionLabel(providerOptions, props.row.bound_slot_provider))
</script>

<template>
  <div v-if="kind === 'accountIdentity'" class="account-cell account-identity">
    <span class="account-identity__avatar">{{ identityInitial }}</span>
    <span class="account-identity__content">
      <el-tooltip :content="loginName" placement="top" :show-after="500">
        <strong class="account-identity__name">{{ loginName }}</strong>
      </el-tooltip>
      <span class="account-identity__secondary">{{ publicName }}</span>
    </span>
  </div>

  <div v-else-if="kind === 'accountGroup'" class="account-cell">
    <el-tag v-if="groupName" type="primary" effect="plain" round class="account-group-tag">
      <Users class="account-group-tag__icon" />
      <span>{{ groupName }}</span>
    </el-tag>
    <el-tag v-else type="info" effect="plain" round>未分组</el-tag>
  </div>

  <div v-else-if="kind === 'accountCredentials'" class="account-cell account-credentials">
    <el-tooltip :content="text(row.password_secret_ref)" placement="top" :show-after="500">
      <div class="account-credential-row">
        <span class="account-credential-row__label account-credential-row__label--password">
          <KeyRound />
          密码
        </span>
        <code>{{ text(row.password_secret_ref) }}</code>
      </div>
    </el-tooltip>
    <el-tooltip :content="text(row.totp_secret_ref)" placement="top" :show-after="500">
      <div class="account-credential-row">
        <span class="account-credential-row__label account-credential-row__label--twofa">
          <ShieldCheck />
          2FA
        </span>
        <code>{{ text(row.totp_secret_ref) }}</code>
      </div>
    </el-tooltip>
  </div>

  <div v-else-if="kind === 'accountPlatform'" class="account-cell account-platform">
    <el-tag type="primary" effect="light" round>{{ businessPlatform }}</el-tag>
    <span class="account-platform__country">
      <MapPin />
      {{ text(row.country) }}
    </span>
  </div>

  <div v-else-if="kind === 'accountEnvironment'" class="account-cell account-environment">
    <div v-if="row.bound_slot_id && column.relation" class="account-environment__device">
      <MonitorSmartphone />
      <RelationCell :value="row.bound_slot_id" :config="column.relation" :row="row" />
    </div>
    <span v-else class="account-environment__empty">未绑定设备</span>
    <div v-if="row.bound_slot_id" class="account-environment__tags">
      <el-tag size="small" effect="plain" type="info">{{ runtimePlatform }}</el-tag>
      <el-tag size="small" effect="plain">{{ provider }}</el-tag>
    </div>
  </div>
</template>

<style scoped>
.account-cell {
  min-width: 0;
}

.account-identity {
  display: flex;
  align-items: center;
  gap: 10px;
}

.account-identity__avatar {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid #cfe1f2;
  border-radius: 50%;
  color: #245f87;
  background: #edf6fc;
  font-size: 13px;
  font-weight: 700;
}

.account-identity__content {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.account-identity__name,
.account-identity__secondary {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-identity__name {
  color: #243b53;
  font-size: 13px;
  font-weight: 700;
}

.account-identity__secondary {
  color: #8293a5;
  font-size: 11px;
}

.account-group-tag {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 4px;
}

.account-group-tag__icon {
  width: 12px;
  height: 12px;
}

.account-group-tag span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.account-credentials {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.account-credential-row {
  display: grid;
  min-width: 0;
  grid-template-columns: 48px minmax(0, 1fr);
  align-items: center;
  gap: 7px;
}

.account-credential-row__label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  height: 20px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
}

.account-credential-row__label svg {
  width: 11px;
  height: 11px;
}

.account-credential-row__label--password {
  color: #52606d;
  background: #edf1f5;
}

.account-credential-row__label--twofa {
  color: #27704b;
  background: #eaf7ef;
}

.account-credential-row code {
  min-width: 0;
  overflow: hidden;
  color: #52606d;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-platform {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 7px;
}

.account-platform__country {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #62758a;
  font-size: 12px;
}

.account-platform__country svg {
  width: 12px;
  height: 12px;
  color: #8aa0b5;
}

.account-environment {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.account-environment__device {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
}

.account-environment__device > svg {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
  color: #527a98;
}

.account-environment__tags {
  display: flex;
  min-width: 0;
  gap: 5px;
}

.account-environment__tags :deep(.el-tag) {
  max-width: 96px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.account-environment__empty {
  color: #9aa9b8;
  font-size: 12px;
}
</style>
