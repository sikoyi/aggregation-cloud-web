import { computed, onScopeDispose, reactive, ref } from 'vue'

import { http } from '@/api/http'
import type { AnyRecord } from '@/types/api'
import { getErrorMessage } from '@/utils/notify'

const profileFields = ['display_name', 'username', 'profile_url', 'country', 'account_age_type'] as const

export function platformAccountForm(record: AnyRecord = {}) {
  return {
    display_name: String(record.display_name || ''),
    username: String(record.username || ''),
    profile_url: String(record.profile_url || ''),
    country: String(record.country || ''),
    account_age_type: String(record.account_age_type || 'unknown'),
    tag_ids: Array.isArray(record.tag_ids) ? record.tag_ids.map(String) : [],
  }
}

export function platformAccountChanges(record: AnyRecord, form: ReturnType<typeof platformAccountForm>) {
  const previous = platformAccountForm(record)
  const profile: AnyRecord = {}
  for (const key of profileFields) {
    if (form[key] !== previous[key]) profile[key] = form[key].trim() || null
  }
  const tags = [...new Set(form.tag_ids.map(String))].sort()
  const oldTags = [...new Set(previous.tag_ids)].sort()
  return { profile, tags: JSON.stringify(tags) === JSON.stringify(oldTags) ? null : tags }
}

export function usePlatformAccountEdit(accountId: string, platform: string, canEdit: () => boolean) {
  const detail = ref<AnyRecord | null>(null)
  const form = reactive(platformAccountForm())
  const loading = ref(false)
  const submitting = ref(false)
  const changed = ref(false)
  const error = ref('')
  let requestId = 0
  onScopeDispose(() => { requestId++ })
  const canSave = computed(() => {
    if (!detail.value || !canEdit() || loading.value || submitting.value) return false
    const patch = platformAccountChanges(detail.value, form)
    return Boolean(Object.keys(patch.profile).length || patch.tags !== null)
  })

  async function load() {
    if (submitting.value) return
    const request = ++requestId
    detail.value = null
    error.value = ''
    if (!canEdit()) { error.value = '没有编辑账号的权限'; return }
    loading.value = true
    try {
      const data = await http.get<AnyRecord>(`/api/accounts/${encodeURIComponent(accountId)}`)
      if (request !== requestId) return
      if (String(data.id) !== accountId || data.business_platform !== platform) throw new Error('平台账号信息已变化，请刷新后重试')
      detail.value = data
      Object.assign(form, platformAccountForm(data))
    } catch (err) {
      if (request === requestId) error.value = getErrorMessage(err, '平台账号加载失败')
    } finally {
      if (request === requestId) loading.value = false
    }
  }

  async function save() {
    if (!canSave.value || !detail.value) return false
    const patch = platformAccountChanges(detail.value, form)
    if (patch.profile.profile_url) {
      try {
        const url = new URL(String(patch.profile.profile_url))
        if (!['https:', 'http:'].includes(url.protocol)) throw new Error()
      } catch { error.value = '主页链接必须是有效的 http 或 https 地址'; return false }
    }
    error.value = ''
    submitting.value = true
    let profileSaved = false
    try {
      if (Object.keys(patch.profile).length) {
        await http.put(`/api/accounts/${encodeURIComponent(accountId)}`, patch.profile)
        Object.assign(detail.value, patch.profile)
        for (const key of profileFields) {
          if (key in patch.profile) form[key] = String(patch.profile[key] ?? '')
        }
        profileSaved = true
        changed.value = true
      }
      if (patch.tags !== null) {
        await http.put(`/api/accounts/${encodeURIComponent(accountId)}/tags`, { tag_ids: patch.tags })
        detail.value.tag_ids = [...patch.tags]
        changed.value = true
      }
      return true
    } catch (err) {
      error.value = `${profileSaved ? '资料已保存，但标签保存失败：' : ''}${getErrorMessage(err, '保存失败，请重试')}`
      return false
    } finally {
      submitting.value = false
    }
  }

  return { detail, form, loading, submitting, changed, error, canSave, load, save }
}
