import { describe, expect, it } from 'vitest'

import {
  proxyProtocolOptions,
  scriptAccountUsageModeOptions,
  scriptPurposeOptions,
  scriptRegistrationAccountModeOptions,
} from './options'
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

describe('脚本账号使用方式', () => {
  it('新增和编辑均由脚本开发人员明确维护账号来源', () => {
    const createField = (resources.scripts.createFields || [])
      .find((field) => field.key === 'account_usage_mode')
    const updateField = (resources.scripts.updateFields || [])
      .find((field) => field.key === 'account_usage_mode')

    expect(scriptAccountUsageModeOptions.map((option) => option.value)).toEqual([
      'slot_current',
      'operator_selected',
      'runtime_created',
      'none',
    ])
    expect(createField?.defaultValue).toBe('slot_current')
    expect(createField?.required).toBe(true)
    expect(updateField?.required).toBe(true)
  })

  it('提交脚本时保留账号使用方式', () => {
    const body = resources.scripts.createBody?.({
      script_key: 'threads-login-check',
      name: '登录检测',
      account_usage_mode: 'slot_current',
      supported_runtime_platforms: 'fingerprint_browser',
    }) as Record<string, unknown>

    expect(body.account_usage_mode).toBe('slot_current')
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

  it('评论设备使用独立筛选缓存', () => {
    const fields = resources.interactionSessions.createFields || []
    const mainField = fields.find((field) => field.key === 'main_account_id')
    const commentField = fields.find((field) => field.key === 'comment_account_ids')

    expect(mainField?.accountTreePreferenceScope).toBeUndefined()
    expect(commentField?.accountTreePreferenceScope).toBe('selector:interaction-comment-devices')
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
    expect(slotField?.slotTreePublishStats).toBe(true)
    const accountField = fields.find((field) => field.key === 'account_ids')
    expect(accountField?.type).toBe('accountTree')
    expect(accountField?.accountTreePublishPool).toBe(true)
    expect(accountField?.visibleWhen).toEqual({ key: 'dispatch_mode', value: 'account_pool' })

    const body = resources.publishedContents.createBody?.({
      business_platform: 'threads',
      runtime_platform: 'fingerprint_browser',
      provider: 'morelogin',
      slot_ids: ['slot-1'],
      content_source_type: 'ungrouped',
    }) as Record<string, unknown>

    expect(body.slot_ids).toEqual(['slot-1'])
    expect(body.dispatch_mode).toBe('bound_account')
    expect(body).not.toHaveProperty('account_ids')
  })

  it('帐号池轮转按帐号创建任务并限定云手机 VMOS', () => {
    const modeField = fields.find((field) => field.key === 'dispatch_mode')
    const body = resources.publishedContents.createBody?.({
      dispatch_mode: 'account_pool',
      business_platform: 'threads',
      runtime_platform: 'cloud_phone',
      provider: 'vmos',
      slot_ids: ['slot-1', 'slot-2', 'slot-1'],
      account_ids: ['account-1', 'account-2', 'account-1'],
      content_source_type: 'ungrouped',
    }) as Record<string, unknown>

    expect(modeField?.options?.map((option) => option.value)).toEqual(['bound_account', 'account_pool'])
    expect(body.slot_ids).toEqual(['slot-1', 'slot-2'])
    expect(body.account_ids).toEqual(['account-1', 'account-2'])
    expect(() => resources.publishedContents.createBody?.({
      dispatch_mode: 'account_pool',
      runtime_platform: 'fingerprint_browser',
      provider: 'adspower',
      account_ids: ['account-1'],
      content_source_type: 'ungrouped',
    })).toThrow('帐号池轮转当前仅支持云手机 / VMOS')
  })

  it('列表按发布父任务展示总览并按需展开帖子明细', () => {
    expect(resources.publishedContents.endpoint).toBe('/api/interaction-center/published-contents')
    expect(resources.publishedContents.listEndpoint).toBe('/api/interaction-center/published-results')
    expect(resources.publishedContents.expandRow).toBe('publishedContentTask')
    expect(resources.publishedContents.columns.find((column) => column.key === 'title')?.type).toBe('publishedTaskIdentity')
    expect(resources.publishedContents.columns.map((column) => column.key)).toContain('child_finished')
    expect(resources.publishedContents.columns.map((column) => column.key)).toContain('published_count')
    expect(resources.publishedContents.columns.map((column) => column.key)).toContain('created_by')
    expect(resources.publishedContents.columns.map((column) => column.key)).not.toContain('content_url')
    expect(resources.publishedContents.rowActions).toBeUndefined()
    expect(resources.publishedContents.deleteLabel).toBeUndefined()
    expect(resources.publishedContents.updateFields).toEqual([])
  })

  it('互动会话列表可通过目标内容跳转帖子', () => {
    expect(resources.interactionSessions.columns.find((column) => column.key === 'target_content_title')).toMatchObject({
      label: '目标内容',
      type: 'interactionTargetContent',
    })
    expect(resources.interactionSessions.columns.some((column) => column.key === 'target_content_url')).toBe(false)
  })

  it('互动会话列表使用进度条展示完成情况', () => {
    expect(resources.interactionSessions.columns.find((column) => column.key === 'progress_text')).toMatchObject({
      label: '进度',
      type: 'interactionProgress',
      align: 'center',
    })
    expect(resources.interactionSessions.columns.some((column) => column.key === 'comment_account_count')).toBe(false)
  })

  it('互动会话列表支持按场景和文案来源筛选', () => {
    expect(resources.interactionSessions.filters?.find((field) => field.key === 'interaction_mode')?.options).toEqual([
      { label: '链接内容互动', value: 'conversation' },
      { label: '广场内容互动', value: 'square_numeric' },
    ])
    expect(resources.interactionSessions.filters?.find((field) => field.key === 'content_mode')?.options).toEqual([
      { label: 'AI 生成', value: 'ai' },
      { label: '自定义内容', value: 'custom' },
    ])
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

  it('发布后评论支持最多二十条且每条可独立选择多张图片', () => {
    const commentField = fields.find((field) => field.key === 'comments')
    const body = resources.publishedContents.createBody?.({
      content_source_type: 'content',
      business_platform: 'threads',
      comments: [
        {
          content: '  First comment.  ',
          media_asset_ids: ['asset-1', 'asset-1', 'asset-2'],
        },
        {
          content: null,
          media_asset_ids: ['asset-3'],
        },
      ],
    }) as Record<string, unknown>
    const params = typeof commentField?.remote?.params === 'function'
      ? commentField.remote.params({ business_platform: 'threads' })
      : commentField?.remote?.params

    expect(commentField?.type).toBe('publishedCommentList')
    expect(commentField?.maxItems).toBe(20)
    expect(commentField?.remote?.multiple).toBe(true)
    expect(params).toMatchObject({ status: 'enabled', asset_type: 'image', business_platform: 'threads' })
    expect(body.comments).toEqual([
      {
        content: 'First comment.',
        media_asset_ids: ['asset-1', 'asset-2'],
      },
      {
        content: null,
        media_asset_ids: ['asset-3'],
      },
    ])
    expect(body).not.toHaveProperty('comment_content')
    expect(body).not.toHaveProperty('comment_media_asset_ids')
  })

  it('指定内容使用带正文和图片预览的弹窗选择器', () => {
    const contentField = fields.find((field) => field.key === 'content_id')

    expect(contentField?.type).toBe('contentPreviewPicker')
    expect(contentField?.remote?.group?.endpoint).toBe('/api/content-center/content-groups')
    expect(contentField?.span).toBe(2)
  })

  it('发布后评论整体可选，但已添加的空评论不能提交', () => {
    const emptyBody = resources.publishedContents.createBody?.({
      content_source_type: 'content',
    }) as Record<string, unknown>

    expect(emptyBody.comments).toEqual([])
    expect(() => resources.publishedContents.createBody?.({
      content_source_type: 'content',
      comments: [{ content: '   ', media_asset_ids: [] }],
    })).toThrow('评论 1 至少填写文本或选择一张图片')
  })

  it('发布后评论不能超过二十条', () => {
    expect(() => resources.publishedContents.createBody?.({
      content_source_type: 'content',
      comments: Array.from({ length: 21 }, (_item, index) => ({
        content: `comment-${index + 1}`,
        media_asset_ids: [],
      })),
    })).toThrow('每个发布任务最多添加 20 条评论')
  })

  it('多条评论默认间隔为零到一分钟并校验范围', () => {
    const delayField = fields.find((field) => field.key === 'comment_delay_min_minutes')

    expect(delayField?.type).toBe('numberRange')
    expect(delayField?.defaultValue).toBe(0)
    expect(delayField?.endDefaultValue).toBe(1)
    expect(resources.publishedContents.createBody?.({
      content_source_type: 'content',
    })).toMatchObject({
      comment_delay_min_minutes: 0,
      comment_delay_max_minutes: 1,
    })
    expect(() => resources.publishedContents.createBody?.({
      content_source_type: 'content',
      comment_delay_min_minutes: 3,
      comment_delay_max_minutes: 1,
    })).toThrow('评论最短间隔不能大于最长间隔')
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
    expect(delayField?.endDefaultValue).toBe(8)
    expect(resources.publishedContents.createBody?.({
      content_source_type: 'content',
    })).toMatchObject({
      dispatch_delay_min_minutes: 1,
      dispatch_delay_max_minutes: 8,
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

describe('任务记录筛选', () => {
  const filters = resources.tasks.filters || []

  it('按任务、运行环境、操作员和创建时间提供独立筛选项', () => {
    expect(filters.map((field) => field.key)).toEqual([
      'task_id',
      'task_title',
      'status',
      'business_platform',
      'runtime_platform',
      'provider',
      'script_key',
      'template_id',
      'operator_keyword',
      'created_from',
    ])
    expect(filters.find((field) => field.key === 'created_from')).toMatchObject({
      type: 'datetimeRange',
      endKey: 'created_to',
    })
  })

  it('保留任务脚本列能力但默认隐藏', () => {
    const columns = resources.tasks.columns || []
    const scriptColumn = columns.find((column) => column.key === 'script_name')

    expect(scriptColumn).toMatchObject({
      label: '任务脚本',
      type: 'taskScript',
      minWidth: 160,
      hidden: true,
    })
    expect(columns.some((column) => column.key === 'template_name')).toBe(false)
    expect(columns.indexOf(scriptColumn!)).toBe(
      columns.findIndex((column) => column.key === 'title') + 1,
    )
  })

  it('任务 ID 合并到任务信息列', () => {
    const columns = resources.tasks.columns || []

    expect(columns.some((column) => column.key === 'id')).toBe(false)
    expect(columns[0]).toMatchObject({
      key: 'title',
      label: '任务信息',
      type: 'taskIdentity',
      minWidth: 190,
    })
  })

  it('收窄操作员列并为运行环境保留两行展示空间', () => {
    const columns = resources.tasks.columns || []

    expect(columns.find((column) => column.key === 'creator_display_name')).toMatchObject({
      type: 'taskOperator',
      width: 150,
    })
    expect(columns.find((column) => column.key === 'business_platform')).toMatchObject({
      type: 'taskPlatform',
      width: 190,
    })
  })
})

describe('注册脚本账号结果方式', () => {
  it('仅在账号注册脚本中展示，并默认保留账号设备绑定', () => {
    const createField = (resources.scripts.createFields || [])
      .find((field) => field.key === 'registration_account_mode')
    const updateField = (resources.scripts.updateFields || [])
      .find((field) => field.key === 'registration_account_mode')

    expect(scriptRegistrationAccountModeOptions.map((option) => option.value)).toEqual([
      'bind_slot',
      'account_only',
    ])
    expect(createField?.type).toBe('segmented')
    expect(createField?.defaultValue).toBe('bind_slot')
    expect(createField?.visibleWhen).toEqual({ key: 'purpose', value: 'account_registration' })
    expect(updateField?.visibleWhen).toEqual({ key: 'purpose', value: 'account_registration' })
  })

  it('注册脚本提交配置，其他脚本固定使用兼容模式', () => {
    const registrationBody = resources.scripts.createBody?.({
      script_key: 'shopify-register',
      name: 'Shopify 注册',
      purpose: 'account_registration',
      account_usage_mode: 'runtime_created',
      registration_account_mode: 'account_only',
      supported_runtime_platforms: 'fingerprint_browser',
    }) as Record<string, unknown>
    const generalBody = resources.scripts.createBody?.({
      script_key: 'general',
      name: '普通脚本',
      purpose: 'general_task',
      account_usage_mode: 'slot_current',
      registration_account_mode: 'account_only',
      supported_runtime_platforms: 'fingerprint_browser',
    }) as Record<string, unknown>

    expect(registrationBody.registration_account_mode).toBe('account_only')
    expect(generalBody.registration_account_mode).toBe('bind_slot')
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

  it('使用单个批量请求覆盖所选账号标签', () => {
    expect(action?.batchPath?.([], {})).toBe('/api/accounts/tags/batch')
    expect(action?.batchBody?.({ tag_ids: ['1', '2'] }, [{ id: '10' }, { id: '11' }])).toEqual({
      account_ids: ['10', '11'],
      tag_ids: ['1', '2'],
    })
    expect(action?.path).toBeUndefined()
  })
})

describe('账号列表未分配筛选', () => {
  const filters = resources.accounts.filters || []
  const groupFilter = filters.find((field) => field.key === 'slot_group_id')
  const tagFilter = filters.find((field) => field.key === 'tag_id')

  it('在现有设备分组和账号标签下拉中提供特殊选项', () => {
    expect(groupFilter?.remote?.fixedOptions).toContainEqual({
      id: '__ungrouped__',
      name: '未分组',
    })
    expect(tagFilter?.remote?.fixedOptions).toContainEqual({
      id: '__unassigned__',
      name: '未分配标签',
    })
  })

  it('把特殊选项转换为后端布尔筛选参数', () => {
    expect(resources.accounts.listParams?.({
      page: 1,
      slot_group_id: '__ungrouped__',
      tag_id: '__unassigned__',
    })).toEqual({
      page: 1,
      slot_group_ungrouped: true,
      tag_unassigned: true,
    })
  })
})

describe('账号登录状态管理', () => {
  const action = resources.accounts.batchActions?.find(
    (item) => item.key === 'batch-update-login-status',
  )

  it('编辑账号时提交登录状态', () => {
    expect(resources.accounts.updateFields?.find((field) => field.key === 'login_status')).toMatchObject({
      type: 'select',
      required: true,
    })
    expect(resources.accounts.updateBody?.({ login_status: 'banned' }, {})).toEqual({
      login_status: 'banned',
    })
  })

  it('把选中账号一次提交到批量状态接口', () => {
    expect(action?.batchPath?.([])).toBe('/api/accounts/login-status/batch')
    expect(action?.batchBody?.({ login_status: 'banned' }, [{ id: '11' }, { id: '12' }])).toEqual({
      account_ids: ['11', '12'],
      login_status: 'banned',
    })
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

describe('设备组同步失败提示', () => {
  it('设备与分组列表使用弹窗提醒，不再保留行内重新同步入口', () => {
    expect(resources.slots.runtimeSyncFailureAlerts).toBe(true)
    expect(resources.slotGroups.runtimeSyncFailureAlerts).toBe(true)
    expect(resources.slots.rowActions?.some((action) => action.key === 'retry-sync')).not.toBe(true)
    expect(resources.slotGroups.rowActions?.some((action) => action.key === 'retry-group-sync')).not.toBe(true)
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

describe('代理导入结果提示', () => {
  it('正常导入时展示新增数量', () => {
    expect(resources.proxies.createSuccessMessage?.({
      created_count: 2,
      skipped_count: 0,
    }, {})).toBe('成功导入 2 条代理')
    expect(resources.proxies.createNotificationType?.({
      created_count: 2,
      skipped_count: 0,
    }, {})).toBe('success')
  })

  it('部分重复时明确展示新增和跳过数量', () => {
    expect(resources.proxies.createSuccessMessage?.({
      created_count: 2,
      skipped_count: 1,
    }, {})).toBe('成功导入 2 条代理，另有 1 条重复代理已跳过')
    expect(resources.proxies.createNotificationType?.({
      created_count: 2,
      skipped_count: 1,
    }, {})).toBe('warning')
  })

  it('全部重复时明确提示没有新增记录', () => {
    expect(resources.proxies.createSuccessMessage?.({
      created_count: 0,
      skipped_count: 1,
    }, {})).toBe('未新增代理：1 条代理与现有记录重复，已全部跳过')
    expect(resources.proxies.createNotificationType?.({
      created_count: 0,
      skipped_count: 1,
    }, {})).toBe('warning')
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
  it('支持筛选有号和无号设备', () => {
    const field = resources.slots.filters?.find((filter) => filter.key === 'account_presence')

    expect(field?.label).toBe('账号情况')
    expect(field?.options).toEqual([
      { label: '有号设备', value: 'bound' },
      { label: '无号设备', value: 'unbound' },
    ])
  })
})

describe('账号导入', () => {
  it('支持整批选择账号类型且不预设默认值', () => {
    const fields = resources.accounts.createFields || []
    const countryIndex = fields.findIndex((field) => field.key === 'country')
    const accountTypeIndex = fields.findIndex((field) => field.key === 'account_age_type')
    const accountTypeField = fields[accountTypeIndex]

    expect(accountTypeIndex).toBe(countryIndex + 1)
    expect(accountTypeField?.label).toBe('账号类型')
    expect(accountTypeField?.defaultValue).toBeUndefined()
    expect(accountTypeField?.required).toBe(true)
    expect(accountTypeField?.placeholder).toBe('请选择账号类型')
    expect(accountTypeField?.options).toEqual([
      { label: '新号', value: 'new' },
      { label: '老号', value: 'old' },
      { label: '未知', value: 'unknown' },
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

describe('素材资源表格', () => {
  it('单独展示媒体预览，并保留运营需要的独立属性列', () => {
    expect(resources.mediaAssets.columns.map((column) => [column.key, column.type])).toEqual([
      ['name', 'mediaAssetIdentity'],
      ['source_url', 'mediaAssetPreview'],
      ['group_names', 'mediaAssetGroups'],
      ['business_platform', 'mediaAssetPlatform'],
      ['asset_type', 'mediaAssetType'],
      ['file_size', 'mediaAssetSpec'],
      ['status', 'status'],
      ['created_at', 'mediaAssetTimeline'],
    ])
  })
})

describe('任务记录删除约束', () => {
  it('只允许删除终态任务', () => {
    const deleteAllowed = resources.tasks.deleteAllowed
    expect(deleteAllowed).toBeTypeOf('function')

    for (const status of [
      'draft',
      'queued',
      'waiting_slot',
      'waiting_runtime',
      'dispatching',
      'running',
      'retry_wait',
      'rate_limited',
    ]) {
      expect(deleteAllowed?.({ status })).toBe(false)
    }
    for (const status of [
      'succeeded',
      'completed',
      'all_failed',
      'failed',
      'canceled',
      'expired',
      'lost',
    ]) {
      expect(deleteAllowed?.({ status })).toBe(true)
    }
  })
})
