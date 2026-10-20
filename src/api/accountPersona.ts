import { http } from '@/api/http'

export interface PersonaDocument {
  positioning: string; audience: string; voice: string; facts: string; boundaries: string; preferences: string
}
export interface PersonaVersion {
  id: string; version: number; document: PersonaDocument; analysis_job_id: string | null; created_at: string
}
export interface PersonaObservation { dimension: string; finding: string; confidence: 'low' | 'medium' | 'high'; evidence_ids: string[] }
export interface PersonaAnalysis {
  observations: PersonaObservation[]; suggested_persona: PersonaDocument; limitations: string
  sample_count?: number; available_posts?: number
}
export interface PersonaJob {
  budget?: { limit_cny: number | null; known_cny: number; known_cost_calls?: number; unknown_cost_calls: number; calls: number; max_calls: number | null; tokens: number; max_tokens: number; resume_token_increment?: number; blocked_reason: string; legacy_unknown_calls?: number }
  target_account_id?: string
  target_account?: { id: string; name: string; platform: string }
  id: string; account_id: string; post_id: string | null; persona_id: string | null
  kind: 'analyze' | 'generate'; status: 'queued' | 'running' | 'succeeded' | 'failed'; created_at: string
  attempts: number; draft_text: string | null; draft_version: number; error_message: string | null
  result: { observations?: PersonaObservation[]; suggested_persona?: PersonaDocument; limitations?: string; sample_count?: number; available_posts?: number;
    model_calls?: { id: string; stage: string; status: string; duration_ms?: number; error?: string }[];
    stage_metrics?: Record<string, { attempts: number; succeeded: number; duration_ms: number }>;
    progress?: { stage: string; label: string; completed_batches: number; total_batches: number };
    analysis_reference?: { job_id: string; analyzed_at: string; posts?: { id: string; content_url: string; text_content: string; truncated?: boolean }[] };
    author_analysis?: PersonaAnalysis; candidates?: { title: string; text_body: string; review_notes: string }[] }
  usage: { model: string; input_tokens: number | null; output_tokens: number | null; total_tokens: number | null; cost: number | null; currency: string | null }[]
  input?: { prompt_version?: string; source_revision?: string; persona?: PersonaVersion;
    post?: { id: string; content_url: string; text_body: string }; posts?: { id: string; content_url: string; text_content: string; truncated: boolean }[] }
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
  history: (account: string, params: { post_id: string; target_account_id?: string; page: number; page_size: number }) =>
    http.get<{ items: PersonaJob[]; total: number; page: number; page_size: number }>(`${base(account)}/jobs`, params),
  analyze: (account: string, requestKey: string) => http.post<PersonaJob>(`${base(account)}/analyze`, { request_key: requestKey }),
  confirm: (account: string, data: { expected_version: number; document: PersonaDocument; analysis_job_id: string | null }) => http.post<PersonaVersion>(`${base(account)}/confirm`, data),
  generate: (account: string, data: { request_key: string; post_id: string; persona_id?: string; language: string; direction: string; target_account_id?: string }) => http.post<PersonaJob>(`${base(account)}/generate`, data),
  job: (account: string, id: string) => http.get<PersonaJob>(`${base(account)}/jobs/${encodeURIComponent(id)}`),
  resume: (account: string, id: string, requestKey: string) => http.post<PersonaJob>(`${base(account)}/jobs/${encodeURIComponent(id)}/resume`, { request_key: requestKey }),
  save: (account: string, id: string, text: string, version: number) => http.put<PersonaJob>(`${base(account)}/jobs/${encodeURIComponent(id)}/draft`, { text_body: text, expected_version: version }),
}
