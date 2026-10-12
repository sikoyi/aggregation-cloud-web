<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check, Languages, Sparkles, X } from 'lucide-vue-next'
import { languages } from '@/utils/benchmarkPostProcessing'
import { useSelectionAiPreview } from '@/composables/useSelectionAiPreview'

const props = defineProps<{ postId: string; revision: string; accountId: string; platform: string; modelValue: string; disabled: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; busy: [value: boolean] }>()
const language = ref('')
const { busy, result, error, generate, clear } = useSelectionAiPreview(() => ({
  postId: props.postId, revision: props.revision, accountId: props.accountId, platform: props.platform, text: props.modelValue,
}))
watch(busy, value => emit('busy', value), { flush: 'sync' })
watch(language, clear)
const unavailable = computed(() => props.disabled || busy.value || !props.accountId || !props.modelValue.trim() || props.modelValue.length > 10000)
function apply() {
  if (!result.value?.changed || props.disabled || busy.value) return
  const text = result.value.text_body
  clear()
  emit('update:modelValue', text)
}
</script>

<template>
  <div class="selection-ai">
    <div class="ai-toolbar">
      <h3>发布稿</h3>
      <el-select v-model="language" :disabled="disabled || busy" placeholder="目标语言" aria-label="翻译目标语言" class="ai-language">
        <el-option v-for="(name, code) in languages" :key="code" :label="name" :value="code" />
      </el-select>
      <el-button type="primary" plain :icon="Languages" :disabled="unavailable || !language" @click="generate('translate', language)">AI 翻译</el-button>
      <el-tooltip :content="platform === 'x' ? '按 X 长度限制缩写当前发布稿' : '当前仅支持 X 帖子缩写'">
        <span><el-button type="primary" plain :icon="Sparkles" :disabled="unavailable || platform !== 'x'" @click="generate('shorten')">AI 缩写</el-button></span>
      </el-tooltip>
    </div>
    <slot />
    <small v-if="busy" role="status">AI 处理中…</small>
    <small v-if="modelValue.length > 10000">正文超过 AI 处理上限（10000 字符）</small>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <div v-if="result" class="ai-result">
      <strong>AI 结果预览</strong>
      <el-alert v-if="result.message" :title="result.message" type="warning" :closable="false" />
      <p>{{ result.text_body }}</p>
      <div class="ai-toolbar">
        <el-button type="primary" :icon="Check" :disabled="disabled || !result.changed" @click="apply">应用到发布稿</el-button>
        <el-button :icon="X" :disabled="disabled" @click="clear">放弃结果</el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.selection-ai { min-width: 0; }
.ai-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.selection-ai > .ai-toolbar { min-height: 40px; margin-bottom: 12px; }
.ai-toolbar h3 { margin: 0 auto 0 0; font-size: 15px; }
.ai-toolbar :deep(.el-button) { margin-left: 0; }
.ai-toolbar .ai-language { width: 130px; max-width: 100%; }
.ai-result { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--app-border, #dce3eb); }
.ai-result p { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.7; max-height: 260px; overflow-y: auto; }
.selection-ai :deep(.el-alert) { margin-top: 10px; }
small { display: block; margin-top: 8px; color: var(--app-text-muted, #697786); }
</style>
