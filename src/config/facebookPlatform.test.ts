import { describe, expect, it } from 'vitest'
import { businessPlatformLabel, businessPlatformOptions, businessPlatformOptionsForScope, socialBusinessPlatformOptions } from './options'

describe('Facebook personal account platform', () => {
  it('is available in shared business and social options', () => {
    expect(businessPlatformOptions.filter((item) => item.value === 'facebook')).toEqual([
      { label: 'Facebook', value: 'facebook' },
    ])
    expect(socialBusinessPlatformOptions.some((item) => item.value === 'facebook')).toBe(true)
    expect(businessPlatformLabel('facebook')).toBe('Facebook')
  })

  it('does not widen existing operator scopes', () => {
    expect(businessPlatformOptionsForScope(['threads', 'instagram']).some((item) => item.value === 'facebook')).toBe(false)
    expect(businessPlatformOptionsForScope(['facebook'])).toEqual([{ label: 'Facebook', value: 'facebook' }])
    expect(businessPlatformOptionsForScope([])).toEqual([])
  })

  it('does not expose unimplemented Page or Group platforms', () => {
    expect(businessPlatformOptions.map((item) => item.value)).not.toContain('facebook_group')
    expect(businessPlatformOptions.map((item) => item.value)).not.toContain('facebook_page')
  })
})
