// Isolated UI fixture: every API is intercepted, no real tasks or accounts.
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../', import.meta.url))
const devices = Array.from({length:10},(_,i)=>({id:`s${i}`,display_name:`VMOS-Test-${i+1}`,provider_slot_id:`phone-${i+1}`,status:'idle',runtime_platform:'cloud_phone',provider:'vmos'}))
const accounts = Array.from({length:50},(_,i)=>({id:`a${i}`,username:`Test-Account-${i+1}`,business_platform:'threads',login_status:['logged_in','not_logged_in','unknown'][i%3],tag_ids:[i%2?'t1':'t2'],tag_names:[i%2?'日常维护':'新号']}))
let rows=[]
const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><title>云手机养号隔离验证</title></head><body><div id="app"></div><script type="module">
import {createApp} from 'vue';import {createPinia} from 'pinia';import {useAuthStore} from '/src/stores/auth.ts';
import View from '/src/views/AccountWarmupView.vue';import '/node_modules/element-plus/dist/index.css';
const app=createApp(View),pinia=createPinia();app.use(pinia);useAuthStore(pinia).user={id:'fixture',roles:['super_admin'],permissions:['account_warmup.view','account_warmup.create','account_warmup.edit'],business_platform_scope:null};app.mount('#app');
</script><style>body{font-family:Arial,sans-serif;margin:16px;color:#243746;background:#f6f8fa}*{box-sizing:border-box}</style></body></html>`
const server=await createServer({root,cacheDir:`${root}/node_modules/.vite-cloud-warmup-preview`,server:{host:'127.0.0.1',port:5196,strictPort:true},plugins:[{name:'warmup-fixture',configureServer(server){server.middlewares.use(async(req,res,next)=>{
  const url=new URL(req.url||'/','http://localhost')
  if(url.pathname==='/__warmup_preview'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(await server.transformIndexHtml(req.url,html));return}
  if(!url.pathname.startsWith('/api/'))return next()
  let data={items:[],total:0,page:1,page_size:100}
  if(url.pathname==='/api/account-warmup/plans'){
    if(req.method==='POST'){let body='';for await(const chunk of req)body+=chunk;const input=JSON.parse(body);rows.push({...input,id:'fixture-plan',status:'draft',member_total:0,running_total:0,pending_review_total:0,completed_total:0,abnormal_total:0,created_at:new Date().toISOString()});data=rows.at(-1)}
    else data={...data,items:rows,total:rows.length}
  } else if(url.pathname==='/api/accounts/selection-options')data=accounts
  else if(url.pathname.endsWith('/selection-groups'))data={total:10,groups:[{id:'g',name:'云手机测试组',device_count:10}]}
  else if(url.pathname.endsWith('/selection-page'))data={items:devices,total:10,page:1,page_size:100}
  else if(url.pathname.endsWith('/selection-ids'))data={slot_ids:devices.map(d=>d.id),total:10}
  res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify({code:0,msg:'ok',data}))
})}}]})
await server.listen()
console.log('http://127.0.0.1:5196/__warmup_preview')
