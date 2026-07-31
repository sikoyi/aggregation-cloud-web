import { describe, expect, it } from 'vitest'

import { proxyProtocolOptions, scriptPurposeOptions } from './options'
import { resources } from './resources'


describe('互动会话操作', () => {
  const retryAction = resources.interactionSessions.rowActions?.find((action) => action.key === 'retry')
  const cancelAction = resources.interactionSessions.rowActions?.find((action) => action.key === 'cancel')

  it('仅在会话结束且存在失败结果时提供重试入口', () => {
    expect(retryAction).toBeDefined()
    expect(retryAction?.visible?.({ status: 'completed', step_failed: 1 })).toBe(true)
    expect(retryAction?.visible?.({ status: 'all_failed' })).toBe(true)
    expect(retryAction?.visible?.({ status: 'failed' })).toBe(true)
    expect(retryAction?.visible?.({ status: 'running' })).toBe(false)
    expect(retryAction?.visible?.({ status: 'completed', step_failed: 0 })).toBe(false)
  })

  it('仅允许取消排队中或运行中的会话', () => {
    expect(cancelAction).toBeDefined()
    expect(cancelAction?.visible?.({ status: 'queued' })).toBe(true)
    expect(cancelAction?.visible?.({ status: 'running' })).toBe(true)
    expect(cancelAction?.visible?.({ status: 'completed' })).toBe(false)
    expect(cancelAction?.visible?.({ status: 'canceled' })).toBe(false)
  })
})

describe('互动会话文案来源', () => {
  const fields = resources.interactionSessions.createFields || []

  it('支持 AI 生成与自定义内容两种模式', () => {
    const modeField = fields.find((field) => field.key === 'content_mode')
    const customField = fields.find((field) => field.key === 'custom_contents_text')
    const aiField = fields.find((field) => field.key === 'ai_provider')

    expect(modeField?.options?.map((option) => option.value)).toEqual(['ai', 'custom'])
    expect(customField?.visibleWhen).toEqual({ key: 'content_mode', value: 'custom' })
    expect(aiField?.visibleWhen).toEqual({ key: 'content_mode', value: 'ai' })
  })
})

describe('代理协议选项', () => {
  it('分别提供 Socks5、HTTP 和 HTTPS', () => {
    expect(proxyProtocolOptions.map((option) => option.value)).toEqual(['socks5', 'http', 'https'])
  })
})

describe('发布内容来源', () => {
  const fields = resources.publishedContents.createFields || []

  it('支持把未分组内容作为虚拟内容池随机取用', () => {
    const sourceField = fields.find((field) => field.key === 'content_source_type')
    const groupField = fields.find((field) => field.key === 'content_group_id')
    const contentField = fields.find((field) => field.key === 'content_id')

    expect(sourceField?.options?.map((option) => option.value)).toEqual([
      'content',
      'content_group',
      'ungrouped',
    ])
    expect(groupField?.disabledWhen).toEqual({
      key: 'content_source_type',
      value: ['content', 'ungrouped'],
    })
    expect(contentField?.disabledWhen).toEqual({
      key: 'content_source_type',
      value: ['content_group', 'ungrouped'],
    })
  })

  it('未分组随机下发时清除旧的内容和内容池选择', () => {
    const body = resources.publishedContents.createBody?.({
      business_platform: 'threads',
      runtime_platform: 'fingerprint_browser',
      provider: 'morelogin',
      account_ids: ['1', '2'],
      content_source_type: 'ungrouped',
      content_status: 'all',
      content_id: '12',
      content_group_id: '8',
    }) as Record<string, unknown>

    expect(body.content_status).toBeNull()
    expect(body.content_id).toBeNull()
    expect(body.content_group_id).toBeNull()
  })

  it('评论内容可选且未填写时提交 null', () => {
    const commentField = fields.find((field) => field.key === 'comment_content')
    const emptyBody = resources.publishedContents.createBody?.({
      content_source_type: 'content',
      comment_content: '   ',
    }) as Record<string, unknown>
    const filledBody = resources.publishedContents.createBody?.({
      content_source_type: 'content',
      comment_content: 'Thanks for sharing.',
    }) as Record<string, unknown>

    expect(commentField?.type).toBe('textarea')
    expect(commentField?.required).not.toBe(true)
    expect(emptyBody.comment_content).toBeNull()
    expect(filledBody.comment_content).toBe('Thanks for sharing.')
  })
})

describe('账号注册任务下发', () => {
  const fields = resources.tasks.createFields || []

  it('脚本用途包含账号注册', () => {
    expect(scriptPurposeOptions.some((option) => option.value === 'account_registration')).toBe(true)
  })

  it('提供已有窗口和创建新窗口两种注册方式', () => {
    const modeField = fields.find((field) => field.key === 'registration_target_mode')
    const countField = fields.find((field) => field.key === 'concurrent_registration_count')
    const slotField = fields.find((field) => field.key === 'slot_ids')

    expect(modeField?.options?.map((option) => option.value)).toEqual([
      'existing_slots',
      'create_windows',
    ])
    expect(countField?.visibleWhenAll).toEqual([
      { key: 'script_purpose', value: 'account_registration' },
      { key: 'registration_target_mode', value: 'create_windows' },
    ])
    expect(slotField?.visibleWhen).toEqual({
      key: 'registration_target_mode',
      value: 'existing_slots',
    })
  })

  it('下发请求保留注册调度参数', () => {
    const body = resources.tasks.createBody?.({
      template_id: '7',
      slot_ids: [],
      registration_target_mode: 'create_windows',
      concurrent_registration_count: 10,
      execution_count: 10,
      params: { country: 'KOR' },
    }) as Record<string, unknown>

    expect(body.registration_target_mode).toBe('create_windows')
    expect(body.concurrent_registration_count).toBe(10)
  })
})

describe('账号批量设置标签', () => {
  const action = resources.accounts.batchActions?.find((item) => item.key === 'batch-set-tags')
  const tagField = action?.fields?.find((field) => field.key === 'tag_ids')

  it('支持输入名称后快捷创建并选择账号标签', () => {
    expect(tagField?.remote?.create?.endpoint).toBe('/api/account-tags')
    expect(tagField?.remote?.create?.body('重点账号')).toEqual({ name: '重点账号' })
    expect(tagField?.placeholder).toContain('按回车新建')
  })
})

describe('设备管理筛选', () => {
  it('支持按绑定账号的实时登录状态筛选', () => {
    const field = resources.slots.filters?.find((filter) => filter.key === 'account_login_status')

    expect(field?.label).toBe('账号登录状态')
    expect(field?.options?.map((option) => option.value)).toEqual([
      'not_logged_in',
      'unknown',
      'logged_in',
      'logged_in_dm_unavailable',
      'twofa_required',
      'banned',
    ])
  })
})
