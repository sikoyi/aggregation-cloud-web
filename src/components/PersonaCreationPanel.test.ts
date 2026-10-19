import { describe, expect, it } from 'vitest'
import panel from './PersonaCreationPanel.vue?raw'
import view from '../views/ContentSelectionView.vue?raw'
import dialog from './AccountPersonaDialog.vue?raw'

describe('source author persona creation', () => {
  it('uses the selected source for persona lookup and passes the target separately', () => {
    expect(panel).toContain('`source:${props.sourceId}`')
    expect(panel).toContain('accountPersona.overview(subjectId.value)')
    expect(panel).toContain('target_account_id: props.accountId')
    expect(panel).toContain('j.target_account_id === props.accountId')
    expect(view).toContain(':source-id="selected.source_id"')
    expect(view).not.toContain('v-if="editVisible && draft.account_id &&')
  })
  it('shows an explicit original-author title and uses operations permissions', () => {
    expect(panel).toContain('原帖作者 ·')
    expect(panel).toContain(':account-id="subjectId" :account-name="sourceName"')
    expect(dialog).toContain("auth.can(isSource.value ? 'operations.dispatch' : 'accounts.edit')")
  })
  it('does not require a confirmed persona for manual creation', () => {
    expect(panel).toContain('persona_id: persona.value?.id')
    expect(panel).not.toContain('!persona.value ||')
    expect(panel).not.toContain(':disabled="!persona ||')
    expect(panel).not.toContain('未确认人设')
    expect(panel).toContain('参考人设 v')
  })
  it('prefills author analysis without showing an empty source form or discarding operator edits', () => {
    expect(panel).toContain('作者 AI 人设')
    expect(panel).toContain('AI 分析原作者中')
    expect(dialog).toContain('isSource && !hasDocument')
    expect(dialog).toContain('jobPersonaAnalysis(latest)')
    expect(dialog).toContain('dirty.value')
    expect(dialog).toContain('@input="dirty = true"')
    expect(dialog).toContain("isSource ? '保存调整' : '确认新版本'")
  })
  it('displays checkpoint progress and concrete failure reasons in both entry points', () => {
    expect(dialog).toContain('personaProgress(detail)')
    expect(panel).toContain('personaProgress(selectedJob)')
    expect(dialog).toContain(':title="detail.error_message"')
    expect(panel).toContain(':title="selectedJob.error_message"')
    expect(dialog).not.toContain('v-html')
    expect(panel).not.toContain('v-html')
  })
})
