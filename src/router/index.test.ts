import { describe, expect, it } from 'vitest'

import source from './index.ts?raw'

describe('router code splitting', () => {
  it('loads business pages lazily instead of bundling every view in the entry chunk', () => {
    const lazyViews = [
      'AppShell',
      'LoginView',
      'DashboardView',
      'AccountCenterView',
      'AccountDataView',
      'DeviceCenterView',
      'ProxyCenterView',
      'ContentCenterView',
      'ResourceView',
    ]

    for (const view of lazyViews) {
      expect(source).toMatch(new RegExp(`const ${view} = \\(\\) => import\\(`))
    }
    expect(source).not.toMatch(/^import\s+\w+View\s+from\s+['"]@\/views\//m)
  })
})
