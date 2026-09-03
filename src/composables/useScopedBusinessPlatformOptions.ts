import { computed } from 'vue'

import {
  businessPlatformOptions,
  filterOptionsByScope,
} from '@/config/options'
import type { SelectOption } from '@/types/crud'
import { useAuthStore } from '@/stores/auth'

export function useScopedBusinessPlatformOptions(options: SelectOption[] = businessPlatformOptions) {
  const auth = useAuthStore()
  return computed(() => (
    filterOptionsByScope(options, auth.user?.business_platform_scope)
  ))
}
