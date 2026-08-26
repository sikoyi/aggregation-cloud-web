import { describe, expect, it } from 'vitest'

import {
  businessPlatformLabel,
  businessPlatformOptions,
  businessPlatformOptionsForScope,
  providerOptions,
  registrationCountryOptions,
  registrationProviderOptions,
  scriptParamTypeOptions,
} from '@/config/options'

describe('registration country options', () => {
  it('uses searchable display labels while preserving ISO alpha-3 values', () => {
    expect(registrationCountryOptions).toHaveLength(198)
    expect(registrationCountryOptions.find((item) => item.value === 'KOR')).toEqual({
      label: '韩国（KOR）',
      value: 'KOR',
    })
  })

  it('exposes country as a script parameter type', () => {
    expect(scriptParamTypeOptions).toContainEqual({
      label: '国家/地区',
      value: 'country',
    })
  })

  it('exposes supported registration providers as a script parameter type', () => {
    expect(scriptParamTypeOptions).toContainEqual({
      label: '接码平台',
      value: 'registration_provider',
    })
    expect(registrationProviderOptions).toEqual([
      { label: 'Hero SMS', value: 'hero_sms' },
      { label: '火狐狸', value: 'firefox' },
      { label: 'SMSBower', value: 'smsbower' },
      { label: 'WorldCode', value: 'worldcode' },
    ])
  })

  it('exposes every supported device provider', () => {
    expect(providerOptions).toEqual([
      { label: 'MoreLogin', value: 'morelogin' },
      { label: 'AdsPower', value: 'adspower' },
      { label: 'VMOS', value: 'vmos' },
    ])
  })
})

describe('business platform options', () => {
  it('displays X(Twitter) while preserving the x API value', () => {
    expect(businessPlatformOptions).toContainEqual({ label: 'X(Twitter)', value: 'x' })
    expect(businessPlatformLabel('x')).toBe('X(Twitter)')
  })

  it('keeps all options for an unrestricted account', () => {
    expect(businessPlatformOptionsForScope(null)).toEqual(businessPlatformOptions)
  })

  it('only exposes options included in the current account scope', () => {
    expect(businessPlatformOptionsForScope(['instagram'])).toEqual([
      { label: 'Instagram', value: 'instagram' },
    ])
  })

  it('exposes no options when the current account scope is empty', () => {
    expect(businessPlatformOptionsForScope([])).toEqual([])
  })
})
