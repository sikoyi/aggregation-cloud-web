<script setup lang="ts">
import type { AnyRecord } from '@/types/api'
import type { FieldConfig } from '@/types/crud'

const props = defineProps<{
  fields: FieldConfig[]
  modelValue: AnyRecord
}>()

const emit = defineEmits<{
  'update:modelValue': [value: AnyRecord]
}>()

function updateValue(key: string, value: unknown) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
</script>

<template>
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <label
      v-for="field in fields"
      :key="field.key"
      class="space-y-1.5"
      :class="field.span === 2 ? 'md:col-span-2' : ''"
    >
      <span class="label">
        {{ field.label }}
        <span v-if="field.required" class="text-red-500">*</span>
      </span>

      <textarea
        v-if="field.type === 'textarea' || field.type === 'json'"
        class="textarea"
        :class="field.type === 'json' ? 'font-mono text-xs' : ''"
        :rows="field.type === 'json' ? 8 : 4"
        :placeholder="field.placeholder"
        :readonly="field.readonly"
        :value="String(modelValue[field.key] ?? '')"
        @input="updateValue(field.key, ($event.target as HTMLTextAreaElement).value)"
      />

      <select
        v-else-if="field.type === 'select'"
        class="input"
        :value="String(modelValue[field.key] ?? '')"
        :disabled="field.readonly"
        @change="updateValue(field.key, ($event.target as HTMLSelectElement).value)"
      >
        <option value="">请选择</option>
        <option v-for="option in field.options || []" :key="String(option.value)" :value="String(option.value)">
          {{ option.label }}
        </option>
      </select>

      <label
        v-else-if="field.type === 'boolean'"
        class="flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm text-slate-700"
      >
        <input
          type="checkbox"
          class="h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-500"
          :checked="Boolean(modelValue[field.key])"
          :disabled="field.readonly"
          @change="updateValue(field.key, ($event.target as HTMLInputElement).checked)"
        />
        <span>{{ field.placeholder || field.label }}</span>
      </label>

      <input
        v-else
        class="input"
        :type="field.type === 'number' ? 'number' : field.type === 'datetime' ? 'datetime-local' : 'text'"
        :placeholder="field.placeholder"
        :readonly="field.readonly"
        :value="String(modelValue[field.key] ?? '')"
        @input="updateValue(field.key, ($event.target as HTMLInputElement).value)"
      />
    </label>
  </div>
</template>
