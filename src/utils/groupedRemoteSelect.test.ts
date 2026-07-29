import { describe, expect, it } from 'vitest'

import {
  applyRemoteGroupFilter,
  REMOTE_GROUP_ALL,
  REMOTE_GROUP_UNGROUPED,
} from './groupedRemoteSelect'

describe('applyRemoteGroupFilter', () => {
  const config = {
    endpoint: '/api/groups',
    groupParam: 'slot_group_id',
    ungroupedParam: 'slot_group_ungrouped',
  }

  it('keeps base params for all groups', () => {
    expect(applyRemoteGroupFilter({ status: 'enabled' }, REMOTE_GROUP_ALL, config))
      .toEqual({ status: 'enabled' })
  })

  it('adds the concrete group id', () => {
    expect(applyRemoteGroupFilter({ status: 'enabled' }, '12', config))
      .toEqual({ status: 'enabled', slot_group_id: '12' })
  })

  it('adds the virtual ungrouped flag', () => {
    expect(applyRemoteGroupFilter({}, REMOTE_GROUP_UNGROUPED, config))
      .toEqual({ slot_group_ungrouped: true })
  })
})
