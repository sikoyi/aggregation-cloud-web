import { computed, onScopeDispose, ref, watch } from 'vue'
import { http } from '@/api/http'

export interface AiModelOption {
  id: string
  input_price?: number | null
  output_price?: number | null
  currency?: string | null
}

export interface AiModelTest {
  model: string
  sample_content: string
  checked_at: string
  input_tokens?: number | null
  output_tokens?: number | null
  total_tokens?: number | null
  cost?: number | null
  currency?: string | null
}

export function modelPrice(model?: AiModelOption) {
  if (!model?.currency || (model.input_price == null && model.output_price == null)) return '价格未知'
  return `${model.currency} / 百万 Token · 输入 ${model.input_price ?? '未知'} · 输出 ${model.output_price ?? '未知'}`
}

export function useAiModelCatalog(connection: () => { endpoint: string; api_key: string; base_url: string }) {
  const models = ref<AiModelOption[] | null>(null)
  const loading = ref(false)
  const testing = ref('')
  const error = ref('')
  const tests = ref<Record<string, AiModelTest>>({})
  const testErrors = ref<Record<string, string>>({})
  let revision = 0
  const context = computed(connection)
  function reset() {
    revision++
    models.value = null
    loading.value = false
    testing.value = ''
    error.value = ''
    tests.value = {}
    testErrors.value = {}
  }
  watch(context, reset, { deep: true, flush: 'sync' })
  onScopeDispose(() => { revision++ })
  function requestContext() {
    const { endpoint, api_key, base_url } = context.value
    return { endpoint, body: { api_key: api_key.trim() || null, base_url: base_url.trim() || null } }
  }
  async function fetchModels() {
    if (loading.value) return
    const version = revision
    const { endpoint, body } = requestContext()
    loading.value = true
    error.value = ''
    try {
      const result = await http.post<AiModelOption[]>(`${endpoint}/models`, body)
      if (version === revision) models.value = result
    } catch (err) {
      if (version === revision) error.value = err instanceof Error ? err.message : '获取模型失败'
    } finally {
      if (version === revision) loading.value = false
    }
  }
  async function testModel(model: string) {
    if (!model || testing.value) return
    const version = revision
    const { endpoint, body } = requestContext()
    testing.value = model
    delete tests.value[model]
    delete testErrors.value[model]
    try {
      const result = await http.post<AiModelTest>(`${endpoint}/test`, { ...body, model })
      if (version === revision) tests.value[model] = result
    } catch (err) {
      if (version === revision) testErrors.value[model] = err instanceof Error ? err.message : '模型测试失败'
    } finally {
      if (version === revision) testing.value = ''
    }
  }
  return { models, loading, error, testing, tests, testErrors, fetchModels, testModel }
}
