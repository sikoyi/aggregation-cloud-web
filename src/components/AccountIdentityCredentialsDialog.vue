<script setup lang="ts">
import { RefreshCw, Save } from 'lucide-vue-next'
import { computed, toRef } from 'vue'

import { useAccountIdentityCredentials } from '@/composables/useAccountIdentityCredentials'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  identityId: string
}>()

const emit = defineEmits<{
  close: []
  changed: []
}>()

const auth = useAuthStore()
const { detail, form, loading, submitting, conflict, error, canEdit, canSave, load, save } = useAccountIdentityCredentials(
  toRef(props, 'identityId'),
  () => auth.can('accounts.edit'),
  () => {
    emit('changed')
    emit('close')
  },
)
const formDisabled = computed(() => !canEdit.value || loading.value || submitting.value || conflict.value)

function close() {
  if (!submitting.value) emit('close')
}
</script>

<template>
  <el-dialog
    :model-value="true"
    title="编辑登录凭据"
    width="min(92vw, 520px)"
    append-to-body
    destroy-on-close
    :close-on-click-modal="false"
    :close-on-press-escape="!submitting"
    :show-close="!submitting"
    @close="close"
  >
    <div v-loading="loading" class="identity-credentials-form">
      <el-alert
        title="共享凭据变更将作用于同一身份关联的所有平台账号"
        type="warning"
        show-icon
        :closable="false"
        class="mb-4"
      />
      <el-alert v-if="error" :title="error" :type="conflict ? 'warning' : 'error'" show-icon :closable="false" class="mb-4" />
      <el-form v-if="detail" label-position="top" :disabled="formDisabled" @submit.prevent="save">
        <el-form-item label="登录账号">
          <el-input v-model="form.login_username" autocomplete="off" placeholder="留空保持不变" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="form.password_secret_ref"
            type="password"
            show-password
            autocomplete="new-password"
            :disabled="formDisabled || form.clear_password"
            placeholder="留空保持不变"
          />
          <el-checkbox v-model="form.clear_password">清空密码</el-checkbox>
        </el-form-item>
        <el-form-item label="2FA">
          <el-input
            v-model="form.totp_secret_ref"
            type="password"
            show-password
            autocomplete="new-password"
            :disabled="formDisabled || form.clear_totp"
            placeholder="留空保持不变"
          />
          <el-checkbox v-model="form.clear_totp">清空 2FA</el-checkbox>
        </el-form-item>
      </el-form>
    </div>
    <template #footer>
      <div class="identity-credentials-footer">
        <el-button v-if="error" :icon="RefreshCw" :loading="loading" :disabled="loading || submitting" @click="load">重新加载</el-button>
        <span class="identity-credentials-footer__spacer" />
        <el-button :disabled="submitting" @click="close">取消</el-button>
        <el-button type="primary" :icon="Save" :loading="submitting" :disabled="!canSave" @click="save">保存</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.identity-credentials-form { min-height: 100px; }
.identity-credentials-footer { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.identity-credentials-footer__spacer { flex: 1; }
.identity-credentials-footer :deep(.el-button + .el-button) { margin-left: 0; }
</style>
