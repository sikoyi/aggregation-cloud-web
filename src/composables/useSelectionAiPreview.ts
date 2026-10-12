import { onScopeDispose, ref, watch } from 'vue'
import { contentSelection, type SelectionAiRequest, type SelectionAiResult } from '@/api/contentSelection'

export interface SelectionAiContext { postId: string; revision: string; accountId: string; text: string; platform: string }

export function useSelectionAiPreview(context: () => SelectionAiContext) {
  const busy = ref(false)
  const result = ref<SelectionAiResult | null>(null)
  const error = ref('')
  let generation = 0
  function clear() { generation++; busy.value = false; result.value = null; error.value = '' }
  watch(() => JSON.stringify(context()), clear, { flush: 'sync' })
  onScopeDispose(clear)
  async function generate(action: SelectionAiRequest['action'], language?: string) {
    if (busy.value) return
    const snapshot = context()
    if (!snapshot.accountId || !snapshot.text.trim() || snapshot.text.length > 10000) return
    const id = ++generation
    busy.value = true
    result.value = null
    error.value = ''
    try {
      const response = await contentSelection.previewText(snapshot.postId, {
        account_id: snapshot.accountId, source_revision: snapshot.revision, text_body: snapshot.text,
        action, ...(action === 'translate' ? { language } : {}),
      })
      if (id === generation) result.value = response
    } catch (e) {
      if (id === generation) error.value = e instanceof Error ? e.message : 'AI 处理失败，当前发布稿未变更'
    } finally { if (id === generation) busy.value = false }
  }
  return { busy, result, error, generate, clear }
}
