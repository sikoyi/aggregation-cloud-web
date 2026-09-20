import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Router } from 'vue-router'
import { isPageLoadError, installNavigationRecovery } from './navigationRecovery'

const mocks = vi.hoisted(() => ({ confirm: vi.fn(), error: vi.fn(), reload: vi.fn() }))
vi.mock('element-plus', () => ({ ElMessageBox: { confirm: mocks.confirm }, ElMessage: { error: mocks.error } }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('window', { location: { reload: mocks.reload } })
})

describe('navigation recovery', () => {
  it.each(['Failed to fetch dynamically imported module: /assets/page.js', 'Importing a module script failed.', 'error loading dynamically imported module', 'Unable to preload CSS for /assets/page.css', 'Loading chunk 5 failed'])('recognizes %s', message => {
    expect(isPageLoadError(new Error(message))).toBe(true)
  })

  it('does not mistake business errors for version changes', () => {
    expect(isPageLoadError(new Error('permission denied'))).toBe(false)
  })

  it('deduplicates prompts, preserves the page on cancel, and allows another attempt', async () => {
    let handler!: (error: Error) => void
    let reject!: () => void
    mocks.confirm.mockImplementation(() => new Promise((_, no) => { reject = () => no('cancel') }))
    installNavigationRecovery({ onError: (fn: typeof handler) => { handler = fn } } as unknown as Router)
    const error = new Error('Failed to fetch dynamically imported module')
    handler(error)
    handler(error)
    expect(mocks.confirm).toHaveBeenCalledTimes(1)
    reject()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(mocks.reload).not.toHaveBeenCalled()
    handler(error)
    expect(mocks.confirm).toHaveBeenCalledTimes(2)
  })

  it('reloads only after explicit confirmation', async () => {
    let handler!: (error: Error) => void
    mocks.confirm.mockResolvedValue('confirm')
    installNavigationRecovery({ onError: (fn: typeof handler) => { handler = fn } } as unknown as Router)
    handler(new Error('Unable to preload CSS'))
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(mocks.reload).toHaveBeenCalledTimes(1)
  })
})
