import { describe, expect, it } from 'vitest'

import { proxyProtocolOptions, scriptPurposeOptions } from './options'
import { resources } from './resources'


describe('脚本执行平台约束', () => {
  const createFields = resources.scripts.createFields || []
  const updateFields = resources.scripts.updateFields || []
  const createRuntimeField = createFields.find((field) => field.key === 'supported_runtime_platforms')
  const updateRuntimeField = updateFields.find((field) => field.key === 'supported_runtime_platforms')

  it('新建和编辑脚本均只允许选择一个执行平台', () => {
    expect(createRuntimeField?.multiple).not.toBe(true)
    expect(updateRuntimeField?.multiple).not.toBe(true)
    expect(createRuntimeField?.required).toBe(true)
    expect(updateRuntimeField?.required).toBe(true)
  })

  it('提交时保持后端单元素数组结构', () => {
    const body = resources.scripts.createBody?.({
      script_key: 'cloud-phone-script',
      name: '云手机脚本',
      supported_runtime_platforms: 'cloud_phone',
    }) as Record<string, unknown>

    expect(body.supported_runtime_platforms).toEqual(['cloud_phone'])
  })

  it('脚本下拉展示中文执行平台而不是脚本 Key', () => {
    const templateScriptField = (resources.taskTemplates.createFields || [])
      .find((field) => field.key === 'script_key')
    const formatter = templateScriptField?.remote?.secondaryFormatter

    expect(formatter?.({
      script_key: 'threads-cloud-phone',
      supported_runtime_platforms: ['cloud_phone'],
    })).toBe('云手机')
  })
})

describe('任务模板选择展示', () => {
  it('下发和筛选模板时展示中文执行平台', () => {
    const createTemplateField = (resources.tasks.createFields || [])
      .find((field) => field.key === 'template_id')
    const filterTemplateField = (resources.tasks.filters || [])
      .find((field) => field.key === 'template_id')

    expect(createTemplateField?.remote).not.toBe(filterTemplateField?.remote)
    expect(filterTemplateField?.remote?.loadWhen).toBeUndefined()
    expect(createTemplateField?.remote?.secondaryFormatter?.({
      id: '12',
      name: '云手机注册模板',
      script_key: 'threads-register',
      runtime_platform: 'cloud_phone',
    })).toBe('云手机')
  })

  it('下发前必须先选择执行平台并据此筛选模板', () => {
    const fields = resources.tasks.createFields || []
    const platformIndex = fields.findIndex((field) => field.key === 'runtime_platform')
    const templateIndex = fields.findIndex((field) => field.key === 'template_id')
    const platformField = fields[platformIndex]
    const templateField = fields[templateIndex]
    const remote = templateField?.remote
    const params = typeof remote?.params === 'function'
      ? remote.params({ runtime_platform: 'cloud_phone' })
      : remote?.params

    expect(platformIndex).toBeGreaterThanOrEqual(0)
    expect(platformIndex).toBeLessThan(templateIndex)
    expect(platformField?.required).toBe(true)
    expect(platformField?.readonly).not.toBe(true)
    expect(templateField?.disabledWhen).toEqual({ key: 'runtime_platform', value: '' })
    expect(remote?.loadWhen?.({})).toBe(false)
    expect(remote?.loadWhen?.({ runtime_platform: 'cloud_phone' })).toBe(true)
    expect(params).toEqual({ status: 'enabled', runtime_platform: 'cloud_phone' })
    expect(remote?.matchesContext?.({ runtime_platform: 'cloud_phone' }, { runtime_platform: 'cloud_phone' })).toBe(true)
    expect(remote?.matchesContext?.({ runtime_platform: 'fingerprint_browser' }, { runtime_platform: 'cloud_phone' })).toBe(false)
  })
})


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
    expect(customField?.visibleWhenAll).toEqual([
      { key: 'interaction_mode', value: 'conversation' },
      { key: 'content_mode', value: 'custom' },
    ])
    expect(aiField?.visibleWhenAll).toEqual([
      { key: 'interaction_mode', value: 'conversation' },
      { key: 'content_mode', value: 'ai' },
    ])
  })
})

describe('广场数字互动', () => {
  const fields = resources.interactionSessions.createFields || []

  it('只展示正常监听目标账号并使用独立脚本场景', () => {
    const modeField = fields.find((field) => field.key === 'interaction_mode')
    const targetField = fields.find((field) => field.key === 'square_target_account_ids')
    const stepField = fields.find((field) => field.key === 'step_count')
    const browseField = fields.find((field) => field.key === 'browse_duration_minutes')

    expect(modeField?.options?.map((option) => option.value)).toEqual([
      'conversation',
      'square_numeric',
    ])
    expect(modeField?.options?.map((option) => option.label)).toEqual([
      '链接内容互动',
      '广场内容互动',
    ])
    expect(targetField?.visibleWhen).toEqual({
      key: 'interaction_mode',
      value: 'square_numeric',
    })
    expect(targetField?.type).toBe('accountTree')
    expect(targetField?.multiple).toBe(true)
    expect(targetField?.accountTreeGroupByDevice).toBe(true)
    expect(targetField?.accountTreeMonitoringOnly).toBe(true)
    expect(stepField?.visibleWhen).toEqual({
      key: 'interaction_mode',
      value: 'conversation',
    })
    expect(browseField?.defaultValue).toBe(10)
    expect(browseField?.visibleWhen).toEqual({
      key: 'interaction_mode',
      value: 'square_numeric',
    })
  })

  it('提交时固定为单步数字互动并清理普通会话字段', () => {
    const body = resources.interactionSessions.createBody?.({
      title: 'Square numeric interaction',
      interaction_mode: 'square_numeric',
      business_platform: 'threads',
      square_target_account_ids: ['10', '11'],
      comment_account_ids: ['22'],
      step_count: 8,
      content_mode: 'custom',
      custom_contents_text: 'stale content',
      target_source_type: 'system_content',
      target_content_id: 'old-content',
      step_delay_min_minutes: 0,
      step_delay_max_minutes: 1,
      browse_duration_minutes: 400,
      follow_probability: 60,
      ai_provider: 'openai',
    }) as Record<string, unknown>

    expect(body.main_account_id).toBeNull()
    expect(body.target_account_ids).toEqual(['10', '11'])
    expect(body.step_count).toBe(1)
    expect(body.content_mode).toBe('ai')
    expect(body.custom_contents).toEqual([])
    expect(body.target_content_id).toBeNull()
    expect(body.target_content_url).toBeNull()
    expect(body.browse_duration_minutes).toBe(400)
    expect(body.follow_probability).toBe(60)
    expect(body).not.toHaveProperty('ai_config')
    expect(body).not.toHaveProperty('square_target_account_ids')
  })
})
describe('代理协议选项', () => {
  it('分别提供 Socks5、HTTP 和 HTTPS', () => {
    expect(proxyProtocolOptions.map((option) => option.value)).toEqual(['socks5', 'http', 'https'])
  })
})

describe('发布内容来源', () => {
  const fields = resources.publishedContents.createFields || []

  it('按设备下发且固定只展示已绑定账号的设备', () => {
    const slotField = fields.find((field) => field.key === 'slot_ids')

    expect(slotField?.type).toBe('slotTree')
    expect(slotField?.slotTreeAccountPresence).toBe('bound')
    expect(slotField?.slotTreeAccountPresenceFilter).not.toBe(true)
    expect(slotField?.slotTreeProviderFilter).toBe(true)
    expect(slotField?.slotTreeFillHeight).toBe(true)
    expect(fields.some((field) => field.key === 'account_ids')).toBe(false)

    const body = resources.publishedContents.createBody?.({
      business_platform: 'threads',
      runtime_platform: 'fingerprint_browser',
      provider: 'morelogin',
      slot_ids: ['slot-1'],
      content_source_type: 'ungrouped',
    }) as Record<string, unknown>

    expect(body.slot_ids).toEqual(['slot-1'])
    expect(body).not.toHaveProperty('account_ids')
  })

  it('为发布配置展示准确的必填标记', () => {
    for (const key of ['business_platform', 'runtime_platform', 'provider', 'content_source_type']) {
      expect(fields.find((field) => field.key === key)?.required).toBe(true)
    }

    expect(fields.find((field) => field.key === 'content_group_id')?.requiredWhen).toEqual({
      key: 'content_source_type',
      value: 'content_group',
    })
    expect(fields.find((field) => field.key === 'content_id')?.requiredWhen).toEqual({
      key: 'content_source_type',
      value: 'content',
    })
    expect(fields.find((field) => field.key === 'content_status')?.required).not.toBe(true)
  })
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
      slot_ids: ['slot-1', 'slot-2'],
      content_source_type: 'ungrouped',
      content_status: 'all',
      content_id: '12',
      content_group_id: '8',
    }) as Record<string, unknown>

    expect(body.content_status).toBeNull()
    expect(body.content_id).toBeNull()
    expect(body.content_group_id).toBeNull()
  })

  it('评论图片支持多选并按原顺序提交素材 ID', () => {
    const imageField = fields.find((field) => field.key === 'comment_media_asset_ids')
    const body = resources.publishedContents.createBody?.({
      content_source_type: 'content',
      business_platform: 'threads',
      comment_content: '',
      comment_media_asset_ids: ['asset-1', 'asset-2'],
    }) as Record<string, unknown>
    const params = typeof imageField?.remote?.params === 'function'
      ? imageField.remote.params({ business_platform: 'threads' })
      : imageField?.remote?.params

    expect(imageField?.type).toBe('mediaPreviewPicker')
    expect(imageField?.remote?.multiple).toBe(true)
    expect(params).toMatchObject({ status: 'enabled', asset_type: 'image', business_platform: 'threads' })
    expect(body.comment_content).toBeNull()
    expect(body.comment_media_asset_ids).toEqual(['asset-1', 'asset-2'])
  })

  it('指定内容使用带正文和图片预览的弹窗选择器', () => {
    const contentField = fields.find((field) => field.key === 'content_id')

    expect(contentField?.type).toBe('contentPreviewPicker')
    expect(contentField?.remote?.group?.endpoint).toBe('/api/content-center/content-groups')
    expect(contentField?.span).toBe(2)
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

  it('每个发布任务支持独立随机延迟范围', () => {
    const delayField = fields.find((field) => field.key === 'dispatch_delay_min_minutes')
    const body = resources.publishedContents.createBody?.({
      content_source_type: 'content',
      dispatch_delay_min_minutes: 2,
      dispatch_delay_max_minutes: 5,
    }) as Record<string, unknown>

    expect(delayField?.type).toBe('numberRange')
    expect(delayField?.defaultValue).toBe(1)
    expect(delayField?.endDefaultValue).toBe(2)
    expect(resources.publishedContents.createBody?.({
      content_source_type: 'content',
    })).toMatchObject({
      dispatch_delay_min_minutes: 1,
      dispatch_delay_max_minutes: 2,
    })
    expect(body.dispatch_delay_min_minutes).toBe(2)
    expect(body.dispatch_delay_max_minutes).toBe(5)
    expect(() => resources.publishedContents.createBody?.({
      content_source_type: 'content',
      dispatch_delay_min_minutes: 5,
      dispatch_delay_max_minutes: 2,
    })).toThrow('最短延迟不能大于最长延迟')
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

describe('设备批量分组', () => {
  const action = resources.slots.batchActions?.find((item) => item.key === 'batch-set-group')

  it('把选中设备一次提交到目标设备组', () => {
    expect(action?.batchPath?.([], { group_id: 'group-8' })).toBe('/api/slot-groups/group-8/slots/batch')
    expect(action?.batchBody?.({}, [{ id: 'slot-1' }, { id: 'slot-2' }])).toEqual({
      slot_ids: ['slot-1', 'slot-2'],
    })
  })
})

describe('设备批量删除', () => {
  const action = resources.slots.batchActions?.find((item) => item.key === '__delete')

  it('把选中设备合并成一次批量请求', () => {
    expect(action?.method).toBe('POST')
    expect(action?.batchPath?.([])).toBe('/api/execution-slots/batch-delete')
    expect(action?.batchBody?.({}, [{ id: 'slot-1' }, { id: 'slot-2' }])).toEqual({
      slot_ids: ['slot-1', 'slot-2'],
    })
  })
})

describe('设备管理筛选', () => {
  it('设备本身不维护业务 App，但支持按绑定账号的业务 App 和国家筛选', () => {
    expect(resources.slots.filters?.some((field) => field.key === 'business_platform')).toBe(true)
    expect(resources.slots.filters?.some((field) => field.key === 'country')).toBe(true)
    expect(resources.slots.createFields?.some((field) => field.key === 'business_platform')).toBe(false)
    expect(resources.slots.updateFields?.some((field) => field.key === 'business_platform')).toBe(false)
  })
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
describe('任务模板脚本范围联动', () => {
  const fields = resources.taskTemplates.createFields || []
  const scriptField = fields.find((field) => field.key === 'script_key')

  it('选择脚本前不使用系统默认平台和供应商过滤 VMOS 脚本', () => {
    const params = typeof scriptField?.remote?.params === 'function'
      ? scriptField.remote.params({
        business_platform: 'threads',
        runtime_platform: 'fingerprint_browser',
        provider: 'morelogin',
      })
      : scriptField?.remote?.params
    const matches = scriptField?.remote?.matchesContext?.({
      status: 'enabled',
      purpose: 'general_task',
      supported_business_platforms: ['threads'],
      supported_runtime_platforms: ['cloud_phone'],
      supported_providers: ['vmos'],
    }, {
      business_platform: 'threads',
      runtime_platform: 'fingerprint_browser',
      provider: 'morelogin',
    })

    expect(params).toEqual({ status: 'enabled', template_eligible: true })
    expect(matches).toBe(true)
  })

  it('选中脚本后执行平台和供应商仍由脚本支持范围约束', () => {
    const runtimeField = fields.find((field) => field.key === 'runtime_platform')
    const providerField = fields.find((field) => field.key === 'provider')

    expect(runtimeField?.scriptScopeKey).toBe('supported_runtime_platforms')
    expect(providerField?.scriptScopeKey).toBe('supported_providers')
  })
})

describe('任务下发执行模式', () => {
  const dispatchFields = resources.tasks.createFields || []

  it('允许单次下发覆盖模板执行模式', () => {
    const modeField = dispatchFields.find((field) => field.key === 'execution_mode')

    expect(modeField?.readonly).not.toBe(true)
    expect(modeField?.required).toBe(true)
  })

  it('计划模式要求计划时间，立即模式禁用计划时间', () => {
    const scheduledField = dispatchFields.find((field) => field.key === 'scheduled_at')

    expect(scheduledField?.requiredWhen).toEqual({ key: 'execution_mode', value: 'scheduled' })
    expect(scheduledField?.disabledWhen).toEqual({ key: 'execution_mode', value: 'immediate' })
  })

  it('模板不再包含允许执行时段，并提交本次执行模式', () => {
    expect((resources.taskTemplates.createFields || []).some((field) => field.key === 'execution_window')).toBe(false)
    expect((resources.taskTemplates.updateFields || []).some((field) => field.key === 'execution_window')).toBe(false)

    const body = resources.tasks.createBody?.({
      template_id: '1',
      slot_ids: ['2'],
      execution_mode: 'scheduled',
      scheduled_at: '2026-08-06T12:00:00Z',
    }) as Record<string, unknown>

    expect(body.execution_mode).toBe('scheduled')
    expect(body.scheduled_at).toBe('2026-08-06T12:00:00Z')
  })
})
