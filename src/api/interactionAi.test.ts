import { describe, expect, it } from 'vitest'

import { resolveEnabledAiProvider, type EnabledAiProviderOption } from '@/api/interactionAi'

const options: EnabledAiProviderOption[] = [
  { label: 'Gemini', value: 'gemini', primary_model: 'gemini-2.5-flash' },
  { label: 'Claude', value: 'claude', primary_model: 'claude-sonnet-4' },
]

describe('resolveEnabledAiProvider', () => {
  it('keeps an explicitly cleared default empty', () => {
    expect(resolveEnabledAiProvider(null, options)).toBe('')
  })

  it('rolls a disabled configured provider forward to the first enabled provider', () => {
    expect(resolveEnabledAiProvider('openai', options)).toBe('gemini')
  })
})
