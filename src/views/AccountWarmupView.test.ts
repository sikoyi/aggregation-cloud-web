import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import source from './AccountWarmupView.vue?raw'

const script = source.split('<script setup lang="ts">')[1]!.split('</script>')[0]!
const ast = ts.createSourceFile('warmup.ts', script, ts.ScriptTarget.Latest, true)
const functions = ast.statements.filter(ts.isFunctionDeclaration)
  .filter(node => ['initialForm', 'normalizedPayload', 'validateForm'].includes(node.name!.text))
  .map(node => node.getText(ast)).join('\n')
const compiled = ts.transpileModule(functions, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
function setup() {
  return new Function(`${compiled}; const form = initialForm(), fixedSource={value:'slot'}, editorTab={value:'basic'};
    const behaviorRuleKeys=['browse','detail_view','like','follow','publish'], behaviorRuleLabels={};
    return {form, fixedSource, normalizedPayload, validateForm};`)()
}

describe('云手机养号计划', () => {
  it('计划统一选择上号方式，设备和账号均必填', () => {
    const s = setup()
    Object.assign(s.form, {name:'test',runtime_platform:'cloud_phone',provider:'vmos'})
    expect(s.form.cloud_login_mode).toBe('backup_package')
    expect(s.validateForm()).toBe('请选择云手机设备池')
    s.form.target_rules.slot_ids=['s']
    expect(s.validateForm()).toBe('请选择目标账号')
    s.form.target_rules.account_ids=['a']
    s.form.cloud_login_mode='password'
    expect(s.validateForm()).toBe('')
    expect(s.normalizedPayload().cloud_login_mode).toBe('password')
  })
  it('标签只作筛选，保存明确设备池和账号列表', () => {
    const s = setup()
    Object.assign(s.form, {runtime_platform:'cloud_phone',target_mode:'account_tags'})
    s.form.target_rules={slot_ids:['s'],account_ids:['a'],account_tag_ids:['tag'],slot_group_ids:['group']}
    const p=s.normalizedPayload()
    expect(p.target_mode).toBe('fixed')
    expect(p.target_rules).toEqual({slot_ids:['s'],account_ids:['a'],account_tag_ids:[],slot_group_ids:[]})
  })
  it('指纹浏览器原目标规则保持不变', () => {
    const s=setup()
    s.form.target_mode='account_tags'
    s.form.target_rules={slot_ids:['s'],account_ids:['a'],account_tag_ids:['tag'],slot_group_ids:['g']}
    expect(s.normalizedPayload().target_rules).toEqual({slot_ids:[],account_ids:[],account_tag_ids:['tag'],slot_group_ids:[]})
  })
  it('云手机账号选择不按绑定设备或登录状态排除账号', () => {
    expect(script).toContain('const cloudAccountFilters = computed(() => ({ business_platform: form.business_platform }))')
    expect(source).toContain(':filters="cloudAccountFilters" multiple association-only tag-filter')
    expect(source).toContain(':filters="cloudSlotFilters" account-presence="all"')
  })
})

describe('养号计划批量状态操作', () => {
  it('常驻展示选择数量和三个批量操作入口', () => {
    expect(source).toContain('class="plan-batch-bar"')
    expect(source).toContain('已选择 <strong>{{ selectedPlanIds.length }}</strong> 个计划')
    expect(source).toContain('批量开启')
    expect(source).toContain('批量关闭')
    expect(source).toContain('批量取消')
  })

  it('列表支持勾选并把批量按钮绑定到统一处理函数', () => {
    expect(source).toContain('@selection-change="handlePlanSelectionChange"')
    expect(source).toContain('<el-table-column v-if="canBatchOperate" type="selection"')
    expect(source).toContain("batchOperatePlans('activate')")
    expect(source).toContain("batchOperatePlans('pause')")
    expect(source).toContain("batchOperatePlans('cancel')")
  })
})
