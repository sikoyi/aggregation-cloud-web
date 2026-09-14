// Loopback-only component fixture; no real backend or Telegram calls.
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../', import.meta.url))
let bound = false
const html = `<!doctype html><html lang="zh-CN"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>TG审核绑定测试</title></head><body><div id="app"></div><script type="module">
import {createApp} from 'vue'; import {createPinia} from 'pinia';
import Component from '/src/components/TelegramReviewBinding.vue'; import {useAuthStore} from '/src/stores/auth.ts';
import '/node_modules/element-plus/dist/index.css';
const app=createApp(Component),pinia=createPinia();app.use(pinia);
useAuthStore(pinia).user={id:'fixture',username:'fixture',roles:['operator'],permissions:location.search.includes('readonly')?['operations.view']:['operations.review','operations.view']};app.mount('#app');
</script><style>body{font-family:Arial,sans-serif;margin:24px;color:#243746;background:#f6f8fa}*{box-sizing:border-box}</style></body></html>`
const server = await createServer({root,cacheDir:`${root}/node_modules/.vite-tg-preview`,server:{host:'127.0.0.1',port:5199,strictPort:true},plugins:[{
  name:'isolated-tg-fixture',configureServer(server){server.middlewares.use(async(req,res,next)=>{
    const url=new URL(req.url||'/','http://localhost')
    if(url.pathname==='/__tg_preview'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(await server.transformIndexHtml(req.url,html));return}
    if(!url.pathname.startsWith('/api/'))return next()
    res.setHeader('Content-Type','application/json; charset=utf-8')
    if(!url.pathname.startsWith('/api/telegram-review/')){res.statusCode=404;res.end('{}');return}
    let data
    if(req.method==='POST'){
      data={url:'https://t.me/fixture_review_bot?start=fixture_not_a_real_binding',expires_at:new Date(Date.now()+600000).toISOString()}
    }else if(req.method==='DELETE'){bound=false;data={}}
    else{data={configured:true,bot_username:'fixture_review_bot',bound,telegram_user_id:bound?'123456789':null,bound_at:bound?new Date().toISOString():null,last_error:null}}
    res.end(JSON.stringify({code:0,msg:'ok',data}))
  })}
}]})
await server.listen()
console.log('Isolated UI: http://127.0.0.1:5199/__tg_preview')
