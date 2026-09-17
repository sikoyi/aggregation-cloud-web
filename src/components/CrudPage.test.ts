import { describe, expect, it } from 'vitest'

import source from './CrudPage.vue?raw'

const toolbar = source.split('class="batch-toolbar"')[1]?.split('<el-card shadow="never" class="table-card">')[0] || ''

describe('资源列表批量操作栏', () => {
  it('账号、设备、代理、内容和素材常驻，其他资源仍按选中状态显示，并保留权限过滤', () => {
    expect(source).toContain("computed(() => ['accounts', 'accountIdentities'].includes(props.config.key))")
    expect(source).toContain("computed(() => isAccountResource.value || ['slots', 'proxies', 'contents', 'mediaAssets'].includes(props.config.key))")
    expect(source).toContain('v-if="batchActions.length && (persistentBatchToolbar || hasSelectedRows)"')
    expect(source).toContain('.filter((action) => canRunAction(action))')
  })

  it('空选或提交时禁用操作，保留聚合账号的影响范围', () => {
    expect(toolbar).toContain(':disabled="!selectedRows.length || submitting"')
    expect(toolbar).toContain(':loading="submitting"')
    expect(toolbar).toContain('@click="runBatchAction(action)"')
    expect(toolbar).toContain('{{ selectedIdentityScope }}')
    expect(source).toContain('identitySelectionLabel(selectedRows.value)')
  })

  it('常驻工具栏使用常规按钮且不显示取消选择入口', () => {
    expect(toolbar).toContain(':size="persistentBatchToolbar ? \'default\' : \'small\'"')
    expect(toolbar).toContain('<el-button v-if="!persistentBatchToolbar" size="small" text')
    expect(source).toContain('<el-table-column v-if="batchActions.length" type="selection"')
  })

  it('对齐账号数据的高度、间距和主题，并与表格衔接', () => {
    const styles = source.split('.batch-toolbar--persistent {')[1]?.split('.resource-table')[0] || ''
    expect(styles).toContain('min-height: 52px;')
    expect(styles).toContain('padding: 8px 14px;')
    expect(styles).toContain('background: var(--app-surface-muted, #f7fafc);')
    expect(styles).toContain('box-shadow: none;')
    expect(styles).toContain('.batch-toolbar--persistent + .table-card')
    expect(styles).toContain('margin-top: 0;')
    expect(styles).toContain('flex-basis: 100%;')
  })

  it('选择数量使用对应资源的单位', () => {
    expect(toolbar).toContain('{{ selectedCountUnit }}')
    expect(source).toContain("if (isAccountResource.value) return '个账号'")
    expect(source).toContain("if (props.config.key === 'slots') return '台设备'")
    expect(source).toContain("if (props.config.key === 'proxies') return '个代理'")
    expect(source).toContain("if (props.config.key === 'contents') return '条内容'")
    expect(source).toContain("if (props.config.key === 'mediaAssets') return '个素材'")
    expect(toolbar).toContain("'batch-toolbar--persistent': persistentBatchToolbar")
  })
})

describe('账号导入按钮文案', () => {
  const body = source.split('const modalSubmitLabel = computed(() => {')[1]?.split('\n})')[0] || ''
  const label = new Function('modal', 'isAccountResource', 'formState', 'isTaskDispatchModal', 'isPublishedContentDispatchModal', 'isInteractionSessionCreateModal', body)

  it.each([
    ['create', true, 'create_environment_and_login', '导入并上号'],
    ['create', true, 'import_only', '导入账号'],
    ['create', true, undefined, '导入账号'],
    ['edit', true, 'create_environment_and_login', '保存'],
    ['create', false, undefined, '保存'],
  ])('%s / %s / %s 显示 %s', (type, account, action, expected) => {
    expect(label({ type }, { value: account }, { value: { post_import_action: action } }, { value: false }, { value: false }, { value: false })).toBe(expected)
  })

  it('保留动作自定义文案和任务下发文案', () => {
    const off = { value: false }
    expect(label({ type: 'batch', action: { submitLabel: '执行' } }, off, { value: {} }, off, off, off)).toBe('执行')
    expect(label({ type: 'create' }, off, { value: {} }, { value: true }, off, off)).toBe('确认执行')
    expect(label({ type: 'create' }, off, { value: {} }, off, { value: true }, off)).toBe('确认下发')
  })
})
