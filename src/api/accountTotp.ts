import { http } from '@/api/http'

export interface AccountTotpCode {
  code: string
  server_time: number
  expires_at: number
  period: number
}

export type TotpSource = 'accounts' | 'account-identities'

export function getAccountTotp(source: TotpSource, id: string, signal: AbortSignal) {
  return http.getWithSignal<AccountTotpCode>(`/api/${source}/${encodeURIComponent(id)}/totp`, signal)
}
