<script setup lang="ts">
import { MessageSquareText, Plus, Trash2 } from 'lucide-vue-next'
import { computed } from 'vue'

import MediaAssetPreviewPicker from '@/components/MediaAssetPreviewPicker.vue'
import type { AnyRecord } from '@/types/api'
import type { RemoteSelectConfig } from '@/types/crud'

interface PublishedCommentDraft {
  content: string | null
  media_asset_ids: string[]
}

const props = withDefaults(defineProps<{
  modelValue: unknown
  config: RemoteSelectConfig
  context?: AnyRecord
  disabled?: boolean
  maxItems?: number
}>(), {
  maxItems: 20,
})

const emit = defineEmits<{
  'update:modelValue': [value: PublishedCommentDraft[]]
}>()

const comments = computed<PublishedCommentDraft[]>(() => (
  Array.isArray(props.modelValue)
    ? props.modelValue.map((item) => normalizeComment(item))
    : []
))

const canAdd = computed(() => !props.disabled && comments.value.length < props.maxItems)

function normalizeComment(value: unknown): PublishedCommentDraft {
  const record = value && typeof value === 'object' ? value as AnyRecord : {}
  return {
    content: typeof record.content === 'string' ? record.content : null,
    media_asset_ids: Array.isArray(record.media_asset_ids)
      ? record.media_asset_ids.map(String).filter(Boolean)
      : [],
  }
}

function addComment() {
  if (!canAdd.value) return
  emit('update:modelValue', [
    ...comments.value,
    { content: null, media_asset_ids: [] },
  ])
}

function updateComment(index: number, patch: Partial<PublishedCommentDraft>) {
  const next = comments.value.map((item, itemIndex) => (
    itemIndex === index ? { ...item, ...patch } : item
  ))
  emit('update:modelValue', next)
}

function removeComment(index: number) {
  emit('update:modelValue', comments.value.filter((_item, itemIndex) => itemIndex !== index))
}
</script>

<template>
  <div class="comment-list-editor">
    <div class="comment-list-editor__toolbar">
      <div class="comment-list-editor__summary">
        <MessageSquareText :size="17" />
        <span>已添加 {{ comments.length }} 条</span>
        <small>最多 {{ maxItems }} 条，按列表顺序执行</small>
      </div>
      <el-button type="primary" plain :icon="Plus" :disabled="!canAdd" @click="addComment">
        添加评论
      </el-button>
    </div>

    <el-empty v-if="comments.length === 0" :image-size="64" description="暂未配置发布后评论">
      <el-button type="primary" plain :icon="Plus" :disabled="!canAdd" @click="addComment">
        添加第一条评论
      </el-button>
    </el-empty>

    <div v-else class="comment-list-editor__items">
      <section v-for="(comment, index) in comments" :key="index" class="comment-list-editor__item">
        <header class="comment-list-editor__item-header">
          <strong>评论 {{ index + 1 }}</strong>
          <el-button
            type="danger"
            text
            :icon="Trash2"
            :disabled="disabled"
            title="删除评论"
            @click="removeComment(index)"
          >
            删除
          </el-button>
        </header>
        <el-input
          :model-value="comment.content || ''"
          type="textarea"
          :rows="3"
          maxlength="20000"
          show-word-limit
          resize="vertical"
          :disabled="disabled"
          placeholder="填写评论内容；也可以只选择图片"
          @update:model-value="updateComment(index, { content: $event || null })"
        />
        <div class="comment-list-editor__media">
          <span>评论图片</span>
          <MediaAssetPreviewPicker
            :model-value="comment.media_asset_ids"
            :config="config"
            :context="context"
            :disabled="disabled"
            placeholder="可选；支持从素材库选择多张图片"
            @update:model-value="updateComment(index, { media_asset_ids: $event })"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.comment-list-editor {
  width: 100%;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  background: var(--el-fill-color-extra-light);
  overflow: hidden;
}

.comment-list-editor__toolbar {
  min-height: 48px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
}

.comment-list-editor__summary {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--el-text-color-regular);
}

.comment-list-editor__summary small {
  color: var(--el-text-color-secondary);
}

.comment-list-editor__items {
  max-height: 560px;
  padding: 12px;
  display: grid;
  gap: 12px;
  overflow-y: auto;
}

.comment-list-editor__item {
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-bg-color);
}

.comment-list-editor__item-header {
  min-height: 28px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.comment-list-editor__item-header strong {
  color: var(--el-text-color-primary);
  font-size: 14px;
}

.comment-list-editor__media {
  margin-top: 10px;
  display: grid;
  gap: 6px;
}

.comment-list-editor__media > span {
  color: var(--el-text-color-regular);
  font-size: 13px;
}

@media (max-width: 720px) {
  .comment-list-editor__toolbar,
  .comment-list-editor__summary {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
