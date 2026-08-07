<script setup lang="ts">
import { computed } from 'vue'

import DynamicForm from '@/components/DynamicForm.vue'
import type { AnyRecord } from '@/types/api'
import type { FieldConfig } from '@/types/crud'
import { groupInteractionDispatchFields } from '@/utils/interactionDispatchFields'

const props = defineProps<{
  mode: 'task' | 'published' | 'interaction'
  fields: FieldConfig[]
  modelValue: AnyRecord
  context?: AnyRecord
}>()

const emit = defineEmits<{
  'update:modelValue': [value: AnyRecord]
}>()

const taskSelectorKeys = new Set([
  'registration_target_mode',
  'concurrent_registration_count',
  'slot_ids',
])
const taskDeviceFields = computed(() => props.fields.filter((field) => taskSelectorKeys.has(field.key)))
const taskParamFields = computed(() => props.fields.filter((field) => !taskSelectorKeys.has(field.key)))
const isCreateWindowRegistration = computed(() => (
  props.modelValue.script_purpose === 'account_registration'
  && props.modelValue.registration_target_mode === 'create_windows'
))
const registrationAttemptTotal = computed(() => (
  Number(props.modelValue.concurrent_registration_count || 0)
  * Number(props.modelValue.execution_count || 0)
))
const publishedDeviceFields = computed(() => props.fields.filter((field) => field.type === 'slotTree'))
const publishedParamFields = computed(() => props.fields.filter((field) => field.type !== 'slotTree'))
const interactionFieldGroups = computed(() => groupInteractionDispatchFields(props.fields))
const interactionMainFields = computed(() => interactionFieldGroups.value.main)
const interactionCommentFields = computed(() => interactionFieldGroups.value.comment)
const interactionParamFields = computed(() => interactionFieldGroups.value.params)
const interactionMainTitle = computed(() => (
  props.modelValue.interaction_mode === 'square_numeric' ? '目标监听账号' : '主号设备'
))

function updateValue(value: AnyRecord) {
  emit('update:modelValue', value)
}
</script>

<template>
  <div v-if="mode === 'task'" class="dispatch-layout">
    <div class="dispatch-panel dispatch-panel--selector">
      <div class="dispatch-panel__title">
        {{ modelValue.script_purpose === 'account_registration' ? '注册目标' : '设备组 / 设备' }}
      </div>
      <DynamicForm
        :model-value="modelValue"
        :fields="taskDeviceFields"
        :context="context"
        @update:model-value="updateValue"
      />
      <el-alert
        v-if="isCreateWindowRegistration"
        type="info"
        :closable="false"
        show-icon
        :title="`将建立 ${Number(modelValue.concurrent_registration_count || 0)} 个并发通道，共执行 ${registrationAttemptTotal} 次注册尝试`"
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
      <div class="dispatch-panel__title">设备分组 / 有号设备</div>
      <DynamicForm
        :model-value="modelValue"
        :fields="publishedDeviceFields"
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
      <div class="dispatch-panel__title">{{ interactionMainTitle }}</div>
      <DynamicForm
        :model-value="modelValue"
        :fields="interactionMainFields"
        :context="context"
        @update:model-value="updateValue"
      />
    </div>
    <div class="dispatch-panel dispatch-panel--account">
      <div class="dispatch-panel__title">评论设备</div>
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

.dispatch-layout--published :deep(.slot-tree-select) {
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
