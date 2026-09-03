import { http } from '@/api/http'
import type { PageResult } from '@/types/api'

export interface RegistrationResourceTemplateField {
  id?: string
  field_key: string
  display_name: string
  data_type: 'string' | 'date'
  required: boolean
  sensitive: boolean
  description?: string | null
  example?: string | null
  sort_order: number
}

export interface RegistrationResourceTemplate {
  id: string
  template_key: string
  version: number
  name: string
  business_platform: string
  business_scene: string
  description?: string | null
  status: 'enabled' | 'disabled'
  fields: RegistrationResourceTemplateField[]
  created_at: string
  updated_at: string
}

export interface RegistrationResourceBatch {
  id: string
  template_id: string
  template_name?: string | null
  template_key?: string | null
  template_version?: number | null
  business_platform?: string | null
  name: string
  source_filename: string
  total_count: number
  available_count: number
  used_count: number
  invalid_count: number
  validation_errors: Array<{ row_number: number; errors: string[] }>
  created_by?: string | null
  created_by_name?: string | null
  created_at: string
  updated_at: string
}

export interface RegistrationResourceItem {
  id: string
  template_id: string
  batch_id: string
  row_number: number
  payload: Record<string, unknown>
  status: 'unused' | 'used'
  used_task_run_id?: string | null
  used_at?: string | null
  created_at: string
}

export function listRegistrationResourceTemplates(params?: Record<string, unknown>) {
  return http.get<RegistrationResourceTemplate[]>(
    '/api/resource-center/registration-resources/templates',
    params,
  )
}

export function createRegistrationResourceTemplate(payload: Record<string, unknown>) {
  return http.post<RegistrationResourceTemplate>(
    '/api/resource-center/registration-resources/templates',
    payload,
  )
}

export function updateRegistrationResourceTemplate(
  templateId: string,
  payload: Record<string, unknown>,
) {
  return http.put<RegistrationResourceTemplate>(
    `/api/resource-center/registration-resources/templates/${encodeURIComponent(templateId)}`,
    payload,
  )
}

export function listRegistrationResourceBatches(params?: Record<string, unknown>) {
  return http.get<PageResult<RegistrationResourceBatch>>(
    '/api/resource-center/registration-resources/batches',
    params,
  )
}

export function listRegistrationResourceItems(
  batchId: string,
  params?: Record<string, unknown>,
) {
  return http.get<PageResult<RegistrationResourceItem>>(
    `/api/resource-center/registration-resources/batches/${encodeURIComponent(batchId)}/resources`,
    params,
  )
}

export function importRegistrationResourceBatch(formData: FormData) {
  return http.post<{
    batch: RegistrationResourceBatch
    imported_count: number
    invalid_count: number
    validation_errors: Array<{ row_number: number; errors: string[] }>
  }>('/api/resource-center/registration-resources/batches/import', formData)
}

export function deleteRegistrationResourceBatch(batchId: string) {
  return http.delete<RegistrationResourceBatch>(
    `/api/resource-center/registration-resources/batches/${encodeURIComponent(batchId)}`,
  )
}

export async function downloadRegistrationResourceTemplate(
  template: RegistrationResourceTemplate,
) {
  const token = localStorage.getItem('access_token') || ''
  const response = await fetch(
    `${http.apiBaseUrl}/api/resource-center/registration-resources/templates/${encodeURIComponent(template.id)}/download`,
    { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
  )
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.msg || '模板下载失败')
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${template.template_key}_v${template.version}_导入模板.xlsx`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
