<script setup lang="ts">
import { computed,onBeforeUnmount,onMounted,reactive,ref,watch } from 'vue'
import { ElMessage,ElMessageBox } from 'element-plus'
import { Check,ExternalLink,Eye,RefreshCw,Search,X,UserRound } from 'lucide-vue-next'
import { accountDiscovery,discoveryPlatforms,discoveryStatus,type DiscoveryCandidate,type DiscoveryCandidateDetail,type DiscoveryPreview } from '@/api/accountDiscovery'
import { useAuthStore } from '@/stores/auth'
import { safeSelectionLink,selectionIsVideo } from '@/utils/contentSelection'
import { formatDate } from '@/utils/format'

const props=defineProps<{planId?:string}>()
const auth=useAuthStore()
const loading=ref(false),busy=ref(false),error=ref(''),rows=ref<DiscoveryCandidate[]>([]),total=ref(0),page=ref(1)
const selected=ref<DiscoveryCandidate[]>([])
const filters=reactive({status:'pending_review',platform:'',keyword:''})
const countries=ref<string[]>([])
const detailVisible=ref(false),detailLoading=ref(false),detailError=ref(''),detail=ref<DiscoveryCandidateDetail|null>(null)
const reviewVisible=ref(false),reviewError=ref(''),previewLoading=ref(false),preview=ref<DiscoveryPreview|null>(null)
const country=ref<string|undefined>(undefined),note=ref(''),reviewRows=ref<DiscoveryCandidate[]>([])
let request=0,detailRequest=0,previewRequest=0,disposed=false
const canReview=computed(()=>auth.can('operations.edit')&&auth.can('operations.review'))
const actionable=(row:{status:string})=>!['existing','monitored','rejected'].includes(row.status)
const label=(value:string)=>discoveryStatus[value]||value
async function load(reset=false) {
  if(reset)page.value=1
  const id=++request;loading.value=true;error.value='';selected.value=[]
  try {
    const result=await accountDiscovery.candidates({...filters,plan_id:props.planId,page:page.value,page_size:20})
    if(id===request){rows.value=result.items;total.value=result.total}
  }catch(e){if(id===request)error.value=e instanceof Error?e.message:'候选加载失败'}
  finally{if(id===request)loading.value=false}
}
async function openDetail(value:unknown){
  const row=value as DiscoveryCandidate
  const id=++detailRequest;detailVisible.value=true;detailLoading.value=true;detailError.value='';detail.value=null
  try{const result=await accountDiscovery.candidate(row.id);if(id===detailRequest)detail.value=result}
  catch(e){if(id===detailRequest)detailError.value=e instanceof Error?e.message:'作者详情加载失败'}
  finally{if(id===detailRequest)detailLoading.value=false}
}
function body(action:string){return {action,items:reviewRows.value.map(row=>({id:row.id,version:row.version})),country:country.value,note:note.value}}
async function loadPreview(){
  const id=++previewRequest;previewLoading.value=true;reviewError.value='';preview.value=null
  try{const result=await accountDiscovery.preview(body('approve'));if(id===previewRequest)preview.value=result}
  catch(e){if(id===previewRequest)reviewError.value=e instanceof Error?e.message:'审核预检失败'}
  finally{if(id===previewRequest)previewLoading.value=false}
}
async function openReview(values:DiscoveryCandidate[]){
  reviewRows.value=values;country.value=undefined;note.value='';reviewVisible.value=true;await loadPreview()
}
async function approve(){
  if(busy.value||previewLoading.value||!preview.value?.allowed)return
  busy.value=true;reviewError.value=''
  try{await accountDiscovery.review(body('approve'));reviewVisible.value=false;detailVisible.value=false;ElMessage.success('审核完成，已有监听配置保持不变');await load()}
  catch(e){reviewError.value=e instanceof Error?e.message:'审核失败，未添加本批账号';preview.value=null}
  finally{busy.value=false}
}
async function reject(values:DiscoveryCandidate[]){
  try{await ElMessageBox.confirm(`确认拒绝这 ${values.length} 位作者？`,'拒绝候选',{type:'warning'})}catch{return}
  busy.value=true
  try{await accountDiscovery.review({action:'reject',items:values.map(row=>({id:row.id,version:row.version})),note:''});detailVisible.value=false;await load();ElMessage.success('已拒绝，本计划不会自动重新推入待审')}
  catch(e){ElMessage.error(e instanceof Error?e.message:'拒绝失败')}
  finally{busy.value=false}
}
async function refreshAuthors(values:DiscoveryCandidate[]){
  busy.value=true
  try{await accountDiscovery.review({action:'refresh',items:values.map(row=>({id:row.id,version:row.version}))});detailVisible.value=false;await load();ElMessage.success('已登记资料刷新，不重新搜索成功页面')}
  catch(e){ElMessage.error(e instanceof Error?e.message:'刷新资料失败')}
  finally{busy.value=false}
}
watch(()=>props.planId,()=>void load(true))
defineExpose({refresh:()=>load()})
onMounted(async()=>{
  await load()
  try{const options=await accountDiscovery.options();if(!disposed)countries.value=options.countries}catch{ /* 主列表独立可用。 */ }
})
onBeforeUnmount(()=>{disposed=true;request++;detailRequest++;previewRequest++})
</script>

<template>
  <section class="discovery-candidates">
    <div class="candidate-controls">
      <el-select v-model="filters.status" aria-label="候选审核状态" @change="load(true)" clearable placeholder="全部状态"><el-option v-for="value in ['pending_review','pending_metadata','filtered','monitored','existing','rejected']" :key="value" :value="value" :label="label(value)" /></el-select>
      <el-select v-model="filters.platform" aria-label="候选平台" @change="load(true)" clearable placeholder="全部平台"><el-option v-for="(name,value) in discoveryPlatforms" :key="value" :value="value" :label="name" /></el-select>
      <el-input v-model="filters.keyword" placeholder="账号 / 计划" clearable @keyup.enter="load(true)" @clear="load(true)" />
      <el-button :icon="Search" type="primary" :loading="loading" @click="load(true)">查询</el-button>
      <el-tooltip content="刷新候选列表"><el-button :icon="RefreshCw" circle aria-label="刷新候选列表" :disabled="loading" @click="load()" /></el-tooltip>
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <div class="candidate-batch">
      <span>已选择 {{ selected.length }} 位作者</span>
      <el-button v-if="canReview" :icon="Check" type="primary" :disabled="!selected.length||busy" @click="openReview(selected)">审核加入监听</el-button>
      <el-button v-if="auth.can('operations.edit')" :icon="RefreshCw" :disabled="!selected.length||busy" @click="refreshAuthors(selected)">刷新资料</el-button>
      <el-button v-if="canReview" :icon="X" type="danger" plain :disabled="!selected.length||busy" @click="reject(selected)">拒绝</el-button>
    </div>
    <el-table :data="rows" v-loading="loading" row-key="id" @selection-change="selected=$event" empty-text="暂无符合筛选条件的作者">
      <el-table-column type="selection" width="44" :selectable="actionable" />
      <el-table-column label="候选作者" min-width="220"><template #default="{row}"><div class="candidate-author"><el-avatar :src="safeSelectionLink(row.profile.avatar_url)"><UserRound :size="20" /></el-avatar><div><strong>{{ row.profile.display_name||row.username }}</strong><a :href="safeSelectionLink(row.profile_url)" target="_blank" rel="noopener noreferrer">@{{ row.username }}</a></div></div></template></el-table-column>
      <el-table-column label="平台" width="120"><template #default="{row}">{{ discoveryPlatforms[row.platform] }}</template></el-table-column>
      <el-table-column label="粉丝" width="105"><template #default="{row}">{{ row.profile.followers_count==null?'未知':Number(row.profile.followers_count).toLocaleString('zh-CN') }}</template></el-table-column>
      <el-table-column label="合格命中" width="100"><template #default="{row}">{{ row.hit_count }} 篇</template></el-table-column>
      <el-table-column label="来源计划" prop="plan_name" min-width="140" show-overflow-tooltip />
      <el-table-column label="状态" width="130"><template #default="{row}"><el-tag :type="row.status==='pending_review'?'success':row.status==='pending_metadata'?'warning':'info'">{{ label(row.status) }}</el-tag></template></el-table-column>
      <el-table-column label="判定原因" min-width="220"><template #default="{row}">{{ row.reasons?.join('；')||'条件已满足，等待人工决定' }}</template></el-table-column>
      <el-table-column label="操作" width="90" fixed="right"><template #default="{row}"><el-tooltip content="查看作者证据"><el-button :icon="Eye" circle aria-label="查看作者证据" @click="openDetail(row)" /></el-tooltip></template></el-table-column>
    </el-table>
    <el-pagination v-model:current-page="page" :page-size="20" :total="total" :disabled="loading" background layout="total,prev,pager,next" @current-change="load()" />

    <el-dialog v-model="detailVisible" title="候选作者" width="min(980px,calc(100vw - 32px))" align-center :close-on-click-modal="false" @closed="detailRequest++">
      <div v-loading="detailLoading" class="candidate-detail">
        <el-alert v-if="detailError" :title="detailError" type="error" :closable="false" />
        <template v-if="detail">
          <h3>{{ detail.candidate.profile.display_name||detail.candidate.username }} <el-tag>{{ label(detail.candidate.status) }}</el-tag></h3>
          <a :href="safeSelectionLink(detail.candidate.profile_url)" target="_blank" rel="noopener noreferrer">打开主页 <ExternalLink :size="13" /></a>
          <p>{{ detail.candidate.profile.biography||'暂无简介' }}</p>
          <el-descriptions :column="2" size="small"><el-descriptions-item label="粉丝">{{ detail.candidate.profile.followers_count??'未知' }}</el-descriptions-item><el-descriptions-item label="国家">{{ detail.candidate.profile.confirmed_country||'未知，未推测' }}</el-descriptions-item><el-descriptions-item label="资料时间">{{ detail.candidate.profile_checked_at?formatDate(detail.candidate.profile_checked_at):'尚未确认' }}</el-descriptions-item><el-descriptions-item label="来源计划">{{ detail.plan.name }}</el-descriptions-item></el-descriptions>
          <el-alert v-if="detail.stale_rules" title="计划规则或关键词已更新，请刷新资料后重新判定" type="warning" :closable="false" />
          <el-alert v-if="detail.candidate.reasons.length" :title="detail.candidate.reasons.join('；')" :type="detail.candidate.status==='filtered'?'error':'warning'" :closable="false" />
          <h3>命中帖子</h3>
          <article v-for="post in detail.posts" :key="post.platform_post_id" class="candidate-post">
            <div><el-tag v-for="word in post.keywords" :key="word" size="small">{{ word }}</el-tag><a :href="safeSelectionLink(post.content_url)" target="_blank" rel="noopener noreferrer">原帖 <ExternalLink :size="12" /></a></div>
            <p>{{ post.text_content }}</p>
            <small v-if="post.retrieval_mode==='hashtag'">检索来源标签：{{ (post.retrieval_tags||(post.retrieval_tag?[post.retrieval_tag]:[])).map(tag=>'#'+tag).join('、')||'未确认' }}（不代表正文必然包含该词）</small>
            <el-tag v-if="post.verdict" :type="post.verdict==='qualified'?'success':'warning'">{{ label(post.verdict) }}</el-tag><small v-if="post.reasons?.length">{{ post.reasons.join('；') }}</small>
            <small>{{ post.published_at?formatDate(post.published_at):'发布时间未知' }} · 浏览 {{ post.views_count??'未知' }} · 点赞 {{ post.likes_count??'未知' }} · 评论 {{ post.comments_count??'未知' }}</small>
            <div v-if="post.media_urls.length" class="candidate-media"><template v-for="url in post.media_urls" :key="url"><video v-if="selectionIsVideo(url)" :src="safeSelectionLink(url)" controls preload="none" /><el-image v-else :src="safeSelectionLink(url)" fit="contain" loading="lazy" :preview-src-list="post.media_urls.filter((item:string)=>!selectionIsVideo(item))" preview-teleported /></template></div>
            <small v-if="post.media_pending">{{ post.media_pending }} 项媒体尚未缓存</small>
          </article>
        </template>
      </div>
      <template #footer><el-button @click="detailVisible=false">关闭</el-button><el-button v-if="detail&&actionable(detail.candidate)&&auth.can('operations.edit')" :icon="RefreshCw" :loading="busy" @click="refreshAuthors([detail.candidate])">刷新资料</el-button><el-button v-if="detail&&actionable(detail.candidate)&&canReview" type="primary" :icon="Check" :disabled="busy" @click="openReview([detail.candidate])">审核加入监听</el-button></template>
    </el-dialog>

    <el-dialog v-model="reviewVisible" title="加入监听预检" width="min(820px,calc(100vw - 32px))" align-center :close-on-click-modal="false" :show-close="!busy" :close-on-press-escape="!busy" @closed="previewRequest++">
      <el-form label-width="100px" @submit.prevent>
        <el-form-item label="人工确认国家"><el-select v-model="country" filterable clearable placeholder="不额外确认" @change="loadPreview"><el-option v-for="value in countries" :key="value" :value="value" :label="value" /></el-select></el-form-item>
        <el-form-item label="审核备注"><el-input v-model="note" type="textarea" :rows="2" maxlength="1000" /></el-form-item>
      </el-form>
      <el-alert v-if="reviewError" :title="reviewError" type="error" :closable="false" />
      <el-table :data="preview?.items||[]" v-loading="previewLoading"><el-table-column label="账号" prop="username" min-width="140" /><el-table-column label="结果" width="110"><template #default="{row}"><el-tag :type="row.allowed?'success':'warning'">{{ row.existing?'已存在监听':row.allowed?'可以新增':'不能加入' }}</el-tag></template></el-table-column><el-table-column label="原因" min-width="220"><template #default="{row}">{{ row.reasons.join('；')||(row.existing?'仅关联，保留原配置':'条件已满足') }}</template></el-table-column></el-table>
      <template #footer><el-button :disabled="busy" @click="reviewVisible=false">取消</el-button><el-button :icon="RefreshCw" :loading="previewLoading" :disabled="busy" @click="loadPreview">重新预检</el-button><el-button type="primary" :icon="Check" :loading="busy" :disabled="previewLoading||!preview?.allowed" @click="approve">确认加入监听</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.candidate-controls,.candidate-batch{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:14px}.candidate-controls .el-select{width:145px}.candidate-controls .el-input{width:220px;max-width:100%}.candidate-batch{padding:10px 0;border-top:1px solid var(--app-border,#dce3eb)}.candidate-batch>span{margin-right:auto;font-size:13px}.candidate-author{display:flex;align-items:center;gap:10px;min-width:0}.candidate-author>div{display:flex;flex-direction:column;min-width:0;overflow-wrap:anywhere}.candidate-author a{font-size:12px;color:var(--el-color-primary)}.el-pagination{margin-top:16px;overflow-x:auto}.candidate-detail{min-height:140px;max-height:65vh;overflow-y:auto;overflow-wrap:anywhere}.candidate-detail h3{font-size:15px;display:flex;align-items:center;gap:10px}.candidate-detail p{white-space:pre-wrap;line-height:1.65}.candidate-detail a{display:inline-flex;align-items:center;gap:5px;color:var(--el-color-primary)}.candidate-post{padding:14px 0;border-top:1px solid var(--app-border,#dce3eb)}.candidate-post>div:first-child{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.candidate-post a{margin-left:auto}.candidate-post small{color:var(--app-text-muted,#687786)}.candidate-media{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:10px;margin-top:10px}.candidate-media video,.candidate-media .el-image{width:100%;height:220px;object-fit:contain}.el-form .el-select{width:100%}:deep(.el-button>span){gap:5px}@media(max-width:600px){.candidate-controls .el-input{flex:1;min-width:160px}.candidate-controls .el-select{flex:1;min-width:130px}}
</style>
