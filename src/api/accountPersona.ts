import { http } from '@/api/http'

export interface PersonaDocument {
  positioning: string; audience: string; voice: string; facts: string; boundaries: string; preferences: string
}
export interface PersonaVersion {
  id: string; version: number; document: PersonaDocument; analysis_job_id: string | null; created_at: string
}
export interface PersonaObservation { dimension: string; finding: string; confidence: 'low' | 'medium' | 'high'; evidence_ids: string[] }
export interface PersonaJob {
  target_account_id?: string
  id: string; account_id: string; post_id: string | null; persona_id: string | null
  kind: 'analyze' | 'generate'; status: 'queued' | 'running' | 'succeeded' | 'failed'; created_at: string
  attempts: number; draft_text: string | null; draft_version: number; error_message: string | null
  result: { observations?: PersonaObservation[]; suggested_persona?: PersonaDocument; limitations?: string; sample_count?: number; available_posts?: number;
    candidates?: { title: string; text_body: string; review_notes: string }[] }
  usage: { model: string; input_tokens: number | null; output_tokens: number | null; total_tokens: number | null; cost: number | null; currency: string | null }[]
  input?: { source_revision?: string; persona?: PersonaVersion; posts?: { id: string; content_url: string; text_content: string; truncated: boolean }[] }
}
export const emptyPersona = (): PersonaDocument => ({ positioning: '', audience: '', voice: '', facts: '', boundaries: '', preferences: '' })
export const personaFields: { key: keyof PersonaDocument; label: string; limit: number }[] = [
  { key: 'positioning', label: '账号定位', limit: 1500 }, { key: 'audience', label: '目标受众', limit: 1000 },
  { key: 'voice', label: '表达风格', limit: 2000 }, { key: 'facts', label: '已确认事实与经历', limit: 2000 },
  { key: 'boundaries', label: '事实边界与禁用表达', limit: 2000 }, { key: 'preferences', label: '内容偏好与代表作', limit: 2000 },
]
export const personaStatus: Record<PersonaJob['status'], string> = { queued: '等待处理', running: 'AI 处理中', succeeded: '已完成', failed: '未完成' }
const base = (account: string) => `/api/account-personas/${encodeURIComponent(account)}`
export const accountPersona = {
  overview: (account: string) => http.get<{ versions: PersonaVersion[]; jobs: PersonaJob[] }>(base(account)),
  analyze: (account: string, requestKey: string) => http.post<PersonaJob>(`${base(account)}/analyze`, { request_key: requestKey }),
  confirm: (account: string, data: { expected_version: number; document: PersonaDocument; analysis_job_id: string | null }) => http.post<PersonaVersion>(`${base(account)}/confirm`, data),
  generate: (account: string, data: { request_key: string; post_id: string; persona_id: string; language: string; direction: string; target_account_id?: string }) => http.post<PersonaJob>(`${base(account)}/generate`, data),
  job: (account: string, id: string) => http.get<PersonaJob>(`${base(account)}/jobs/${encodeURIComponent(id)}`),
  save: (account: string, id: string, text: string, version: number) => http.put<PersonaJob>(`${base(account)}/jobs/${encodeURIComponent(id)}/draft`, { text_body: text, expected_version: version }),
}
