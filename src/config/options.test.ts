import { describe, expect, it } from 'vitest'

import { registrationCountryOptions, scriptParamTypeOptions } from '@/config/options'

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
})
