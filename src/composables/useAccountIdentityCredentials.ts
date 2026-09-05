import { ElMessage } from 'element-plus'
import { computed, onScopeDispose, reactive, ref, watch, type Ref } from 'vue'

import {
  getAccountIdentity,
  updateAccountIdentityCredentials,
  type AccountIdentityCredentialsPatch,
  type AccountIdentityDetail,
} from '@/api/accountIdentities'
import { ApiError } from '@/api/http'
import { notifyError } from '@/utils/notify'

export function credentialForm(record?: AccountIdentityDetail) {
  return {
    login_username: record?.login_username ?? '',
    password_secret_ref: record?.password_secret_ref ?? '',
    totp_secret_ref: record?.totp_secret_ref ?? '',
    clear_password: false,
    clear_totp: false,
  }
}

export function validCredentialsVersion(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1
}

export function buildCredentialsPatch(record: AccountIdentityDetail, form: ReturnType<typeof credentialForm>) {
  if (!validCredentialsVersion(record.credentials_version)) {
    throw new Error('登录凭据版本无效，请重新加载后再保存')
  }
  const body: AccountIdentityCredentialsPatch = { expected_credentials_version: record.credentials_version }
  for (const key of ['login_username', 'password_secret_ref', 'totp_secret_ref'] as const) {
    if (key === 'password_secret_ref' && form.clear_password) continue
    if (key === 'totp_secret_ref' && form.clear_totp) continue
    // 空输入不代表删除；密码和 2FA 只能通过明确的清空选项删除。
    if (form[key].trim() && form[key] !== (record[key] ?? '')) body[key] = form[key]
  }
  if (form.clear_password) body.clear_password = true
  if (form.clear_totp) body.clear_totp = true
  return Object.keys(body).length > 1 ? body : null
}

export function useAccountIdentityCredentials(
  identityId: Ref<string>,
  canEditAccounts: () => boolean,
  onSaved: () => void,
) {
  const detail = ref<AccountIdentityDetail | null>(null)
  const form = reactive(credentialForm())
  const loading = ref(false)
  const submitting = ref(false)
  const conflict = ref(false)
  const error = ref('')
  let requestId = 0

  const canEdit = computed(() => Boolean(
    canEditAccounts()
    && detail.value?.id === identityId.value
    && detail.value?.can_edit_credentials === true
    && validCredentialsVersion(detail.value?.credentials_version),
  ))
  const patch = computed(() => (
    canEdit.value && detail.value ? buildCredentialsPatch(detail.value, form) : null
  ))
  const canSave = computed(() => canEdit.value && !loading.value && !submitting.value && !conflict.value && Boolean(patch.value))

  async function load() {
    if (submitting.value) return
    const currentRequest = ++requestId
    detail.value = null
    Object.assign(form, credentialForm())
    error.value = ''
    conflict.value = false
    if (!canEditAccounts()) {
      error.value = '无权编辑该身份的登录凭据'
      loading.value = false
      return
    }
    loading.value = true
    try {
      const data = await getAccountIdentity(identityId.value)
      if (currentRequest !== requestId) return
      if (data.id !== identityId.value) throw new Error('身份详情不匹配，请重新加载')
      if (data.can_edit_credentials !== true) throw new Error('无权编辑该身份的登录凭据')
      if (!validCredentialsVersion(data.credentials_version)) throw new Error('登录凭据版本无效，请重新加载后再保存')
      detail.value = data
      Object.assign(form, credentialForm(data))
    } catch (err) {
      if (currentRequest === requestId) error.value = notifyError(err, '登录凭据加载失败')
    } finally {
      if (currentRequest === requestId) loading.value = false
    }
  }

  async function save() {
    if (!canSave.value || !patch.value) return
    const currentRequest = requestId
    submitting.value = true
    error.value = ''
    try {
      await updateAccountIdentityCredentials(identityId.value, patch.value)
      if (currentRequest !== requestId) return
      detail.value = null
      Object.assign(form, credentialForm())
      ElMessage.success('登录凭据已更新')
      onSaved()
    } catch (err) {
      if (currentRequest !== requestId) return
      if (err instanceof ApiError && err.status === 409) {
        conflict.value = true
        error.value = '登录凭据已被其他操作更新，请重新加载后再保存。重新加载会丢弃本次未保存修改。'
        ElMessage.warning(error.value)
      } else {
        if (err instanceof ApiError && err.status === 403 && detail.value) detail.value.can_edit_credentials = false
        error.value = notifyError(err, '登录凭据保存失败')
      }
    } finally {
      if (currentRequest === requestId) submitting.value = false
    }
  }

  watch(identityId, load, { immediate: true })
  onScopeDispose(() => {
    requestId += 1
    detail.value = null
    Object.assign(form, credentialForm())
  })

  return { detail, form, loading, submitting, conflict, error, canEdit, canSave, load, save }
}
