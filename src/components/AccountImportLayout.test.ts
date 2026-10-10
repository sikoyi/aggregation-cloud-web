import { describe, expect, it } from 'vitest'
import form from './DynamicForm.vue?raw'
import page from './CrudPage.vue?raw'

describe('账号导入左右布局', () => {
  it('只为包含账号文本的导入弹窗启用布局且保持单一表单状态', () => {
    expect(page).toContain("field.key === 'post_import_action'")
    expect(page).toContain("field.key === 'raw_text' && field.type === 'textImport'")
    expect(page).toContain(':split-import="isAccountImportModal"')
    expect(page).toContain("min(1240px, calc(100vw - 32px))")
  })
  it('桌面分栏，窄屏回落，操作区不随内容滚动', () => {
    expect(form).toContain('@media (min-width: 1000px)')
    expect(form).toContain('grid-template-columns: repeat(2, minmax(0, 1fr)) minmax(0, 1.9fr)')
    expect(form).toContain('.account-import-dialog .el-dialog__body')
    expect(form).toContain('min-height: 0; overflow-y: auto;')
    expect(form).toContain('.account-import-dialog .el-dialog__footer')
  })
})
