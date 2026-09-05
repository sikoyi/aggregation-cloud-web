import { describe, expect, it } from 'vitest'

import { buildAccountIdentityResource } from '@/config/accountIdentityResource'
import { resources } from '@/config/resources'
import crudSource from '@/components/CrudPage.vue?raw'
import platformDetailsSource from '@/components/AccountIdentityPlatformDetails.vue?raw'
import dialogSource from '@/components/AccountIdentityCredentialsDialog.vue?raw'
import accountCenterSource from '@/views/AccountCenterView.vue?raw'

describe('account identity resource', () => {
  it('keeps account import and restores safe platform-account batch mutations', () => {
    const config = buildAccountIdentityResource(resources.accounts)

    expect(config.endpoint).toBe('/api/account-identities')
    expect(config.createEndpoint).toBe('/api/accounts/import')
    expect(config.createFields).toBe(resources.accounts.createFields)
    expect(config.expandRow).toBe('accountIdentity')
    expect(config.updateFields).toBeUndefined()
    expect(config.batchActions?.map((action) => action.key)).toEqual([
      'export-accounts',
      'batch-account-onboarding',
      'batch-update-account-age-type',
      'batch-update-login-status',
      'batch-set-tags',
      'batch-delete-accounts',
    ])
    expect(config.batchActions?.[0]?.batchBody?.({}, [{ id: 'identity-1' }])).toEqual({
      source: 'identities', ids: ['identity-1'],
    })
    const selectedIdentities = [
      {
        id: 'identity-1',
        platform_summaries: [
          { account_id: 'account-1', business_platform: 'threads' },
          { account_id: 'account-2', business_platform: 'instagram' },
        ],
      },
      {
        id: 'identity-2',
        platform_summaries: [
          { account_id: 'account-2', business_platform: 'instagram' },
          { account_id: 'account-3', business_platform: 'threads' },
        ],
      },
    ]
    expect(config.batchActions?.find((action) => action.key === 'batch-update-account-age-type')?.batchBody?.(
      { account_age_type: 'old' },
      selectedIdentities,
    )).toEqual({
      account_ids: ['account-1', 'account-2', 'account-3'],
      account_age_type: 'old',
    })
    expect(config.batchActions?.find((action) => action.key === 'batch-update-login-status')?.batchBody?.(
      { login_status: 'not_logged_in' },
      selectedIdentities,
    )).toEqual({
      account_ids: ['account-1', 'account-2', 'account-3'],
      login_status: 'not_logged_in',
    })
    expect(config.batchActions?.find((action) => action.key === 'batch-set-tags')?.batchBody?.(
      { tag_ids: ['tag-1'] },
      selectedIdentities,
    )).toEqual({
      account_ids: ['account-1', 'account-2', 'account-3'],
      tag_ids: ['tag-1'],
    })
    const deleteAction = config.batchActions?.find((action) => action.key === 'batch-delete-accounts')
    expect(deleteAction?.permission).toBe('accounts.delete')
    expect(deleteAction?.variant).toBe('danger')
    expect(deleteAction?.selectionLimit).toBe(100)
    expect(deleteAction?.batchPath?.([], {})).toBe('/api/accounts/delete/batch')
    expect(deleteAction?.batchBody?.({}, selectedIdentities)).toEqual({
      account_ids: ['account-1', 'account-2', 'account-3'],
    })
    const deleteConfirm = deleteAction?.confirm
    expect(typeof deleteConfirm).toBe('function')
    if (typeof deleteConfirm === 'function') {
      expect(deleteConfirm({ selectedRows: selectedIdentities })).toContain('3 个平台账号')
    }
    expect(crudSource).toContain("typeof action.confirm === 'function'")
    expect(config.deleteLabel).toBeUndefined()
  })

  it('maps batch onboarding to one explicitly selected business app', () => {
    const config = buildAccountIdentityResource(resources.accounts)
    const action = config.batchActions?.find((item) => item.key === 'batch-account-onboarding')
    const selectedIdentities = [
      {
        id: 'identity-1',
        platform_summaries: [
          { account_id: 'threads-1', business_platform: 'threads' },
          { account_id: 'instagram-1', business_platform: 'instagram' },
        ],
      },
      {
        id: 'identity-2',
        platform_summaries: [{ account_id: 'threads-2', business_platform: 'threads' }],
      },
    ]

    expect(action?.fields?.[0]).toMatchObject({
      key: 'business_platform',
      label: '目标业务 App',
      required: true,
    })
    expect(action?.batchBody?.({
      business_platform: 'threads',
      provider: 'morelogin',
      target_runtime_instance_id: 'runtime-1',
      environment_name_prefix: '重新上号',
      proxy_allocation_mode: 'none',
    }, selectedIdentities)).toEqual({
      account_ids: ['threads-1', 'threads-2'],
      business_platform: 'threads',
      provider: 'morelogin',
      target_runtime_instance_id: 'runtime-1',
      environment_name_prefix: '重新上号',
      proxy_allocation_mode: 'none',
      proxy_group_id: undefined,
      dynamic_proxy_id: undefined,
    })
    expect(() => action?.batchBody?.({ business_platform: 'instagram' }, selectedIdentities)).toThrow(
      '有 1 个没有 Instagram 平台账号',
    )
    expect(() => action?.batchBody?.({ business_platform: 'threads' }, [
      { ...selectedIdentities[0], credentials_exported_at: '2026-09-05T08:00:00Z' },
    ])).toThrow('有 1 个已导出')
  })

  it('restores the operational account filters without losing aggregate-only filters', () => {
    const config = buildAccountIdentityResource(resources.accounts)

    expect(config.filters?.map((item) => item.key)).toEqual([
      'account_id',
      'login_username',
      'slot_group_id',
      'tag_id',
      'bound_slot_name',
      'provider_slot_id',
      'business_platform',
      'country',
      'login_status',
      'export_status',
      'account_age_type',
      'warmup_status',
      'warmup_plan_id',
      'runtime_platform',
      'provider',
      'keyword',
      'platform_health_status',
      'bound_state',
      'candidate_status',
    ])
    expect(config.listParams?.({
      slot_group_id: '__ungrouped__',
      tag_id: '__unassigned__',
    })).toEqual({
      slot_group_ungrouped: true,
      tag_unassigned: true,
    })
  })

  it('opens the verified aggregate account list before feature status returns', () => {
    expect(accountCenterSource).toContain('const featureStatus = ref<MetaAccountFeatureStatus>({')
    expect(accountCenterSource).toContain('enabled: true')
    expect(accountCenterSource).toContain('状态探测失败不能让页面退回旧列表')
  })

  it('reuses credentials on the identity parent without changing the ordinary account list', () => {
    const ordinaryColumns = [...resources.accounts.columns]
    const config = buildAccountIdentityResource(resources.accounts)

    expect(config.columns.find((column) => column.key === 'password_secret_ref')).toMatchObject({
      label: '登录凭证', type: 'accountCredentials',
    })
    expect(resources.accounts.columns).toEqual(ordinaryColumns)
    expect(resources.accounts.rowActions?.some((action) => action.key === 'edit-credentials')).not.toBe(true)
    expect(crudSource).toContain(':shared-credentials="config.key === \'accountIdentities\'"')
    expect(platformDetailsSource).not.toMatch(/password_secret_ref|totp_secret_ref|accountCredentials/)
  })

  it('shows the visible platform tag union and keeps platform-specific tags in expanded rows', () => {
    const config = buildAccountIdentityResource(resources.accounts)

    expect(config.columns.find((column) => column.type === 'identityTags')).toMatchObject({
      key: 'identity_tag_names',
      label: '账号标签',
    })
    expect(crudSource).toContain("'loginIdentity', 'identityTags', 'identityPlatforms'")
    expect(platformDetailsSource).toContain('label="账号标签"')
    expect(platformDetailsSource).toContain('accountTags(row)')
  })

  it('shows platform account attributes, device group, and backup actions in expanded details', () => {
    expect(platformDetailsSource).toContain('label="平台 / 属性"')
    expect(platformDetailsSource).toContain("row.country || '国家未填写'")
    expect(platformDetailsSource).toContain("row.account_age_type || 'unknown'")
    expect(platformDetailsSource).toContain("row.bound_slot_group_name || '未分组'")
    expect(platformDetailsSource).toContain('label="备份数据"')
    expect(platformDetailsSource).toContain('row.account_package_download_url')
    expect(platformDetailsSource).toContain('aria-label="打开备份地址"')
    expect(platformDetailsSource).toContain('aria-label="复制备份地址"')
  })

  it('merges the identity ID into the login column and shows creation time', () => {
    const config = buildAccountIdentityResource(resources.accounts)

    expect(config.columns.some((column) => column.type === 'id')).toBe(false)
    expect(config.columns.find((column) => column.type === 'loginIdentity')).toMatchObject({
      key: 'login_username',
      label: '登录身份',
    })
    expect(config.columns.find((column) => column.type === 'identityPlatforms')).toMatchObject({
      label: '平台 / 账号状态',
    })
    expect(config.columns.find((column) => column.key === 'created_at')).toMatchObject({
      label: '创建时间',
      type: 'datetime',
    })
    expect(config.columns.some((column) => column.key === 'updated_at')).toBe(false)
  })

  it('restores platform-account deletion with an independent delete permission', () => {
    expect(platformDetailsSource).toContain("auth.can('accounts.edit') || auth.can('accounts.delete')")
    expect(platformDetailsSource).toContain("v-if=\"auth.can('accounts.delete')\"")
    expect(platformDetailsSource).toContain("await http.delete(`/api/accounts/${encodeURIComponent(String(row.id))}`)")
    expect(platformDetailsSource).toContain('设备会话、发布内容、评论、指标、监听记录、备份及其他关联数据会一并清理')
    expect(platformDetailsSource).toContain('aria-label="删除平台账号"')
    expect(platformDetailsSource).toContain("actionLoading === `delete:${row.id}`")
  })

  it('requires accounts.edit and an explicit per-identity capability for the edit action', () => {
    const config = buildAccountIdentityResource(resources.accounts)
    const action = config.rowActions?.find((item) => item.key === 'edit-credentials')

    expect(action?.label).toBe('编辑登录凭据')
    expect(action?.permission).toBe('accounts.edit')
    expect(config.inlineActionKeys).toContain(action?.key)
    expect(action?.visible?.({ can_edit_credentials: true })).toBe(true)
    for (const value of [false, undefined, null, 'true', 1]) {
      expect(action?.visible?.({ can_edit_credentials: value })).toBe(false)
    }
    expect(crudSource).toContain("!auth.can('accounts.edit') || record.can_edit_credentials !== true")
  })

  it('mounts the editor only on demand and refreshes the list after saving', () => {
    expect(crudSource).toContain('v-if="config.key === \'accountIdentities\' && identityCredentialsId"')
    expect(crudSource).toContain(':identity-id="identityCredentialsId"\n      @close="identityCredentialsId = null"\n      @changed="loadRows()"')
    expect(dialogSource).toContain('共享凭据变更将作用于同一身份关联的所有平台账号')
    expect(dialogSource).toContain('v-model="form.clear_password"')
    expect(dialogSource).toContain('v-model="form.clear_totp"')
    expect(dialogSource).toContain(':disabled="!canSave"')
    expect(dialogSource).toContain('重新加载')
    expect(dialogSource).not.toContain('twofa_type')
  })

  it('输入框不能绕过表单禁用状态，提交中不能关闭弹窗', () => {
    expect(dialogSource).toContain('!canEdit.value || loading.value || submitting.value || conflict.value')
    expect(dialogSource).toContain(':disabled="formDisabled || form.clear_password"')
    expect(dialogSource).toContain(':disabled="formDisabled || form.clear_totp"')
    expect(dialogSource).toContain("if (!submitting.value) emit('close')")
    expect(dialogSource).toContain(':close-on-press-escape="!submitting"')
    expect(dialogSource).toContain(':show-close="!submitting"')
  })
})
