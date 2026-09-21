import { describe, expect, it } from 'vitest'

import {
  defaultMonitorProviderForPlatform,
  isInternalMonitorProvider,
  normalizeMonitorProvider,
  providerOptionsForPlatform,
} from './contentMonitorProviders'

describe('content monitor providers', () => {
  it('offers only Apify for Facebook until an internal adapter exists', () => {
    expect(providerOptionsForPlatform('facebook')).toEqual([{ label: 'Apify', value: 'apify' }])
    expect(normalizeMonitorProvider('facebook', 'threads_protocol')).toBe('apify')
    expect(normalizeMonitorProvider('facebook', 'x_protocol')).toBe('apify')
    expect(defaultMonitorProviderForPlatform('facebook')).toBe('apify')
  })
  it('offers the X internal service first while keeping Apify available', () => {
    expect(providerOptionsForPlatform('x')).toEqual([
      { label: 'X 内部接口', value: 'x_protocol' },
      { label: 'Apify', value: 'apify' },
    ])
    expect(defaultMonitorProviderForPlatform('x')).toBe('x_protocol')
  })

  it('keeps platform-specific protocol boundaries', () => {
    expect(providerOptionsForPlatform('threads')).toEqual([
      { label: 'Threads 内部协议', value: 'threads_protocol' },
      { label: 'Apify', value: 'apify' },
    ])
    expect(providerOptionsForPlatform('instagram')).toEqual([
      { label: 'Apify', value: 'apify' },
    ])
    expect(isInternalMonitorProvider('threads_protocol')).toBe(true)
    expect(isInternalMonitorProvider('x_protocol')).toBe(true)
    expect(isInternalMonitorProvider('apify')).toBe(false)
  })

  it('rejects a provider that belongs to another platform', () => {
    expect(normalizeMonitorProvider('x', 'threads_protocol')).toBe('x_protocol')
    expect(normalizeMonitorProvider('threads', 'x_protocol')).toBe('apify')
    expect(normalizeMonitorProvider('instagram', 'x_protocol')).toBe('apify')
    expect(normalizeMonitorProvider('x', 'apify')).toBe('apify')
  })
})
