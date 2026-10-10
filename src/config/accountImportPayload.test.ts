import { describe, expect, it } from 'vitest'
import { buildAccountIdentityResource } from './accountIdentityResource'
import { resources } from './resources'
import { buildFormState, buildPayload } from '@/utils/form'

describe.each([resources.accounts, buildAccountIdentityResource(resources.accounts)])('$key 导入请求', config => {
  const fields = config.createFields || []
  it('导入保留唯一主切换，上号与代理采用分区下拉且默认值不变', () => {
    expect(fields.find(field => field.key === 'post_import_action')).toMatchObject({ type: 'segmented', defaultValue: 'import_only' })
    expect(fields.find(field => field.key === 'runtime_platform')).toMatchObject({ type: 'select', sectionTitle: '上号设置', defaultValue: 'fingerprint_browser' })
    expect(fields.find(field => field.key === 'proxy_allocation_mode')).toMatchObject({ type: 'select', sectionTitle: '代理设置', defaultValue: 'none' })
    expect(fields.find(field => field.key === 'raw_text')).toMatchObject({ type: 'textImport', sectionTitle: '账号内容' })
    const batchFields = config.batchActions?.find(action => action.key === 'batch-account-onboarding')?.fields || []
    expect(batchFields.find(field => field.key === 'runtime_platform')?.type).toBe('select')
    expect(batchFields.find(field => field.key === 'proxy_allocation_mode')?.type).toBe('select')
  })
  it('上号 Runtime 候选和详情均按业务分工过滤', () => {
    const runtimeField = fields.find(field => field.key === 'target_runtime_instance_id')
    const remote = runtimeField?.remote
    expect(runtimeField?.visibleWhenAll || [runtimeField?.visibleWhen]).toContainEqual({
      key: 'runtime_platform', value: 'fingerprint_browser',
    })
    expect(typeof remote?.params).toBe('function')
    if (typeof remote?.params === 'function') {
      expect(remote.params({ provider: 'morelogin' })).toMatchObject({
        task_purpose: 'account_onboarding', status: 'online', lifecycle_status: 'active', provider: 'morelogin',
      })
    }
    expect(remote?.detailPath?.('runtime-1')).toContain('task_purpose=account_onboarding')
    const batch = config.batchActions?.find(action => action.key === 'batch-account-onboarding')
    const batchRuntimeField = batch?.fields?.find(field => field.key === 'target_runtime_instance_id')
    const batchRemote = batchRuntimeField?.remote
    expect(batchRuntimeField?.visibleWhen).toEqual({ key: 'runtime_platform', value: 'fingerprint_browser' })
    expect(batchRemote?.endpoint).toBe(remote?.endpoint)
    expect(batchRemote?.detailPath?.('runtime-1')).toBe(remote?.detailPath?.('runtime-1'))
  })
  for (const action of ['import_only', 'create_environment_and_login']) {
    it.each(['new', 'old', 'unknown'])(`${action} 保留主动选择的类型 %s`, type => {
      const state = { ...buildFormState(fields), account_age_type: type, country: '韩国',
        business_platform: 'threads', raw_text: 'demo@example.test---test-password---TEST2FA',
        post_import_action: action, provider: 'morelogin', target_runtime_instance_id: 'runtime-test',
        environment_name_prefix: 'import-test', proxy_allocation_mode: 'none' }
      const body = config.createBody!(buildPayload(fields, state, 'create'))
      expect(body).toMatchObject({ account_age_type: type, country: '韩国',
        business_platform: 'threads', raw_text: state.raw_text, post_import_action: action })
      if (action === 'import_only') {
        expect(body).not.toHaveProperty('provider')
        expect(body).not.toHaveProperty('target_runtime_instance_id')
      } else {
        expect(body).toMatchObject({ provider: 'morelogin', target_runtime_instance_id: 'runtime-test',
          environment_name_prefix: 'import-test', proxy_allocation_mode: 'none' })
      }
    })
  }
  it('不为未选择的账号类型补默认值', () => {
    const state = buildFormState(fields)
    expect(state.account_age_type).toBe('')
    expect(fields.find(field => field.key === 'account_age_type')?.required).toBe(true)
    const body = config.createBody!(buildPayload(fields, state, 'create'))
    expect(body).toHaveProperty('account_age_type', '')
  })
  it('云手机导入只提交已有设备分组，不提交指纹环境参数', () => {
    const state = {
      ...buildFormState(fields), business_platform: 'threads', country: '韩国',
      account_age_type: 'new', raw_text: 'one---password---2fa',
      post_import_action: 'create_environment_and_login', runtime_platform: 'cloud_phone',
      provider: 'morelogin', target_runtime_instance_id: 'runtime-cloud',
      slot_group_id: 'group-cloud', environment_name_prefix: 'old-prefix',
      proxy_allocation_mode: 'static_group', proxy_group_id: 'old-proxy',
    }
    const body = config.createBody!(buildPayload(fields, state, 'create'))
    expect(body).toMatchObject({
      runtime_platform: 'cloud_phone', provider: 'vmos',
      slot_group_id: 'group-cloud',
      proxy_allocation_mode: 'static_group', proxy_group_id: 'old-proxy',
    })
    expect(body).not.toHaveProperty('target_runtime_instance_id')
    expect(body).not.toHaveProperty('environment_name_prefix')
    expect(body).not.toHaveProperty('dynamic_proxy_id')
  })
  it.each(['none', 'static_group', 'dynamic_template'])('云手机上号传递代理方式 %s', mode => {
    const action = config.batchActions!.find(item => item.key === 'batch-account-onboarding')!
    const state = { ...buildFormState(action.fields || []), runtime_platform: 'cloud_phone',
      business_platform: 'threads', slot_group_id: 'group-cloud', proxy_allocation_mode: mode,
      proxy_group_id: 'proxy-group', dynamic_proxy_id: 'dynamic-proxy' }
    const records = config.key === 'accountIdentities'
      ? [{ id: 'identity-1', matched_account_ids: ['account-1'],
          platform_summaries: [{ account_id: 'account-1', business_platform: 'threads' }] }]
      : [{ id: 'account-1', business_platform: 'threads' }]
    const body = action.batchBody!(buildPayload(action.fields || [], state, 'create'), records)
    expect(body).toMatchObject({ proxy_allocation_mode: mode,
      proxy_group_id: mode === 'static_group' ? 'proxy-group' : undefined,
      dynamic_proxy_id: mode === 'dynamic_template' ? 'dynamic-proxy' : undefined })
    for (const key of ['proxy_allocation_mode', 'proxy_group_id', 'dynamic_proxy_id']) {
      const field = action.fields!.find(item => item.key === key)!
      expect(field.visibleWhenAll || []).not.toContainEqual({ key: 'runtime_platform', value: 'fingerprint_browser' })
    }
  })
  it('批量上号按账号顺序传递可选设备，凭据不进入任务参数', () => {
    const action = config.batchActions!.find(item => item.key === 'batch-account-onboarding')!
    const records = ['account-1', 'account-2'].map(id => config.key === 'accountIdentities'
      ? { id: `identity-${id}`, matched_account_ids: [id],
          platform_summaries: [{ account_id: id, business_platform: 'threads' }] }
      : { id, business_platform: 'threads' })
    const body = action.batchBody!(
      { runtime_platform: 'cloud_phone', business_platform: 'threads', target_runtime_instance_id: 'runtime-cloud',
        slot_group_id: 'group-cloud', slot_ids: ['slot-1', 'slot-2'] },
      records,
    )
    expect(body).toMatchObject({
      account_ids: ['account-1', 'account-2'], slot_ids: ['slot-1', 'slot-2'],
      provider: 'vmos', runtime_platform: 'cloud_phone',
    })
    expect(body).not.toHaveProperty('target_runtime_instance_id')
    expect(JSON.stringify(body)).not.toContain('password')
  })
})
