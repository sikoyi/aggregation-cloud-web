import { describe, expect, it } from 'vitest'

import type { FieldConfig } from '@/types/crud'
import { groupInteractionDispatchFields } from '@/utils/interactionDispatchFields'

describe('互动会话表单分栏', () => {
  it('保留互动场景并把目标监听账号放入主选择栏', () => {
    const fields: FieldConfig[] = [
      { key: 'title', label: '会话名称' },
      { key: 'interaction_mode', label: '互动场景', type: 'segmented' },
      { key: 'main_account_id', label: '主号设备', type: 'accountTree' },
      { key: 'square_target_account_id', label: '目标监听账号', type: 'remoteSelect' },
      { key: 'comment_account_ids', label: '评论设备', type: 'accountTree' },
    ]

    const grouped = groupInteractionDispatchFields(fields)

    expect(grouped.main.map((field) => field.key)).toEqual([
      'main_account_id',
      'square_target_account_id',
    ])
    expect(grouped.comment.map((field) => field.key)).toEqual(['comment_account_ids'])
    expect(grouped.params.map((field) => field.key)).toEqual(['title', 'interaction_mode'])
  })

  it('新增参数默认进入参数栏，避免字段白名单再次漏展示', () => {
    const fields: FieldConfig[] = [
      { key: 'interaction_mode', label: '互动场景' },
      { key: 'future_option', label: '后续参数' },
    ]

    const grouped = groupInteractionDispatchFields(fields)

    expect(grouped.params.map((field) => field.key)).toEqual([
      'interaction_mode',
      'future_option',
    ])
  })
})
