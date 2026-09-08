import { describe, expect, it } from 'vitest'
import { identitySelectionLabel, selectedPlatformAccountIds } from './accountIdentitySelection'

describe('平台账号匹配范围', () => {
  const record = { id: 'identity', matched_account_ids: ['threads'], platform_summaries: [
    { account_id: 'threads', business_platform: 'threads' },
    { account_id: 'instagram', business_platform: 'instagram' },
  ] }
  it('未指定平台时，也只取标签或ID筛选实际匹配的账号', () => {
    expect(selectedPlatformAccountIds([record])).toEqual(['threads'])
    expect(identitySelectionLabel([record])).toBe('1 个登录身份，本次影响 1 个平台账号（Threads 1 个）')
  })
  it('匹配元数据丢失或为空时拒绝退回操作全部平台', () => {
    expect(() => selectedPlatformAccountIds([{ ...record, matched_account_ids: undefined }])).toThrow('匹配范围已失效')
    expect(() => selectedPlatformAccountIds([{ ...record, matched_account_ids: [] }])).toThrow('匹配范围已失效')
  })
  it('去重且不能混入概览以外的账号', () => {
    expect(selectedPlatformAccountIds([record, { ...record, matched_account_ids: ['threads', 'outside'] }])).toEqual(['threads'])
  })
})
