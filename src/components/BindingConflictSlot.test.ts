import { ID_INJECTION_KEY, ZINDEX_INJECTION_KEY } from 'element-plus'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it, vi } from 'vitest'

import BindingConflictSlot from './BindingConflictSlot.vue'
import type { BindingConflictSlot as Slot } from '@/api/bindingConflicts'

vi.mock('element-plus/es/components/base/style/css', () => ({}))
vi.mock('element-plus/es/components/button/style/css', () => ({}))
vi.mock('element-plus/es/components/tooltip/style/css', () => ({}))

const slot = { id: 'internal-1', display_name: '运营环境', provider_slot_id: 'provider-1' }
async function render(value: Slot | null, restricted = false, canNavigate = true, emptyText?: string) {
  const app = createSSRApp(BindingConflictSlot, { slot: value, restricted, canNavigate, emptyText })
  app.provide(ID_INJECTION_KEY, { prefix: 0, current: 0 })
  app.provide(ZINDEX_INJECTION_KEY, { current: 0 })
  return renderToString(app)
}

describe('冲突环境权限边界', () => {
  it('环境可见时区分两种 ID 并可复制和定位', async () => {
    const html = await render(slot)
    for (const text of ['运营环境', 'provider-1', 'internal-1', '复制环境 ID', '复制设备记录 ID', '定位设备']) expect(html).toContain(text)
  })
  it.each([null, slot])('受限环境不能显示标识或操作 %j', async value => {
    const html = await render(value, true)
    expect(html).toContain('无权查看此环境')
    for (const text of ['运营环境', 'provider-1', 'internal-1', '<button', '定位设备']) expect(html).not.toContain(text)
  })
  it('无设备查看权限时不能跳转，但可复制后端允许展示的 ID', async () => {
    const html = await render(slot, false, false)
    expect(html).not.toContain('定位设备')
    expect(html).toContain('复制环境 ID')
  })
  it('非受限的空环境有独立空状态', async () => {
    const html = await render(null)
    expect(html).toContain('环境已不存在')
    expect(html).not.toContain('<button')
  })
  it('待处理冲突可以没有正式绑定，不等同权限受限', async () => {
    const html = await render(null, false, true, '暂无正式绑定')
    expect(html).toContain('暂无正式绑定')
    expect(html).not.toContain('无权查看')
    expect(html).not.toContain('<button')
  })
})
