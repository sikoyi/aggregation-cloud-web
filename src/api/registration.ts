import { http } from '@/api/http'
import type { AnyRecord, PageResult } from '@/types/api'

export type RegistrationProvider = 'hero_sms'
export type RegistrationStatus = 'enabled' | 'disabled'
export type RegistrationBusinessApp = 'threads' | 'x' | 'instagram'
export type ActivationStatus =
  | 'waiting'
  | 'code_received'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'failed'

export interface RegistrationCredential {
  id: string
  provider: RegistrationProvider
  name: string
  key_configured: boolean
  priority: number
  status: RegistrationStatus
  last_balance: number | null
  last_error: string
  last_checked_at: string | null
  last_used_at: string | null
  created_at: string
  updated_at: string
}

export interface RegistrationProfile {
  id: string
  nickname: string
  birthday: string
  country_region: string
  avatar_url: string
  usage_count: number
  last_used_at: string | null
  created_at: string
  updated_at: string
}

export interface RegistrationActivation {
  id: string
  provider: RegistrationProvider
  credential_name: string
  business_app: RegistrationBusinessApp
  country: number
  phone_number: string
  status: ActivationStatus
  sms_code: string
  cost: number | null
  currency: string
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface RegistrationScriptAccount {
  id: string
  username: string
  status: RegistrationStatus
  updated_at: string
}

export interface CredentialInput {
  provider: RegistrationProvider
  name: string
  api_key?: string
  priority: number
  status: RegistrationStatus
}

export interface ProfileInput {
  nickname: string
  birthday: string
  country_region: string
  avatar?: File
}

export const registrationApi = {
  listCredentials: () =>
    http.get<RegistrationCredential[]>('/api/registration/admin/credentials'),
  createCredential: (payload: CredentialInput) =>
    http.post<RegistrationCredential>('/api/registration/admin/credentials', payload),
  updateCredential: (id: string, payload: CredentialInput) =>
    http.put<RegistrationCredential>(`/api/registration/admin/credentials/${id}`, payload),
  deleteCredential: (id: string) =>
    http.delete<null>(`/api/registration/admin/credentials/${id}`),
  checkCredential: (id: string) =>
    http.post<RegistrationCredential>(`/api/registration/admin/credentials/${id}/check`),

  listProfiles: (params: AnyRecord) =>
    http.get<PageResult<RegistrationProfile>>('/api/registration/admin/profiles', params),
  createProfile: (payload: ProfileInput) => {
    const form = buildProfileForm(payload)
    return http.post<RegistrationProfile>('/api/registration/admin/profiles', form)
  },
  updateProfile: (id: string, payload: ProfileInput) => {
    const form = buildProfileForm(payload)
    return http.put<RegistrationProfile>(`/api/registration/admin/profiles/${id}`, form)
  },
  deleteProfile: (id: string) =>
    http.delete<null>(`/api/registration/admin/profiles/${id}`),
  importProfiles: (csvFile: File, avatars: File[]) => {
    const form = new FormData()
    form.append('csv_file', csvFile)
    avatars.forEach((avatar) => form.append('avatars', avatar))
    return http.post<{
      success_count: number
      failed_count: number
      errors: Array<{ row: number; message: string }>
    }>('/api/registration/admin/profiles/import', form)
  },

  listActivations: (params: AnyRecord) =>
    http.get<PageResult<RegistrationActivation>>(
      '/api/registration/admin/activations',
      params,
    ),

  getScriptAccount: () =>
    http.get<RegistrationScriptAccount | null>('/api/registration/admin/script-account'),
  saveScriptAccount: (payload: {
    username: string
    password?: string
    status: RegistrationStatus
  }) =>
    http.put<RegistrationScriptAccount>('/api/registration/admin/script-account', payload),
}

function buildProfileForm(payload: ProfileInput) {
  const form = new FormData()
  form.append('nickname', payload.nickname)
  form.append('birthday', payload.birthday)
  form.append('country_region', payload.country_region)
  if (payload.avatar) form.append('avatar', payload.avatar)
  return form
}
