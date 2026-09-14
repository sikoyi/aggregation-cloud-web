import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import source from './ExternalPostComments.vue?raw'
import detail from './ExternalAccountDetail.vue?raw'

const ast = ts.createSourceFile('Comments.ts', source.split('<script setup lang="ts">')[1]!.split('</script>')[0]!, ts.ScriptTarget.Latest, true)
const functions = ast.statements.filter(ts.isFunctionDeclaration).map(node => node.getText(ast)).join('\n')
const js = ts.transpileModule(functions, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const { commentRows, count } = new Function(`${js}; return {commentRows, count}`)()

describe('外部评论阅读布局', () => {
  it('渲染头像与附图，拒绝危险地址并保留纯媒体评论', () => {
    const row = commentRows([{ content: '[媒体评论]', platform_metadata: { media_only: true, author_avatar_url: 'https://example.com/avatar.jpg', media_urls: ['https://example.com/photo.jpg', 'https://example.com/photo.jpg', 'javascript:alert(1)', 'data:image/svg+xml,bad', 'https://user:password@example.com/private.jpg', 'https://example.com/video.mp4'] } }])[0]
    expect(row.avatar).toBe('https://example.com/avatar.jpg')
    expect(row.images).toEqual(['https://example.com/photo.jpg'])
    expect(row.videos).toEqual(['https://example.com/video.mp4'])
    expect(row.content).toBe('')
    expect(commentRows([{ platform_metadata: { media_urls: 'invalid', author_avatar_url: 'javascript:bad' } }])[0]).toMatchObject({ avatar: '', images: [], videos: [] })
    expect(source).toContain(':src="comment.avatar"')
    expect(source).toContain('preview-teleported')
    expect(source).toContain('图片加载失败')
  })
  it('保留作者时间正文及零值，回复标明已知父评论作者', () => {
    const result = commentRows([
      { platform_comment_id: 'reply', parent_platform_comment_id: 'root', author_name: 'B', content: '回复\n第二行', like_count: 0, reply_count: 0, commented_at: '2026-09-14T01:00:00Z' },
      { platform_comment_id: 'root', author_name: 'A', content: '原评论' },
    ])
    expect(result[0]).toMatchObject({ author: 'B', replyTo: 'A', likes: 0, replies: 0, content: '回复\n第二行', time: '2026-09-14T01:00:00Z' })
    expect(count(0)).toBe('0')
    expect(count(null)).toBe('--')
  })
  it('缺失父评论不伪造回复对象，坏数据不导致渲染失败', () => {
    expect(commentRows(null)).toEqual([])
    expect(commentRows([null, 1, 'bad', []])).toEqual([])
    expect(commentRows([{ parent_platform_comment_id: 'missing' }])[0]).toMatchObject({ author: '未知作者', replyTo: '未采集的评论', content: '无文字内容' })
  })
  it('重复和循环引用不丢失评论或引发递归', () => {
    const rows = commentRows([{ platform_comment_id: 'same', parent_platform_comment_id: 'same' }, { platform_comment_id: 'same' }])
    expect(rows).toHaveLength(2)
    expect(rows[0].key).not.toBe(rows[1].key)
  })
  it('默认展示评论，完整帖文独立切换，时间标签同行', () => {
    expect(detail).toContain('<el-tabs model-value="comments">')
    expect(detail).toContain('label="完整帖文"')
    expect(detail).toContain('grid-template-columns: 48px minmax(0, 1fr)')
    expect(source).toContain('平台评论数')
    expect(source).toContain(':page-size="10"')
    expect(source).not.toContain('v-html')
  })
})
