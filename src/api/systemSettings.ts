import { http } from '@/api/http'

export interface SystemDefaults {
  default_business_platform: string | null
  default_runtime_platform: string | null
  default_provider: string | null
  default_ai_provider: string | null
  updated_at?: string | null
}

export const FALLBACK_SYSTEM_DEFAULTS: SystemDefaults = {
  default_business_platform: 'threads',
  default_runtime_platform: 'fingerprint_browser',
  default_provider: 'morelogin',
  default_ai_provider: 'gemini',
}

let cachedDefaults: SystemDefaults | null = null

export async function getSystemDefaults(force = false): Promise<SystemDefaults> {
  if (!force && cachedDefaults) return cachedDefaults
  const data = await http.get<SystemDefaults>('/api/system-settings/defaults')
  cachedDefaults = { ...FALLBACK_SYSTEM_DEFAULTS, ...data }
  return cachedDefaults
}

export function cacheSystemDefaults(defaults: SystemDefaults) {
  cachedDefaults = { ...FALLBACK_SYSTEM_DEFAULTS, ...defaults }
  return cachedDefaults
}
