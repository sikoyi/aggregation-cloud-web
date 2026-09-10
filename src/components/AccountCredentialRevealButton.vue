<script setup lang="ts">
import { Eye } from 'lucide-vue-next'
import type { TotpSource } from '@/api/accountTotp'
import { useAccountCredentialReveal } from '@/composables/useAccountCredentialReveal'
import { useAuthStore } from '@/stores/auth'
import { canRequestAccountCredentials } from '@/utils/permissions'

const props = defineProps<{ source: TotpSource; accountId: string; accountName?: string; revision?: unknown }>()
const auth = useAuthStore()
const { visible, adminPassword, loading, error, credentials, allowed, open, close, reveal } = useAccountCredentialReveal(() => ({
  source: props.source, id: props.accountId, revision: props.revision,
  actorId: auth.user?.id || '', allowed: canRequestAccountCredentials(auth.user),
}))
</script>

<template>
  <el-tooltip v-if="allowed" content="验证密码查看当前账号凭据" placement="top">
    <el-button class="credential-reveal-button" text circle :icon="Eye" aria-label="验证密码查看当前账号凭据" @click.stop="open" />
  </el-tooltip>
  <el-dialog :model-value="visible" title="查看账号凭据" width="min(440px, calc(100vw - 32px))" append-to-body destroy-on-close
    :close-on-click-modal="false" @update:model-value="value => { if (!value) close() }">
    <div class="credential-reveal-account">{{ accountName || accountId }}</div>
    <el-form v-if="!credentials" label-position="top" @submit.prevent="reveal">
      <el-form-item label="系统内置管理员登录密码">
        <el-input v-model="adminPassword" type="password" autocomplete="new-password" :maxlength="256"
          :disabled="loading" aria-label="系统内置管理员登录密码" />
      </el-form-item>
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    </el-form>
    <dl v-else class="credential-reveal-values">
      <dt>密码</dt><dd>{{ credentials.password_secret_ref || '未设置' }}</dd>
      <dt>2FA 密钥</dt><dd>{{ credentials.totp_secret_ref || '未设置' }}</dd>
    </dl>
    <template #footer>
      <el-button @click="close">关闭</el-button>
      <el-button v-if="!credentials" type="primary" :loading="loading" :disabled="!adminPassword || loading" @click="reveal">验证并查看</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.credential-reveal-button { width: 24px; height: 24px; padding: 4px; }
.credential-reveal-account { margin-bottom: 20px; overflow-wrap: anywhere; color: #334e68; }
.credential-reveal-values { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 16px 12px; margin: 0; }
.credential-reveal-values dt { color: #62758a; }
.credential-reveal-values dd { margin: 0; overflow-wrap: anywhere; user-select: all; font-family: ui-monospace, monospace; }
</style>
