import { describe, expect, it } from 'vitest'

import { dataScopeForFieldKey, isDataScopedFieldKey } from '@/config/options'

const user = {
  business_platform_scope: ['threads'],
  runtime_platform_scope: ['cloud_phone'],
  provider_scope: ['vmos'],
}

describe('data scoped fields', () => {
  it('maps business, runtime and provider fields to their scopes', () => {
    expect(dataScopeForFieldKey('business_platform', user)).toEqual(['threads'])
    expect(dataScopeForFieldKey('runtime_platform', user)).toEqual(['cloud_phone'])
    expect(dataScopeForFieldKey('provider', user)).toEqual(['vmos'])
  })

  it('recognizes defaults and supported value fields', () => {
    expect(isDataScopedFieldKey('default_business_platform')).toBe(true)
    expect(isDataScopedFieldKey('supported_runtime_platforms')).toBe(true)
    expect(isDataScopedFieldKey('default_provider')).toBe(true)
    expect(isDataScopedFieldKey('status')).toBe(false)
  })
})
