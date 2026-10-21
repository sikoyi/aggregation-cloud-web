import { describe, expect, it } from 'vitest'
import status from './PersonaJobStatus.vue?raw'
import dialog from './AccountPersonaDialog.vue?raw'
import creation from './PersonaCreationPanel.vue?raw'

describe('persona manual recovery', () => {
  it('requires explicit confirmation and retains the idempotency key after network errors', () => {
    expect(status).toContain('ElMessageBox.confirm')
    expect(status).toContain("props.job.status !== 'failed'")
    expect(status).toContain('job.budget?.resume_token_increment ?? 1000000')
    expect(status).toContain('request?.id !== job.id')
    expect(status).toContain('request.key')
    expect(status).not.toContain('accountPersona.generate')
    expect(status).not.toContain("emit('apply'")
    expect(status).not.toContain('onMounted')
  })
  it('exposes unknown costs and is wired into analysis and creation records', () => {
    expect(status).toContain('上游未提供可确认的人民币费用')
    expect(status).toContain('费用仅供查看，不作为停止条件')
    expect(dialog).toContain('<PersonaJobStatus')
    expect(dialog).toContain('运行统计')
    expect(creation).toContain('<PersonaJobStatus')
    expect(creation).toContain('budget: fresh.budget')
  })
})
