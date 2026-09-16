import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('theme preference', () => {
  let stored: string | null
  let dark: boolean
  let storageListener: (event: { key: string | null; newValue: string | null }) => void
  beforeEach(() => {
    vi.resetModules()
    stored = null
    dark = false
    vi.stubGlobal('document', { createElement: () => ({}), documentElement: {
      classList: { toggle: (_: string, value: boolean) => { dark = value }, contains: () => dark },
      style: {},
    } })
    vi.stubGlobal('localStorage', {
      getItem: () => stored,
      setItem: (_: string, value: string) => { stored = value },
    })
    vi.stubGlobal('window', { addEventListener: (_: string, listener: typeof storageListener) => { storageListener = listener } })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('defaults to light and persists both toggle directions', async () => {
    const { initializeTheme, useTheme } = await import('./useTheme')
    initializeTheme()
    const theme = useTheme()
    expect(dark).toBe(false)
    theme.toggleTheme()
    expect([dark, theme.isDark.value, stored]).toEqual([true, true, 'dark'])
    theme.toggleTheme()
    expect([dark, stored]).toEqual([false, 'light'])
  })

  it('restores a saved preference and synchronizes other tabs', async () => {
    stored = 'dark'
    const { initializeTheme, useTheme } = await import('./useTheme')
    initializeTheme()
    expect(dark).toBe(true)
    storageListener({ key: 'unrelated', newValue: 'light' })
    expect(dark).toBe(true)
    storageListener({ key: 'aggregation-cloud:theme', newValue: 'light' })
    expect(useTheme().isDark.value).toBe(false)
    storageListener({ key: 'aggregation-cloud:theme', newValue: 'dark' })
    storageListener({ key: null, newValue: null })
    expect(dark).toBe(false)
  })

  it('remains usable when browser storage is blocked', async () => {
    vi.stubGlobal('localStorage', { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } })
    const { initializeTheme, useTheme } = await import('./useTheme')
    initializeTheme()
    expect(() => useTheme().toggleTheme()).not.toThrow()
    expect(dark).toBe(true)
  })

  it('treats invalid saved values as light and initializes only once', async () => {
    stored = 'invalid'
    const { initializeTheme, useTheme } = await import('./useTheme')
    initializeTheme()
    expect(dark).toBe(false)
    useTheme().toggleTheme()
    stored = 'light'
    initializeTheme()
    expect(dark).toBe(true)
  })
})
