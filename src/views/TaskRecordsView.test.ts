import { describe, expect, it } from 'vitest'
import view from './TaskRecordsView.vue?raw'
import router from '../router/index.ts?raw'

describe('task notification deep link', () => {
  it('opens the existing task drawer and clears the query on close', () => {
    expect(view).toContain('() => route.query.task_id')
    expect(view).toContain(':task-id="linkedTaskId"')
    expect(view).toContain('delete query.task_id')
    expect(view).toContain('@update:model-value="updateLinkedTaskVisible"')
  })
  it('keeps login redirects and task permission checks', () => {
    expect(router).toContain('redirect: to.fullPath')
    expect(router).toContain("permission: 'tasks.view'")
  })
})
