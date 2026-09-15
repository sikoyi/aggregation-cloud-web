import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it, vi } from 'vitest'
import ReplyJobAccount from './ReplyJobAccount.vue'
import ReplyJobPost from './ReplyJobPost.vue'
import source from '@/views/CommentReplyReviewView.vue?raw'

vi.mock('element-plus/es/components/link/style/css', () => ({}))
vi.mock('element-plus/es/components/base/style/css', () => ({}))
const render = (job: Record<string, unknown>) => renderToString(createSSRApp(ReplyJobAccount, { job }))

describe('回复工单账号与原帖', () => {
  it('列表与弹窗复用昵称、公开用户名和原帖链接', async () => {
    const html = await render({ operator_account_name: '监听昵称', operator_account_username: '@public_name', content_url: 'https://x.com/public_name/status/123' })
    expect(html).toContain('监听昵称')
    expect(html).toContain('@public_name')
    expect(html).not.toContain('@@public_name')
    const post = await renderToString(createSSRApp(ReplyJobPost, { job: {
      content_url: 'https://x.com/public_name/status/123',
      content_title: '原帖标题 https://t.co/title-media',
      content_text: '原帖正文 https://t.co/post-media\n<script>example</script>',
    } }))
    expect(post).toContain('href="https://x.com/public_name/status/123"')
    expect(post).toContain('target="_blank"')
    expect(post).toContain('rel="noopener noreferrer"')
    expect(post).toContain('原帖标题')
    expect(post).toContain('原帖正文')
    expect(post).toContain('&lt;script&gt;example&lt;/script&gt;')
    expect(post).not.toContain('https://t.co/title-media')
    expect(post).not.toContain('https://t.co/post-media')
    expect(source).toContain('<ReplyJobAccount :job="row" />')
    expect(source).toContain('<ReplyJobAccount :job="activeJob" />')
    expect(source).toContain('<ReplyJobPost :job="row" />')
    expect(source).toContain('<ReplyJobPost :job="activeJob" />')
  })
  it.each(['', 'javascript:alert(1)', 'data:text/html,test', 'https://user:secret@example.com/post'])('缺失或危险链接不渲染跳转 %s', async content_url => {
    expect(await render({ operator_account_id: 'account-1' })).toContain('account-1')
    const html = await renderToString(createSSRApp(ReplyJobPost, { job: { content_url } }))
    expect(html).toContain('暂无帖子链接')
    expect(html).not.toContain('href=')
  })

  it('原帖正文只有链接时显示正文缺失提示但保留原帖快捷入口', async () => {
    const html = await renderToString(createSSRApp(ReplyJobPost, { job: {
      content_url: 'https://x.com/public_name/status/123',
      content_text: 'https://t.co/post-media',
    } }))
    expect(html).toContain('暂无帖子正文')
    expect(html).not.toContain('https://t.co/post-media')
    expect(html).toContain('href="https://x.com/public_name/status/123"')
  })
})
