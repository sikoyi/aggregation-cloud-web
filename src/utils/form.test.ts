import { describe, expect, it } from 'vitest'

import type { FieldConfig } from '@/types/crud'
import { buildFormState, buildPayload } from '@/utils/form'


describe('动态表单数字范围', () => {
  const fields: FieldConfig[] = [
    {
      key: 'step_delay_min_minutes',
      endKey: 'step_delay_max_minutes',
      label: '延迟下发时间（分钟）',
      type: 'numberRange',
      defaultValue: 0,
      endDefaultValue: 1,
      required: true,
    },
  ]

  it('初始化并提交范围两端的值', () => {
    const state = buildFormState(fields)

    expect(state).toEqual({
      step_delay_min_minutes: 0,
      step_delay_max_minutes: 1,
    })

    state.step_delay_min_minutes = 2
    state.step_delay_max_minutes = 5
    expect(buildPayload(fields, state, 'create')).toEqual({
      step_delay_min_minutes: 2,
      step_delay_max_minutes: 5,
    })
  })
})
