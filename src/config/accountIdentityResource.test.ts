import { describe, expect, it } from 'vitest'

import { buildAccountIdentityResource } from '@/config/accountIdentityResource'
import { resources } from '@/config/resources'
import crudSource from '@/components/CrudPage.vue?raw'
import platformDetailsSource from '@/components/AccountIdentityPlatformDetails.vue?raw'
import dialogSource from '@/components/AccountIdentityCredentialsDialog.vue?raw'

describe('account identity resource', () => {
  it('keeps account import but removes platform-account batch mutations', () => {
    const config = buildAccountIdentityResource(resources.accounts)

    expect(config.endpoint).toBe('/api/account-identities')
    expect(config.createEndpoint).toBe('/api/accounts/import')
    expect(config.createFields).toBe(resources.accounts.createFields)
    expect(config.expandRow).toBe('accountIdentity')
    expect(config.updateFields).toBeUndefined()
    expect(config.batchActions?.map((action) => action.key)).toEqual(['export-accounts'])
    expect(config.batchActions?.[0]?.batchBody?.({}, [{ id: 'identity-1' }])).toEqual({
      source: 'identities', ids: ['identity-1'],
    })
    expect(config.deleteLabel).toBeUndefined()
  })

  it('provides platform-specific health, login, binding, group, and candidate filters', () => {
    const config = buildAccountIdentityResource(resources.accounts)

    expect(config.filters?.map((item) => item.key)).toEqual([
      'keyword',
      'business_platform',
      'platform_health_status',
      'session_login_status',
      'bound_state',
      'slot_group_id',
      'candidate_status',
      'export_status',
    ])
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
