// Isolated loopback UI fixture. Never forwards requests to a real backend.
// Run: node tests/ui/external-account-monitor-preview.mjs
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const now = new Date().toISOString()
let rows = [{ id: 'fixture-1', business_platform: 'x', profile_url: 'https://x.com/example', remark: '界面测试数据',
  interval_minutes: 60, enabled: true, version: 1, status: 'active', next_run_at: now, last_success_at: now,
  profile: { display_name: 'External Example', username: 'example', avatar_url: 'http://127.0.0.1:5198/favicon.svg', biography: 'Only fixture data, no real collection.', followers_count: 1234, following_count: 0, posts_count: 78 } }]
const html = `<!doctype html><html lang="zh-CN"><head><meta name="viewport" content="width=device-width, initial-scale=1"/><title>外部监听隔离验证</title></head><body><div id="app"></div><script type="module">
import {createApp} from 'vue';
import {createPinia} from 'pinia';
import {useAuthStore} from '/src/stores/auth.ts';
import Component from '/src/components/ExternalAccountMonitors.vue';
import '/node_modules/element-plus/dist/index.css';
const app=createApp(Component), pinia=createPinia(); app.use(pinia);
useAuthStore(pinia).user={id:'fixture-user',username:'fixture',roles:['operator'],permissions:location.search.includes('readonly')?['operations.view']:['operations.view','operations.edit'],business_platform_scope:null};
app.mount('#app');
</script><style>body{font-family:Arial,sans-serif;margin:16px;color:#243746;background:#f6f8fa}*{box-sizing:border-box}</style></body></html>`
const server = await createServer({
  root,
  cacheDir: `${root}/node_modules/.vite-external-preview`,
  server: { host: '127.0.0.1', port: 5198, strictPort: true },
  plugins: [{ name: 'isolated-external-monitor-fixture', configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url || '/', 'http://localhost')
      if (url.pathname === '/__external_preview') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(await server.transformIndexHtml(req.url, html)); return
      }
      if (!url.pathname.startsWith('/api/')) return next()
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      if (!url.pathname.startsWith('/api/external-account-monitors')) { res.statusCode = 404; res.end('{}'); return }
      let input = ''
      for await (const chunk of req) input += chunk
      const body = input ? JSON.parse(input) : {}
      const id = url.pathname.split('/')[3]
      let data
      if (req.method === 'POST') {
        if (rows.some(row => row.profile_url === body.profile_url)) { res.statusCode = 409; res.end(JSON.stringify({code:40900,msg:'该外部账号已添加'})); return }
        data = { ...rows[0], ...body, id: `fixture-${rows.length + 1}`, profile: {}, status: 'pending' }; rows.push(data)
      } else if (req.method === 'PUT') {
        const row = rows.find(row => row.id === id)
        if (!row || row.version !== body.expected_version) { res.statusCode = 409; res.end(JSON.stringify({code:40900,msg:'配置已变化'})); return }
        Object.assign(row, body, { version: row.version + 1, status: body.enabled ? 'pending' : 'paused' }); data = row
      } else if (id) {
        const allPosts = Array.from({length:21}, (_,i) => ({ source_key:`post-${i + 1}`, content_url:`https://x.com/example/status/${i + 1}`, updated_at:now,
          report:{text_content:`第 ${i + 1} 条模拟帖子。` + '这是用于验证长正文换行和只读详情的模拟帖子。'.repeat(14),
            media_urls:i === 0 ? ['http://127.0.0.1:5198/favicon.svg'] : [], metrics:{like_count: i === 1 ? null : 15,comment_count:i === 0 ? 15 : 0},published_at:now,
            comments:i === 0 ? Array.from({length:13},(_,j)=>({author_name:`Reader ${j + 1}`,content:j === 1 ? '这是回复第一条评论的内容。\n保留换行，清晰区分回复对象。' : `第 ${j + 1} 条评论：这是用于验证作者、正文与互动层次的示例。`,platform_comment_id:`c${j + 1}`,parent_platform_comment_id:j === 1 ? 'c1' : null,commented_at:now,like_count:j,reply_count:j === 0 ? 1 : 0,
              platform_metadata: {author_avatar_url:'http://127.0.0.1:5198/favicon.svg',media_urls:j === 0 ? ['http://127.0.0.1:5198/favicon.svg'] : j === 1 ? ['http://127.0.0.1:5198/missing-image.jpg'] : []}
            })) : []} }))
        const start = (Number(url.searchParams.get('page') || 1) - 1) * 20
        data = { monitor: rows.find(row => row.id === id), total: allPosts.length, posts: allPosts.slice(start, start + 20), snapshots:[{captured_at:now,metrics:{followers_count:1234,following_count:0,posts_count:78,collected_post_count:21,collected_like_count:15,collected_comment_count:1}}] }
      } else {
        const filtered = rows.filter(row => (!url.searchParams.get('platform') || row.business_platform === url.searchParams.get('platform')) && (!url.searchParams.get('status') || row.status === url.searchParams.get('status')) && (!url.searchParams.get('keyword') || `${row.profile_url} ${row.remark}`.includes(url.searchParams.get('keyword'))))
        data = {items:filtered,total:filtered.length}
      }
      res.end(JSON.stringify({code:0,msg:'ok',data}))
    })
  } }],
})
await server.listen()
console.log('Isolated UI: http://127.0.0.1:5198/__external_preview')
