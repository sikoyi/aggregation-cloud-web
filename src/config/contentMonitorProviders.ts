export type MonitorBusinessPlatform = 'threads' | 'x' | 'instagram' | 'facebook'
export type MonitorProvider = 'apify' | 'threads_protocol' | 'x_protocol' | 'instagram_protocol'

export interface MonitorProviderOption {
  label: string
  value: MonitorProvider
}

const APIFY_OPTION: MonitorProviderOption = { label: 'Apify', value: 'apify' }

export function providerOptionsForPlatform(platform: MonitorBusinessPlatform): MonitorProviderOption[] {
  if (platform === 'threads') {
    return [
      { label: 'Threads 内部协议', value: 'threads_protocol' },
      APIFY_OPTION,
    ]
  }
  if (platform === 'x') {
    return [
      { label: 'X 内部接口', value: 'x_protocol' },
      APIFY_OPTION,
    ]
  }
  if (platform === 'instagram') return [{ label: 'Instagram 内部协议', value: 'instagram_protocol' }]
  return [APIFY_OPTION]
}

export function defaultMonitorProviderForPlatform(platform: MonitorBusinessPlatform): MonitorProvider {
  return platform === 'x' ? 'x_protocol' : platform === 'instagram' ? 'instagram_protocol' : 'apify'
}

export function normalizeMonitorProvider(
  platform: MonitorBusinessPlatform,
  value: unknown,
): MonitorProvider {
  const providers = providerOptionsForPlatform(platform).map((item) => item.value)
  return providers.includes(value as MonitorProvider)
    ? value as MonitorProvider
    : defaultMonitorProviderForPlatform(platform)
}

export function isInternalMonitorProvider(provider: MonitorProvider): boolean {
  return provider === 'threads_protocol' || provider === 'x_protocol' || provider === 'instagram_protocol'
}

export function monitorProviderLabel(provider: MonitorProvider): string {
  if (provider === 'threads_protocol') return 'Threads 内部协议'
  if (provider === 'x_protocol') return 'X 内部接口'
  if (provider === 'instagram_protocol') return 'Instagram 内部协议'
  return 'Apify'
}
