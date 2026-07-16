<script setup lang="ts">
import { computed } from 'vue'

import DynamicForm from '@/components/DynamicForm.vue'
import type { AnyRecord } from '@/types/api'
import type { FieldConfig } from '@/types/crud'

const props = defineProps<{
  mode: 'task' | 'published' | 'interaction'
  fields: FieldConfig[]
  modelValue: AnyRecord
  context?: AnyRecord
}>()

const emit = defineEmits<{
  'update:modelValue': [value: AnyRecord]
}>()

const taskDeviceFields = computed(() => props.fields.filter((field) => field.type === 'slotTree'))
const taskParamFields = computed(() => props.fields.filter((field) => field.type !== 'slotTree'))
const publishedAccountFields = computed(() => props.fields.filter((field) => field.type === 'accountTree'))
const publishedParamFields = computed(() => props.fields.filter((field) => field.type !== 'accountTree'))
const interactionMainFields = computed(() => props.fields.filter((field) => field.key === 'main_account_id'))
const interactionCommentFields = computed(() => props.fields.filter((field) => field.key === 'comment_account_ids'))
const interactionParamFields = computed(() => {
  const keys = new Set([
    'title',
    'business_platform',
    'step_count',
    'runtime_platform',
    'provider',
    'target_source_type',
    'target_content_id',
    'target_content_url',
    'scheduled_at',
    'ai_provider',
    'ai_language',
    'ai_tone',
    'ai_max_length',
  ])
  return props.fields.filter((field) => keys.has(field.key))
})

function updateValue(value: AnyRecord) {
  emit('update:modelValue', value)
}
</script>

<template>
  <div v-if="mode === 'task'" class="dispatch-layout">
    <div class="dispatch-panel dispatch-panel--selector">
      <div class="dispatch-panel__title">设备组 / 设备</div>
      <DynamicForm
        :model-value="modelValue"
        :fields="taskDeviceFields"
        :context="context"
        @update:model-value="updateValue"
      />
    </div>
    <div class="dispatch-panel">
      <div class="dispatch-panel__title">任务参数</div>
      <DynamicForm
        :model-value="modelValue"
        :fields="taskParamFields"
        :context="context"
        @update:model-value="updateValue"
      />
    </div>
  </div>

  <div v-else-if="mode === 'published'" class="dispatch-layout dispatch-layout--published">
    <div class="dispatch-panel dispatch-panel--selector">
      <div class="dispatch-panel__title">账号分组 / 已登录账号</div>
      <DynamicForm
        :model-value="modelValue"
        :fields="publishedAccountFields"
        :context="context"
        @update:model-value="updateValue"
      />
    </div>
    <div class="dispatch-panel">
      <div class="dispatch-panel__title">发布配置</div>
      <DynamicForm
        :model-value="modelValue"
        :fields="publishedParamFields"
        :context="context"
        @update:model-value="updateValue"
      />
    </div>
  </div>

  <div v-else class="interaction-layout">
    <div class="dispatch-panel dispatch-panel--account">
      <div class="dispatch-panel__title">主号</div>
      <DynamicForm
        :model-value="modelValue"
        :fields="interactionMainFields"
        :context="context"
        @update:model-value="updateValue"
      />
    </div>
    <div class="dispatch-panel dispatch-panel--account">
      <div class="dispatch-panel__title">评论账号</div>
      <DynamicForm
        :model-value="modelValue"
        :fields="interactionCommentFields"
        :context="context"
        @update:model-value="updateValue"
      />
    </div>
    <div class="dispatch-panel">
      <div class="dispatch-panel__title">参数填写</div>
      <DynamicForm
        :model-value="modelValue"
        :fields="interactionParamFields"
        :context="context"
        @update:model-value="updateValue"
      />
    </div>
  </div>
</template>

<style scoped>
.dispatch-layout {
  display: grid;
  grid-template-columns: minmax(300px, 380px) minmax(620px, 1fr);
  gap: 18px;
  align-items: start;
}

.dispatch-layout--published {
  grid-template-columns: minmax(240px, 300px) minmax(660px, 1fr);
  gap: 14px;
}

.interaction-layout {
  display: grid;
  grid-template-columns: minmax(240px, 300px) minmax(260px, 340px) minmax(560px, 1fr);
  gap: 14px;
  align-items: start;
}

.dispatch-panel {
  min-width: 0;
  padding: 14px;
  border: 1px solid #e6edf3;
  border-radius: 8px;
  background: #fbfdff;
}

.dispatch-panel__title {
  margin-bottom: 12px;
  color: #1f2933;
  font-size: 15px;
  font-weight: 700;
}

.dispatch-panel--selector :deep(.el-col),
.dispatch-panel--account :deep(.el-col) {
  max-width: 100%;
  flex: 0 0 100%;
}

.dispatch-panel--selector :deep(.slot-tree-select) {
  min-height: 480px;
  max-height: 58vh;
}

.dispatch-layout--published .dispatch-panel--selector {
  padding: 12px;
}

.dispatch-layout--published :deep(.account-tree-select) {
  min-height: 240px;
  max-height: 44vh;
}

.interaction-layout .dispatch-panel--account :deep(.account-tree-select) {
  min-height: 430px;
  max-height: 58vh;
}

@media (max-width: 768px) {
  .dispatch-layout,
  .interaction-layout {
    grid-template-columns: 1fr;
  }
}
</style>
