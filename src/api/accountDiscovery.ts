import { http } from '@/api/http'
import type { AnyRecord } from '@/types/api'

export interface DiscoveryPage<T> { items: T[]; total: number }
export interface DiscoveryCapability { platform: string; enabled: boolean; cursor: boolean; note: string }
export interface DiscoveryKeyword { text: string; language: string; evidence_ids: string[]; enabled: boolean; source: 'ai' | 'manual' }
export interface DiscoveryRules {
  min_views?:number|null; min_likes?:number|null; min_comments?:number|null; min_followers?:number|null; max_followers?:number|null
  min_hits:number; active_days?:number|null; public_only:boolean; original_only:boolean; require_keyword_text:boolean
  media_types:string[]; languages:string[]; candidate_countries:string[]; bio_include:string[]; exclude_words:string[]
}
export interface DiscoveryConfig {
  platforms:string[];tag_ids:string[];countries:string[];exclude_monitor_ids:string[];sample_days:number;per_account:number
  max_accounts:number;max_samples:number;visual:boolean;ai_provider:string;max_tokens:number;search_days:number;max_pages:number
  max_keywords:number;max_candidates:number;schedule_time:string;monitor_interval:number;monitor_tag_ids:string[];monitor_country:string;rules:DiscoveryRules
}
export interface DiscoveryRun {
  id:string;status:string;phase:string;kind:string;error_message:string|null;created_at:string
  result:{stage?:string;operation?:string;limited?:boolean;partial?:boolean;counters?:Record<string,number>;completed_batches?:number;total_batches?:number}
  budget:{tokens:number;max_tokens:number}
}
export interface DiscoveryPlan {
  id:string;name:string;version:number;enabled:boolean;config:DiscoveryConfig;approved_keywords_id:string|null;next_run_at:string|null
  summary:{pending_review?:number;pending_metadata?:number;filtered?:number;rejected?:number;monitored?:number;existing?:number;schedule_error?:string};latest_run?:(Pick<DiscoveryRun,'id'|'status'|'phase'|'error_message'>&{partial?:boolean|null})|null
}
export interface DiscoveryEvidence {id:string;monitor_id?:string;platform?:string;content_url?:string;text_content?:string;truncated?:boolean}
export interface DiscoveryKeywordVersion {id:string;version:number;status:string;created_at:string;reviewed_at?:string|null;items:DiscoveryKeyword[];evidence:DiscoveryEvidence[]}
export interface DiscoveryVersionOption {id:string;version:number;status:string;total:number;created_at:string;reviewed_at:string|null}
export interface DiscoveryPlanDetail {plan:DiscoveryPlan;keyword_versions:DiscoveryVersionOption[];keyword_total:number;runs:DiscoveryPage<DiscoveryRun>}
export interface DiscoverySearch {id:string;platform:string;keyword:string;status:string;pages:number;posts_count:number;error_message:string|null}
export interface DiscoverySample {id?:string;monitor_id?:string;platform?:string;content_url?:string;text_content?:string;truncated?:boolean;post_key?:string;reason?:string}
export interface DiscoverySeed {id:string;platform:string;profile_url:string;name:string}
export interface DiscoveryProfile {
  username?:string;display_name?:string|null;avatar_url?:string|null;biography?:string|null;followers_count?:number|null
  following_count?:number|null;posts_count?:number|null;is_private?:boolean|null;is_verified?:boolean|null;confirmed_country?:string|null
}
export interface DiscoveryCandidate {
  id:string;candidate_id:string;plan_id:string;version:number;status:string;username:string;platform:string;profile_url:string
  profile:DiscoveryProfile;profile_checked_at:string|null;plan_name?:string;reasons:string[];hit_count:number
}
export interface DiscoveryPost {
  platform_post_id:string;content_url:string;text_content:string;published_at:string|null;media_urls:string[];media_pending:number
  keywords:string[];views_count:number|null;likes_count:number|null;comments_count:number|null
  verdict?:string;reasons?:string[]
}
export interface DiscoveryCandidateDetail {candidate:DiscoveryCandidate;posts:DiscoveryPost[];plan:{id:string;name:string;version:number};stale_rules:boolean}
export interface DiscoveryPreview {allowed:boolean;items:{id:string;username:string;platform:string;allowed:boolean;existing:boolean;monitor_id:string|null;reasons:string[]}[]}
const base = '/api/content-selection/discovery'
const planPath = (id: string) => `${base}/plans/${encodeURIComponent(id)}`
export const accountDiscovery = {
  capabilities: () => http.get<DiscoveryCapability[]>(`${base}/capabilities`),
  options: () => http.get<{ countries: string[]; tags: {id:string;name:string}[] }>(`${base}/options`),
  seedOptions: (keyword = '') => http.get<DiscoverySeed[]>(`${base}/seed-options`, { keyword }),
  plans: (params: AnyRecord = {}) => http.get<DiscoveryPage<DiscoveryPlan>>(`${base}/plans`, params),
  plan: (id: string) => http.get<DiscoveryPlanDetail>(planPath(id)),
  savePlan: (id: string | undefined, data: AnyRecord) => id ? http.put<DiscoveryPlan>(planPath(id), data) : http.post<DiscoveryPlan>(`${base}/plans`, data),
  schedule: (id: string, data: AnyRecord) => http.put<DiscoveryPlan>(`${planPath(id)}/schedule`, data),
  start: (id: string, data: AnyRecord) => http.post<DiscoveryRun>(`${planPath(id)}/runs`, data),
  runs: (id: string, params: AnyRecord) => http.get<DiscoveryPage<DiscoveryRun>>(`${planPath(id)}/runs`, params),
  control: (id: string, runId: string, data: AnyRecord) => http.post<DiscoveryRun>(`${planPath(id)}/runs/${encodeURIComponent(runId)}/control`, data),
  searches: (id: string, runId: string, params: AnyRecord) => http.get<DiscoveryPage<DiscoverySearch>>(`${planPath(id)}/runs/${encodeURIComponent(runId)}/searches`, params),
  samples: (id: string, runId: string, params: AnyRecord) => http.get<DiscoveryPage<DiscoverySample>>(`${planPath(id)}/runs/${encodeURIComponent(runId)}/samples`, params),
  keyword: (id: string, keywordId: string) => http.get<DiscoveryKeywordVersion>(`${planPath(id)}/keywords/${encodeURIComponent(keywordId)}`),
  keywordVersions: (id: string, params: AnyRecord) => http.get<DiscoveryPage<DiscoveryVersionOption>>(`${planPath(id)}/keywords`, params),
  saveKeywords: (id: string, keywordId: string, data: AnyRecord) => http.put<DiscoveryKeywordVersion>(`${planPath(id)}/keywords/${encodeURIComponent(keywordId)}`, data),
  candidates: (params: AnyRecord) => http.get<DiscoveryPage<DiscoveryCandidate>>(`${base}/candidates`, params),
  candidate: (id: string) => http.get<DiscoveryCandidateDetail>(`${base}/candidates/${encodeURIComponent(id)}`),
  preview: (data: AnyRecord) => http.post<DiscoveryPreview>(`${base}/candidates/preview`, data),
  review: (data: AnyRecord) => http.post<{id:string;version:number;status:string;monitor_id:string|null}[]>(`${base}/candidates/review`, data),
}
export const discoveryPlatforms: Record<string,string> = { x:'X(Twitter)', threads:'Threads', instagram:'Instagram' }
export const discoveryStatus: Record<string,string> = {
  queued:'等待处理',running:'处理中',waiting_keywords:'关键词待审',paused:'已暂停',failed:'未完成',completed:'本轮完成',canceled:'已停止',
  pending_metadata:'待补资料',pending_review:'待审核',filtered:'条件不符',monitored:'已加入监听',existing:'已存在监听',rejected:'已拒绝',
  limited:'达到本轮上限',unsupported:'协议待配置',draft:'待审核',approved:'已审核',
  qualified:'帖子条件符合',
}
export function discoveryDefaults(): DiscoveryConfig {
  return { platforms:['x','threads','instagram'], tag_ids:[], countries:[], exclude_monitor_ids:[], sample_days:30,
    per_account:20, max_accounts:200, max_samples:500, visual:true, ai_provider:'openai', max_tokens:1000000,
    search_days:30, max_pages:3, max_keywords:30, max_candidates:200, schedule_time:'06:30',
    monitor_interval:720, monitor_tag_ids:[], monitor_country:'',
    rules:{ min_views:undefined,min_likes:undefined,min_comments:undefined,min_followers:undefined,max_followers:undefined,
      min_hits:2,active_days:30,public_only:true,original_only:true,require_keyword_text:true,
      media_types:['text','image','video'],languages:[],candidate_countries:[],bio_include:[],exclude_words:[] } }
}
