import { computed } from 'vue'

import { businessPlatformOptionsForScope } from '@/config/options'
import { useAuthStore } from '@/stores/auth'

export function useScopedBusinessPlatformOptions() {
  const auth = useAuthStore()
  return computed(() => (
    businessPlatformOptionsForScope(auth.user?.business_platform_scope)
  ))
}
