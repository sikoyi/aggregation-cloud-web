<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next'
import { computed } from 'vue'

import type { SelectOption } from '@/types/crud'
import { normalizeScriptParams } from '@/utils/form'

type ScriptParamDraft = Record<string, unknown>

const props = defineProps<{
  modelValue: unknown
  options?: SelectOption[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ScriptParamDraft[]]
}>()

const paramTypes = computed(() => props.options || [])
const validParams = computed(() => normalizeScriptParams(props.modelValue))

function defaultParam(index: number): ScriptParamDraft {
  return {
    param_key: '',
    name: '',
    param_type: 'string',
    description: '',
    // 新增脚本参数默认必填，运营可以按实际业务手动关闭。
    required: true,
    default_value: null,
    options: [],
    validation: {},
    resource_selector: {},
    sort_order: (index + 1) * 10,
    metadata: {},
  }
}

function currentItems() {
  return Array.isArray(props.modelValue)
    ? props.modelValue.map((item, index) => ({ ...defaultParam(index), ...(item as ScriptParamDraft) }))
    : []
}

function emitItems(items: ScriptParamDraft[]) {
  emit('update:modelValue', items)
}

function addParam() {
  const items = currentItems()
  emitItems([...items, defaultParam(items.length)])
}

function removeParam(index: number) {
  emitItems(currentItems().filter((_, itemIndex) => itemIndex !== index))
}

function updateParam(index: number, key: string, value: unknown) {
  const items = currentItems()
  items[index] = { ...items[index], [key]: value }
  emitItems(items)
}
</script>

<template>
  <div class="w-full space-y-3">
    <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <span class="text-xs text-slate-500">模板展示名称用于建任务模板时显示，脚本参数 Key 是脚本实际收到的字段名。</span>
      <el-button type="primary" :icon="Plus" @click="addParam">新增参数</el-button>
    </div>

    <el-empty v-if="!validParams.length && !currentItems().length" description="暂无参数" :image-size="72" />

    <el-card v-for="(_, index) in currentItems()" :key="index" shadow="never" class="script-param-card">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-sm font-semibold text-ink">参数 {{ index + 1 }}</span>
          <el-button text type="danger" :icon="Trash2" @click="removeParam(index)">删除</el-button>
        </div>
      </template>

      <el-row :gutter="12">
        <el-col :xs="24" :md="12">
          <el-form-item label="模板展示名称" required>
            <el-input
              :model-value="String(currentItems()[index].name || '')"
              placeholder="例如：发布内容"
              clearable
              @update:model-value="updateParam(index, 'name', $event)"
            />
          </el-form-item>
        </el-col>
        <el-col :xs="24" :md="12">
          <el-form-item label="脚本参数 Key" required>
            <el-input
              :model-value="String(currentItems()[index].param_key || '')"
              placeholder="例如：content"
              clearable
              @update:model-value="updateParam(index, 'param_key', $event)"
            />
          </el-form-item>
        </el-col>
        <el-col :xs="24" :md="8">
          <el-form-item label="参数类型">
            <el-select
              :model-value="String(currentItems()[index].param_type || 'string')"
              class="w-full"
              filterable
              @update:model-value="updateParam(index, 'param_type', $event)"
            >
              <el-option
                v-for="option in paramTypes"
                :key="String(option.value)"
                :label="option.label"
                :value="String(option.value)"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :xs="24" :md="8">
          <el-form-item label="排序">
            <el-input-number
              :model-value="Number(currentItems()[index].sort_order || (index + 1) * 10)"
              class="w-full"
              controls-position="right"
              @update:model-value="updateParam(index, 'sort_order', $event)"
            />
          </el-form-item>
        </el-col>
        <el-col :xs="24" :md="8">
          <el-form-item label="是否必填">
            <el-switch
              :model-value="Boolean(currentItems()[index].required)"
              active-text="是"
              inactive-text="否"
              @update:model-value="updateParam(index, 'required', $event)"
            />
          </el-form-item>
        </el-col>
        <el-col :xs="24" :md="12">
          <el-form-item label="默认值">
            <el-input
              :model-value="String(currentItems()[index].default_value ?? '')"
              clearable
              @update:model-value="updateParam(index, 'default_value', $event || null)"
            />
          </el-form-item>
        </el-col>
        <el-col :xs="24" :md="12">
          <el-form-item label="描述">
            <el-input
              :model-value="String(currentItems()[index].description || '')"
              clearable
              @update:model-value="updateParam(index, 'description', $event)"
            />
          </el-form-item>
        </el-col>
      </el-row>
    </el-card>
  </div>
</template>
