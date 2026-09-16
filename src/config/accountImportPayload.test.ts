import { describe, expect, it } from 'vitest'
import { buildAccountIdentityResource } from './accountIdentityResource'
import { resources } from './resources'
import { buildFormState, buildPayload } from '@/utils/form'

describe.each([resources.accounts, buildAccountIdentityResource(resources.accounts)])('$key 导入请求', config => {
  const fields = config.createFields || []
  it('上号 Runtime 候选和详情均按业务分工过滤', () => {
    const remote = fields.find(field => field.key === 'target_runtime_instance_id')?.remote
    expect(typeof remote?.params).toBe('function')
    if (typeof remote?.params === 'function') {
      expect(remote.params({ provider: 'morelogin' })).toMatchObject({
        task_purpose: 'account_onboarding', status: 'online', lifecycle_status: 'active', provider: 'morelogin',
      })
    }
    expect(remote?.detailPath?.('runtime-1')).toContain('task_purpose=account_onboarding')
    const batch = config.batchActions?.find(action => action.key === 'batch-account-onboarding')
    expect(batch?.fields?.find(field => field.key === 'target_runtime_instance_id')?.remote).toBe(remote)
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
})
