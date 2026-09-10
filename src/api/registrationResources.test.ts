import { beforeEach, describe, expect, it, vi } from 'vitest'

import { http } from '@/api/http'
import { getRegistrationResourceTemplate, updateRegistrationResourceTemplate } from './registrationResources'
import editor from '@/components/RegistrationResourceTemplateEditDialog.vue?raw'
import view from '@/views/RegistrationResourcesView.vue?raw'

vi.mock('@/api/http', () => ({ http: { get: vi.fn(), put: vi.fn() } }))

beforeEach(() => vi.clearAllMocks())

describe('注册资源模板编辑', () => {
  it('打开编辑时读取最新模板，ID 按路径编码', async () => {
    vi.mocked(http.get).mockResolvedValue({ id: 'template/1' })
    await getRegistrationResourceTemplate('template/1')
    expect(http.get).toHaveBeenCalledWith('/api/resource-center/registration-resources/templates/template%2F1')
  })

  it('必填改为 false 时保留布尔值，只提交字段必填规则', async () => {
    const payload = { field_requirements: [{ field_key: 'name', required: false }] }
    const updated = { id: '1', fields: [{ field_key: 'name', required: false }] }
    vi.mocked(http.put).mockResolvedValue(updated)
    expect(await updateRegistrationResourceTemplate('1', payload)).toEqual(updated)
    expect(http.put).toHaveBeenCalledWith('/api/resource-center/registration-resources/templates/1', payload)
  })

  it('原有启停接口保持兼容，保存失败交给弹窗处理', async () => {
    vi.mocked(http.put).mockRejectedValue(new Error('保存失败'))
    await expect(updateRegistrationResourceTemplate('1', { status: 'disabled' })).rejects.toThrow('保存失败')
    expect(http.put).toHaveBeenCalledWith('/api/resource-center/registration-resources/templates/1', { status: 'disabled' })
  })

  it('已有字段只读，编辑入口和弹窗均受模板管理权限控制', () => {
    expect(editor).toContain('<el-checkbox v-model="row.required"')
    expect(editor).not.toMatch(/v-model="(?:row|field)\.(?:field_key|display_name|data_type|sensitive|sort_order|example|description)"/)
    expect(editor).not.toContain('<el-input')
    expect(editor).toContain("auth.can('registration_resources.manage_templates')")
    expect(view).toContain('v-if="canManageTemplates" content="编辑模板"')
    expect(view).toContain('v-if="editingTemplateId && canManageTemplates"')
  })
})
