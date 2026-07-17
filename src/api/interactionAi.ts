import { http } from '@/api/http'
import type { SelectOption } from '@/types/crud'

export interface EnabledAiProviderOption extends SelectOption {
  value: 'gemini' | 'openai' | 'claude'
  primary_model: string
}

let cachedOptions: EnabledAiProviderOption[] | null = null

export async function getEnabledAiProviderOptions(force = false) {
  if (!force && cachedOptions) return cachedOptions
  cachedOptions = await http.get<EnabledAiProviderOption[]>('/api/interaction-center/ai/enabled-providers')
  return cachedOptions
}

export function invalidateEnabledAiProviderOptions() {
  cachedOptions = null
}

export function resolveEnabledAiProvider(preferred: string, options: EnabledAiProviderOption[]) {
  return options.some((item) => item.value === preferred)
    ? preferred
    : String(options[0]?.value || '')
}
