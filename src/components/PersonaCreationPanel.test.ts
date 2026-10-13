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
    expect(panel).toContain('原帖作者人设')
    expect(panel).toContain(':account-id="subjectId" :account-name="sourceName"')
    expect(dialog).toContain("auth.can(isSource.value ? 'operations.dispatch' : 'accounts.edit')")
  })
})
