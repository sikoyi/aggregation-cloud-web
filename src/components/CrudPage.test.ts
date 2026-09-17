import { describe, expect, it } from 'vitest'

import source from './CrudPage.vue?raw'

const toolbar = source.split('class="batch-toolbar"')[1]?.split('<el-card shadow="never" class="table-card">')[0] || ''

describe('账号管理批量操作栏', () => {
  it('仅账号管理常驻，其他资源仍按选中状态显示，并保留权限过滤', () => {
    expect(source).toContain("computed(() => ['accounts', 'accountIdentities'].includes(props.config.key))")
    expect(source).toContain('v-if="batchActions.length && (isAccountResource || hasSelectedRows)"')
    expect(source).toContain('.filter((action) => canRunAction(action))')
  })

  it('空选或提交时禁用操作，保留聚合账号的影响范围', () => {
    expect(toolbar).toContain(':disabled="!selectedRows.length || submitting"')
    expect(toolbar).toContain(':loading="submitting"')
    expect(toolbar).toContain('@click="runBatchAction(action)"')
    expect(toolbar).toContain('{{ selectedIdentityScope }}')
    expect(source).toContain('identitySelectionLabel(selectedRows.value)')
  })

  it('账号工具栏使用常规按钮且不显示取消选择入口', () => {
    expect(toolbar).toContain(':size="isAccountResource ? \'default\' : \'small\'"')
    expect(toolbar).toContain('<el-button v-if="!isAccountResource" size="small" text')
    expect(source).toContain('<el-table-column v-if="batchActions.length" type="selection"')
  })

  it('对齐账号数据的高度、间距和主题，并与表格衔接', () => {
    const styles = source.split('.batch-toolbar--accounts {')[1]?.split('.resource-table')[0] || ''
    expect(styles).toContain('min-height: 52px;')
    expect(styles).toContain('padding: 8px 14px;')
    expect(styles).toContain('background: var(--app-surface-muted, #f7fafc);')
    expect(styles).toContain('box-shadow: none;')
    expect(styles).toContain('.batch-toolbar--accounts + .table-card')
    expect(styles).toContain('margin-top: 0;')
    expect(styles).toContain('flex-basis: 100%;')
  })
})
