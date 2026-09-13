import { describe, expect, it } from 'vitest'

import { formatCell, statusLabel, statusTagType } from './format'

describe('多选业务名称', () => {
  const column = { key: 'purposes', label: '业务', type: 'list' as const,
    options: [{ value: 'account_warmup', label: '账号养号' }] }
  it('业务用途显示中文且未知值不丢失', () => {
    expect(formatCell({ purposes: ['account_warmup', 'future'] }, column)).toBe('账号养号、future')
    expect(formatCell({ purposes: [] }, column)).toBe('-')
  })
})

describe('互动场景格式化', () => {
  it('使用中文名称展示互动场景', () => {
    expect(statusLabel('conversation')).toBe('链接内容互动')
    expect(statusLabel('square_numeric')).toBe('广场内容互动')
    expect(statusTagType('conversation')).toBe('primary')
    expect(statusTagType('square_numeric')).toBe('success')
  })

  it('使用中文名称和统一颜色展示文案来源', () => {
    expect(statusLabel('ai')).toBe('AI 生成')
    expect(statusLabel('custom')).toBe('自定义内容')
    expect(statusTagType('ai')).toBe('warning')
    expect(statusTagType('custom')).toBe('warning')
  })

  it('区分受限和封禁状态', () => {
    expect(statusLabel('restricted')).toBe('受限')
    expect(statusLabel('banned')).toBe('封禁')
  })
})
