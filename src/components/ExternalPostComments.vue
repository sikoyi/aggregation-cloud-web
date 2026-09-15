<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Heart, MessageCircle, CornerDownRight } from 'lucide-vue-next'
import { formatDate } from '@/utils/format'
import type { AnyRecord } from '@/types/api'

const props = defineProps<{ comments: unknown; total: unknown }>()
const page = ref(1)
function safeUrl(value: unknown) {
  try { const url = new URL(String(value)); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : '' } catch { return '' }
}
function stripRenderedMediaLinks(value: unknown, media: string[]) {
  const rendered = new Set(media)
  const content = String(value || '').replace(/https?:\/\/[^\s]+/gi, candidate => {
    const normalized = safeUrl(candidate)
    return normalized && rendered.has(normalized) ? '' : candidate
  })
  const withoutTrailingXMedia = media.length
    ? content.replace(/(?:[ \t]*https?:\/\/t\.co\/[A-Za-z0-9]+[ \t]*)+$/i, '')
    : content
  return withoutTrailingXMedia
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .trim()
}
function splitLeadingMention(value: unknown) {
  const content = String(value || '').trim()
  const match = content.match(/^@([A-Za-z0-9_][A-Za-z0-9._]{0,63})(?=$|[\s,，:：])/)
  if (!match) return { replyTo: '', content }
  return {
    replyTo: `@${match[1]}`,
    content: content.slice(match[0].length).replace(/^[\s,，:：]+/, '').trim(),
  }
}
function commentRows(value: unknown) {
  const rows = Array.isArray(value) ? value.filter((item): item is AnyRecord => !!item && typeof item === 'object' && !Array.isArray(item)) : []
  const names = new Map(rows.filter(item => item.platform_comment_id).map(item => [String(item.platform_comment_id), String(item.author_name || '未知作者')]))
  return rows.map((item, index) => {
    const parentId = String(item.parent_platform_comment_id || item.parent_comment_id || '')
    const metadata = (item.platform_metadata || {}) as AnyRecord
    const media = Array.isArray(metadata.media_urls) ? [...new Set<string>(metadata.media_urls.map(safeUrl).filter(Boolean))] : []
    const rawContent = metadata.media_only && media.length && item.content === '[媒体评论]' ? '' : item.content
    const parsed = splitLeadingMention(stripRenderedMediaLinks(rawContent, media))
    return {
      key: `${item.platform_comment_id || 'comment'}-${index}`, author: String(item.author_name || '未知作者'),
      content: parsed.content || (!media.length && !parsed.replyTo ? '无文字内容' : ''), time: item.commented_at,
      avatar: safeUrl(metadata.author_avatar_url),
      images: media.filter(url => !/\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i.test(url)),
      videos: media.filter(url => /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i.test(url)),
      likes: item.like_count, replies: item.reply_count,
      replyTo: parsed.replyTo || (parentId ? names.get(parentId) || '未采集的评论' : ''),
      nested: Boolean(parentId),
    }
  })
}
function count(value: unknown) {
  return value == null || value === '' || !Number.isFinite(Number(value)) ? '--' : Number(value).toLocaleString('zh-CN')
}
const rows = computed(() => commentRows(props.comments))
const visibleRows = computed(() => rows.value.slice((page.value - 1) * 10, page.value * 10))
watch(() => props.comments, () => { page.value = 1 })
</script>

<template>
  <section class="external-comments" aria-label="已采集评论">
    <header class="external-comments__summary"><strong>已采集 {{ rows.length }} 条</strong><span>平台评论数 {{ count(total) }}</span></header>
    <ol v-if="rows.length" class="external-comments__list">
      <li v-for="comment in visibleRows" :key="comment.key" class="external-comment" :class="{ 'is-reply': comment.nested }">
        <el-avatar :size="32" :src="comment.avatar" class="external-comment__avatar">{{ comment.author.slice(0, 1) }}</el-avatar>
        <div class="external-comment__body">
          <header><strong>{{ comment.author }}</strong><time v-if="comment.time">{{ formatDate(comment.time) }}</time></header>
          <div v-if="comment.replyTo || comment.content" class="external-comment__message">
            <span v-if="comment.replyTo" class="external-comment__reply"><CornerDownRight :size="13" /><span>回复</span><strong>{{ comment.replyTo }}</strong></span>
            <p v-if="comment.content">{{ comment.content }}</p>
          </div>
          <div v-if="comment.images.length || comment.videos.length" class="external-comment__media">
            <el-image v-for="(url, index) in comment.images" :key="url" :src="url" :alt="`${comment.author} 的评论附图 ${index + 1}`" fit="contain" :preview-src-list="comment.images" :initial-index="index" preview-teleported referrerpolicy="no-referrer">
              <template #error><span class="external-comment__image-error">图片加载失败</span></template>
            </el-image>
            <video v-for="url in comment.videos" :key="url" :src="url" controls preload="none" aria-label="评论视频" />
          </div>
          <footer><span><Heart :size="14" />点赞 {{ count(comment.likes) }}</span><span><MessageCircle :size="14" />回复 {{ count(comment.replies) }}</span></footer>
        </div>
      </li>
    </ol>
    <el-empty v-else description="本次未采集到可展示的评论" :image-size="56" />
    <div v-if="rows.length > 10" class="external-comments__pagination"><el-pagination v-model:current-page="page" :page-size="10" :total="rows.length" :pager-count="5" background layout="prev, pager, next" /></div>
  </section>
</template>

<style scoped>
.external-comments { min-width: 0; }
.external-comments__summary { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 20px; padding-bottom: 12px; border-bottom: 1px solid #e1e8ef; font-size: 12px; }
.external-comments__summary strong { color: #334e68; }
.external-comments__summary span { color: #718096; }
.external-comments__list { list-style: none; margin: 0; padding: 0; }
.external-comment { display: flex; gap: 12px; padding: 16px 0; border-bottom: 1px solid #edf1f5; }
.external-comment.is-reply { margin-left: 20px; }
.external-comment__avatar { flex-shrink: 0; background: #eef5fa; color: #426b87; font-size: 13px; }
.external-comment__body { min-width: 0; flex: 1; }
.external-comment__body header { display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px 16px; }
.external-comment__body header strong { font-size: 13px; color: #263f54; overflow-wrap: anywhere; }
.external-comment__body time { font-size: 12px; color: #8291a1; white-space: nowrap; }
.external-comment__message { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 8px; margin: 8px 0 10px; }
.external-comment__body p { flex: 1 1 320px; min-width: 0; white-space: pre-wrap; overflow-wrap: anywhere; margin: 0; line-height: 1.7; font-size: 14px; color: #334e68; }
.external-comment__body footer { display: flex; gap: 20px; flex-wrap: wrap; font-size: 12px; color: #718096; }
.external-comment__media { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
.external-comment__media .el-image, .external-comment__media video { width: 160px; max-width: 100%; height: 120px; border: 1px solid #e1e8ef; border-radius: 4px; background: #f6f8fa; }
.external-comment__image-error { display: flex; align-items: center; justify-content: center; height: 100%; font-size: 12px; color: #8291a1; }
.external-comment__body footer span, .external-comment__reply { display: inline-flex; align-items: center; gap: 5px; }
.external-comment__reply { flex: 0 0 auto; font-size: 12px; color: #718096; overflow-wrap: anywhere; }
.external-comment__reply strong { color: #25658f; font-size: 13px; font-weight: 600; }
.external-comments__pagination { display: flex; justify-content: flex-end; padding-top: 12px; overflow-x: auto; }
</style>
