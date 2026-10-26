<script setup lang="ts">
import { computed,onBeforeUnmount,onMounted,reactive,ref,watch } from 'vue'
import { ElMessage,ElMessageBox } from 'element-plus'
import { Check,ChevronRight,Eye,FileSearch,Pause,Play,Plus,RefreshCw,Save,Search,Trash2,X } from 'lucide-vue-next'
import { accountDiscovery,discoveryDefaults,discoveryPlatforms,discoveryStatus,type DiscoveryCapability,type DiscoveryKeyword,type DiscoveryPlan,type DiscoveryPlanDetail,type DiscoveryConfig,type DiscoverySeed,type DiscoveryVersionOption,type DiscoveryKeywordVersion,type DiscoveryRun,type DiscoverySearch,type DiscoveryEvidence,type DiscoverySample } from '@/api/accountDiscovery'
import { useAuthStore } from '@/stores/auth'
import { formatDate } from '@/utils/format'
import { safeSelectionLink } from '@/utils/contentSelection'
import AccountDiscoveryCandidates from '@/components/AccountDiscoveryCandidates.vue'

interface KeywordRow extends DiscoveryKeyword { _key:string }
const auth=useAuthStore(),canEdit=computed(()=>auth.can('operations.edit')),canReview=computed(()=>canEdit.value&&auth.can('operations.review'))
const loading=ref(false),error=ref(''),rows=ref<DiscoveryPlan[]>([]),total=ref(0),page=ref(1),keyword=ref('')
const capabilities=ref<DiscoveryCapability[]>([]),countries=ref<string[]>([]),tags=ref<{id:string;name:string}[]>([])
const visible=ref(false),detailLoading=ref(false),busy=ref(false),detailError=ref(''),activeTab=ref('config'),planId=ref<string>(),detail=ref<DiscoveryPlanDetail|null>(null)
const form=reactive<{name:string;config:DiscoveryConfig}>({name:'',config:discoveryDefaults()})
const baseline=ref(''),planVersion=ref(1),seedOptions=ref<DiscoverySeed[]>([]),seedLoading=ref(false)
const creationKey=ref('')
const sections=ref(['scope','rules'])
const keywordVersions=ref<DiscoveryVersionOption[]>([]),keywordTotal=ref(0),versionPage=ref(1),keywordId=ref(''),keywordLoading=ref(false),keywordError=ref('')
const keywordVersion=ref<DiscoveryKeywordVersion|null>(null),words=ref<KeywordRow[]>([]),keywordPage=ref(1),wordInput=ref(''),wordBaseline=ref('[]')
const runs=ref<DiscoveryRun[]>([]),runTotal=ref(0),runPage=ref(1)
const searchesVisible=ref(false),searchesLoading=ref(false),searchesError=ref(''),searchRows=ref<DiscoverySearch[]>([]),searchTotal=ref(0),searchPage=ref(1),searchRun=ref<DiscoveryRun|null>(null)
const evidenceVisible=ref(false),evidencePosts=ref<DiscoveryEvidence[]>([])
const sampleRows=ref<DiscoverySample[]>([]),sampleSkipped=ref(false)
let request=0,detailRequest=0,wordRequest=0,seedRequest=0,searchRequest=0,runRequest=0,versionRequest=0,disposed=false
let timer:ReturnType<typeof setInterval>|undefined
const label=(value:string)=>discoveryStatus[value]||value
const dirty=computed(()=>JSON.stringify({name:form.name,config:form.config})!==baseline.value)
const wordPayload=()=>words.value.map(({_key,...row})=>row)
const wordsDirty=computed(()=>JSON.stringify(wordPayload())!==wordBaseline.value)
const editableKeywords=computed(()=>canEdit.value&&keywordVersion.value?.status==='draft')
const pageWords=computed(()=>words.value.slice((keywordPage.value-1)*50,keywordPage.value*50))
const enabledWords=computed(()=>words.value.filter(row=>row.enabled).length)
const unavailable=computed(()=>capabilities.value.filter(row=>form.config.platforms.includes(row.platform)&&!row.enabled).map(row=>discoveryPlatforms[row.platform]))
function showError(e:unknown){return e instanceof Error?e.message:'请求失败'}
async function load(reset=false){
  if(reset)page.value=1
  const id=++request;loading.value=true;error.value=''
  try{const result=await accountDiscovery.plans({page:page.value,page_size:20,keyword:keyword.value});if(id===request){rows.value=result.items;total.value=result.total}}
  catch(e){if(id===request)error.value=showError(e)}finally{if(id===request)loading.value=false}
}
async function loadOptions(){
  try{const result=await accountDiscovery.options();if(disposed)return;countries.value=result.countries;tags.value=result.tags;capabilities.value=await accountDiscovery.capabilities()}
  catch(e){if(!disposed)error.value=showError(e)}
}
function setForm(plan?:DiscoveryPlan){
  form.name=plan?.name||'';form.config=plan?JSON.parse(JSON.stringify(plan.config)):discoveryDefaults()
  form.config.schedule_time=form.config.schedule_time.slice(0,5)
  planVersion.value=plan?.version||1;baseline.value=JSON.stringify({name:form.name,config:form.config})
}
async function openPlan(value?:unknown,tab='config'){
  const row=value as {id:string}|undefined
  const id=++detailRequest;wordRequest++;runRequest++;versionRequest++;detailError.value='';visible.value=true;activeTab.value=tab
  planId.value=row?.id;detail.value=null;keywordId.value='';keywordVersion.value=null;words.value=[];wordBaseline.value='[]';keywordVersions.value=[];runs.value=[];versionPage.value=1;runPage.value=1
  detailLoading.value=!!row
  if(!row){creationKey.value=crypto.randomUUID();setForm();return}
  detailLoading.value=true
  try{const result=await accountDiscovery.plan(row.id);if(id!==detailRequest)return;detail.value=result;setForm(result.plan);keywordVersions.value=result.keyword_versions;keywordTotal.value=result.keyword_total;runs.value=result.runs.items;runTotal.value=result.runs.total;if(tab==='keywords')await loadKeyword()}
  catch(e){if(id===detailRequest)detailError.value=showError(e)}finally{if(id===detailRequest)detailLoading.value=false}
}
async function closePlan(done:()=>void){
  if(busy.value)return
  if(dirty.value||wordsDirty.value){try{await ElMessageBox.confirm('存在未保存的修改，确认关闭？','未保存修改',{type:'warning'})}catch{return}}
  done()
}
async function save(){
  if(busy.value||!form.name.trim())return
  busy.value=true;detailError.value=''
  try{const saved=await accountDiscovery.savePlan(planId.value,{name:form.name,config:form.config,expected_version:planId.value?planVersion.value:undefined,request_key:planId.value?undefined:creationKey.value});await openPlan(saved);await load();ElMessage.success('计划已保存')}
  catch(e){detailError.value=showError(e)}finally{busy.value=false}
}
async function reloadDetail(){
  if(!planId.value)return
  if(dirty.value||wordsDirty.value){try{await ElMessageBox.confirm('重新加载将丢弃当前未保存的修改，确认继续？','重新加载',{type:'warning'})}catch{return}}
  await openPlan({id:planId.value},activeTab.value)
}
async function start(action:'analyze'|'search'){
  if(!planId.value||busy.value||dirty.value||wordsDirty.value)return
  try{await ElMessageBox.confirm(action==='analyze'?'将使用已采集样本分析关键词，会消耗 AI Token，确认开始？':'将使用已审核关键词调用协议搜索，会消耗协议额度，确认开始？',action==='analyze'?'分析关键词':'开始搜索',{type:'warning'})}catch{return}
  busy.value=true;detailError.value=''
  try{await accountDiscovery.start(planId.value,{action,expected_version:planVersion.value,request_key:crypto.randomUUID()});await openPlan({id:planId.value},'runs');await load()}
  catch(e){detailError.value=showError(e)}finally{busy.value=false}
}
async function control(value:unknown,action:'pause'|'resume'|'cancel'){
  const run=value as DiscoveryRun
  if(!planId.value||busy.value)return
  try{await ElMessageBox.confirm(action==='resume'?(run.kind==='analyze'?'将保留成功批次和累计用量，仅继续未完成阶段，并追加 Token 保护额度，确认继续？':'仅继续未完成的协议阶段，成功页面与候选保留；会使用协议额度，确认继续？'):action==='pause'?'暂停本轮并关闭定时执行，已有结果保留？':'停止本轮并关闭定时执行，已有结果保留？',action==='resume'?'从断点继续':action==='pause'?'暂停运行':'停止运行',{type:'warning'})}catch{return}
  busy.value=true
  try{await accountDiscovery.control(planId.value,run.id,{action,expected_version:planVersion.value,request_key:crypto.randomUUID()});await loadRuns();await load()}
  catch(e){detailError.value=showError(e)}finally{busy.value=false}
}
async function toggleSchedule(value:unknown,enabled:boolean){
  const row=value as DiscoveryPlan
  if(busy.value)return
  if(enabled){try{await ElMessageBox.confirm(`将每天北京时间 ${row.config.schedule_time.slice(0,5)} 使用已审核关键词搜索，确认开启？`,'开启定时发现',{type:'warning'})}catch{return}}
  busy.value=true
  try{await accountDiscovery.schedule(row.id,{enabled,expected_version:row.version});await load()}
  catch(e){ElMessage.error(showError(e))}finally{busy.value=false}
}
async function findSeeds(value=''){
  const id=++seedRequest;seedLoading.value=true
  try{const result=await accountDiscovery.seedOptions(value);if(id===seedRequest)seedOptions.value=result}
  catch(e){detailError.value=showError(e)}finally{if(id===seedRequest)seedLoading.value=false}
}
async function loadVersions(){
  if(!planId.value)return
  const id=++versionRequest;const current=planId.value
  try{const result=await accountDiscovery.keywordVersions(current,{page:versionPage.value,page_size:20});if(id!==versionRequest||disposed||current!==planId.value)return;keywordVersions.value=result.items;keywordTotal.value=result.total}
  catch(e){keywordError.value=showError(e)}
}
async function loadKeyword(){
  if(!planId.value)return
  if(!keywordId.value)keywordId.value=keywordVersions.value[0]?.id||''
  if(!keywordId.value)return
  const id=++wordRequest;keywordLoading.value=true;keywordError.value=''
  try{const result=await accountDiscovery.keyword(planId.value,keywordId.value);if(id!==wordRequest)return;keywordVersion.value=result;words.value=result.items.map((row:DiscoveryKeyword)=>({...row,_key:crypto.randomUUID()}));keywordPage.value=1;wordBaseline.value=JSON.stringify(wordPayload())}
  catch(e){if(id===wordRequest)keywordError.value=showError(e)}finally{if(id===wordRequest)keywordLoading.value=false}
}
async function changeKeyword(value:string){
  if(wordsDirty.value){try{await ElMessageBox.confirm('切换版本将丢弃未保存的关键词修改，确认继续？','切换版本',{type:'warning'})}catch{keywordId.value=keywordVersion.value?.id||'';return}}
  keywordId.value=value;await loadKeyword()
}
async function reloadKeyword(){
  if(wordsDirty.value){try{await ElMessageBox.confirm('重新加载将丢弃未保存的关键词修改，确认继续？','重新加载',{type:'warning'})}catch{return}}
  await loadKeyword()
}
watch(activeTab,value=>{if(value==='keywords'&&!keywordVersion.value)void loadKeyword()})
watch(()=>words.value.length,length=>{keywordPage.value=Math.max(1,Math.min(keywordPage.value,Math.ceil(length/50)))})
function addWord(){
  if(!wordInput.value.trim()||!editableKeywords.value)return
  words.value.push({_key:crypto.randomUUID(),text:wordInput.value.trim(),language:'',evidence_ids:[],enabled:true,source:'manual'});wordInput.value='';keywordPage.value=Math.ceil(words.value.length/50)
}
function showEvidence(value:unknown){
  const word=value as KeywordRow
  const source=new Map<string,DiscoveryEvidence>((keywordVersion.value?.evidence||[]).map(item=>[item.id,item]))
  evidencePosts.value=word.evidence_ids.map(id=>source.get(id)||{id,text_content:'本轮引用记录不可用'});evidenceVisible.value=true
}
async function saveWords(approve=false){
  if(!planId.value||!keywordVersion.value||busy.value)return
  if(approve){try{await ElMessageBox.confirm(`确认审核通过 ${enabledWords.value} 个启用关键词？审核后该版本不能直接修改。`,'审核关键词',{type:'warning'})}catch{return}}
  busy.value=true;keywordError.value=''
  try{const result=await accountDiscovery.saveKeywords(planId.value,keywordVersion.value.id,{expected_version:keywordVersion.value.version,items:wordPayload(),approve});keywordVersion.value={...keywordVersion.value,...result};words.value=result.items.map((item:DiscoveryKeyword)=>({...item,_key:crypto.randomUUID()}));wordBaseline.value=JSON.stringify(wordPayload());detail.value!.plan.approved_keywords_id=approve?result.id:detail.value!.plan.approved_keywords_id;await loadVersions();await load();ElMessage.success(approve?'关键词已审核，尚未启动搜索':'关键词草案已保存')}
  catch(e){keywordError.value=showError(e)}finally{busy.value=false}
}
async function loadRuns(){
  if(!planId.value)return
  const id=++runRequest;const current=planId.value
  try{const result=await accountDiscovery.runs(current,{page:runPage.value,page_size:20});if(disposed||id!==runRequest||current!==planId.value)return;runs.value=result.items;runTotal.value=result.total;await loadVersions()}
  catch(e){detailError.value=showError(e)}
}
async function showSearches(value:unknown){const run=value as DiscoveryRun;searchRun.value=run;searchPage.value=1;searchesVisible.value=true;await loadSearches()}
async function loadSearches(){
  if(!planId.value||!searchRun.value)return
  const id=++searchRequest;searchesLoading.value=true;searchesError.value=''
  try{
    if(searchRun.value.kind==='analyze'){
      const result=await accountDiscovery.samples(planId.value,searchRun.value.id,{page:searchPage.value,page_size:50,skipped:sampleSkipped.value});if(id===searchRequest){sampleRows.value=result.items;searchTotal.value=result.total}
    }else{
      const result=await accountDiscovery.searches(planId.value,searchRun.value.id,{page:searchPage.value,page_size:50});if(id===searchRequest){searchRows.value=result.items;searchTotal.value=result.total}
    }
  }
  catch(e){if(id===searchRequest)searchesError.value=showError(e)}finally{if(id===searchRequest)searchesLoading.value=false}
}
onMounted(async()=>{await load();await loadOptions();timer=setInterval(()=>{if(!document.hidden&&visible.value&&activeTab.value==='runs'&&!busy.value)void loadRuns()},10000)})
defineExpose({refresh:()=>load()})
onBeforeUnmount(()=>{disposed=true;clearInterval(timer);request++;detailRequest++;wordRequest++;seedRequest++;searchRequest++;runRequest++;versionRequest++})
</script>

<template>
  <section class="discovery-plans">
    <div class="discovery-toolbar"><el-input v-model="keyword" placeholder="计划名称" clearable @keyup.enter="load(true)" @clear="load(true)" /><el-button type="primary" :icon="Search" :loading="loading" @click="load(true)">查询</el-button><el-tooltip content="刷新计划"><el-button :icon="RefreshCw" circle aria-label="刷新计划" :disabled="loading" @click="load()" /></el-tooltip><el-button v-if="canEdit" type="primary" :icon="Plus" class="create-plan" @click="openPlan()">新增发现计划</el-button></div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-table :data="rows" v-loading="loading" empty-text="暂无发现计划" row-key="id">
      <el-table-column label="计划" min-width="180"><template #default="{row}"><strong>{{ row.name }}</strong><small>版本 {{ row.version }}</small></template></el-table-column>
      <el-table-column label="平台" min-width="190"><template #default="{row}"><el-tag v-for="platform in row.config.platforms" :key="platform" size="small">{{ discoveryPlatforms[platform] }}</el-tag></template></el-table-column>
      <el-table-column label="最近运行" min-width="150"><template #default="{row}"><el-tag :type="row.latest_run?.partial?'warning':row.latest_run?.status==='failed'?'danger':'info'">{{ row.latest_run?.partial?'部分未完成':row.latest_run?label(row.latest_run.status):'尚未运行' }}</el-tag><small v-if="row.latest_run?.error_message">{{ row.latest_run.error_message }}</small></template></el-table-column>
      <el-table-column label="待审 / 待补资料" width="165"><template #default="{row}">{{ row.summary.pending_review||0 }} / {{ row.summary.pending_metadata||0 }}<small>条件不符 {{ row.summary.filtered||0 }} · 已拒绝 {{ row.summary.rejected||0 }}</small></template></el-table-column>
      <el-table-column label="已加入 / 已存在" width="140"><template #default="{row}">{{ row.summary.monitored||0 }} / {{ row.summary.existing||0 }}</template></el-table-column>
      <el-table-column label="定时执行" width="150"><template #default="{row}"><el-switch :model-value="row.enabled" :disabled="!canEdit||busy" :aria-label="`${row.name}定时执行`" @change="toggleSchedule(row,Boolean($event))" /><small>北京时间 {{ row.config.schedule_time.slice(0,5) }}</small><small v-if="row.summary.schedule_error">{{ row.summary.schedule_error }}</small></template></el-table-column>
      <el-table-column label="下次执行" min-width="170"><template #default="{row}">{{ row.next_run_at?formatDate(row.next_run_at):'未开启' }}</template></el-table-column>
      <el-table-column label="操作" width="90" fixed="right"><template #default="{row}"><el-tooltip content="查看计划"><el-button :icon="Eye" circle aria-label="查看计划" @click="openPlan(row)" /></el-tooltip></template></el-table-column>
    </el-table>
    <el-pagination v-model:current-page="page" :page-size="20" :total="total" :disabled="loading" layout="total,prev,pager,next" background @current-change="load()" />

    <el-dialog v-model="visible" class="discovery-plan-dialog" :title="planId?form.name||'发现计划':'新增发现计划'" width="min(1140px,calc(100vw - 32px))" align-center :close-on-click-modal="false" :before-close="closePlan">
      <div v-loading="detailLoading" class="plan-detail">
        <el-alert v-if="detailError" :title="detailError" type="error" :closable="false"><el-button v-if="planId" link type="primary" :icon="RefreshCw" @click="reloadDetail">重新加载</el-button></el-alert>
        <el-tabs v-model="activeTab"><el-tab-pane label="计划配置" name="config" /><el-tab-pane label="关键词审核" name="keywords" :disabled="!planId" /><el-tab-pane label="运行记录" name="runs" :disabled="!planId" /><el-tab-pane label="候选作者" name="candidates" :disabled="!planId" /></el-tabs>
        <el-form v-if="activeTab==='config'&&!detailLoading" label-width="132px" @submit.prevent="save" :disabled="!canEdit||busy">
          <el-form-item label="计划名称" required><el-input v-model="form.name" maxlength="100" /></el-form-item>
          <el-collapse v-model="sections">
            <el-collapse-item title="种子账号与采样" name="scope"><div class="plan-form-grid">
              <el-form-item label="搜索平台" required><el-checkbox-group v-model="form.config.platforms"><el-checkbox v-for="(name,value) in discoveryPlatforms" :key="value" :value="value">{{ name }}</el-checkbox></el-checkbox-group></el-form-item>
              <el-form-item label="种子账号标签"><el-select v-model="form.config.tag_ids" multiple filterable clearable placeholder="全部标签"><el-option v-for="item in tags" :key="item.id" :value="item.id" :label="item.name" /></el-select></el-form-item>
              <el-form-item label="种子账号国家"><el-select v-model="form.config.countries" multiple filterable clearable placeholder="全部国家"><el-option v-for="item in countries" :key="item" :value="item" :label="item" /></el-select></el-form-item>
              <el-form-item label="排除账号"><el-select v-model="form.config.exclude_monitor_ids" multiple filterable remote :remote-method="findSeeds" :loading="seedLoading" @visible-change="$event&&findSeeds()" placeholder="搜索账号"><el-option v-for="item in seedOptions" :key="item.id" :value="item.id" :label="`${item.name} · ${discoveryPlatforms[item.platform]}`" /></el-select></el-form-item>
              <el-form-item label="样本时间范围"><el-input-number v-model="form.config.sample_days" :min="1" :max="365" controls-position="right" /><span class="unit">天</span></el-form-item>
              <el-form-item label="每账号最多"><el-input-number v-model="form.config.per_account" :min="1" :max="100" controls-position="right" /><span class="unit">篇</span></el-form-item>
              <el-form-item label="种子账号上限"><el-input-number v-model="form.config.max_accounts" :min="1" :max="1000" controls-position="right" /></el-form-item>
              <el-form-item label="本轮样本上限"><el-input-number v-model="form.config.max_samples" :min="1" :max="2000" controls-position="right" /></el-form-item>
              <el-form-item label="分析已保存配图"><el-switch v-model="form.config.visual" /></el-form-item>
              <el-form-item label="AI 供应商"><el-select v-model="form.config.ai_provider"><el-option label="OpenAI" value="openai" /><el-option label="Claude" value="claude" /><el-option label="Gemini" value="gemini" /></el-select></el-form-item>
              <el-form-item label="Token 保护额度"><el-input-number v-model="form.config.max_tokens" :min="1000000" :max="50000000" :step="1000000" controls-position="right" /></el-form-item>
            </div></el-collapse-item>
            <el-collapse-item title="搜索范围与帖子条件" name="search"><div class="plan-form-grid">
              <el-form-item label="搜索最近"><el-input-number v-model="form.config.search_days" :min="1" :max="365" controls-position="right" /><span class="unit">天</span></el-form-item>
              <el-form-item label="每词每平台最多"><el-input-number v-model="form.config.max_pages" :min="1" :max="20" controls-position="right" /><span class="unit">页</span></el-form-item>
              <el-form-item label="启用关键词上限"><el-input-number v-model="form.config.max_keywords" :min="1" :max="200" controls-position="right" /></el-form-item>
              <el-form-item label="本轮作者评估上限"><el-input-number v-model="form.config.max_candidates" :min="1" :max="2000" controls-position="right" /></el-form-item>
              <el-form-item label="最低浏览量"><el-input-number v-model="form.config.rules.min_views" :min="0" :max="9007199254740991" controls-position="right" placeholder="不限" /></el-form-item>
              <el-form-item label="最低点赞"><el-input-number v-model="form.config.rules.min_likes" :min="0" :max="9007199254740991" controls-position="right" placeholder="不限" /></el-form-item>
              <el-form-item label="最低评论"><el-input-number v-model="form.config.rules.min_comments" :min="0" :max="9007199254740991" controls-position="right" placeholder="不限" /></el-form-item>
              <el-form-item label="帖子类型"><el-checkbox-group v-model="form.config.rules.media_types"><el-checkbox value="text">文字</el-checkbox><el-checkbox value="image">图片</el-checkbox><el-checkbox value="video">视频</el-checkbox></el-checkbox-group></el-form-item>
              <el-form-item label="仅原创主帖"><el-switch v-model="form.config.rules.original_only" /></el-form-item>
              <el-form-item label="正文或话题须命中"><el-switch v-model="form.config.rules.require_keyword_text" /></el-form-item>
              <el-form-item label="帖子语言"><el-select v-model="form.config.rules.languages" multiple filterable allow-create default-first-option clearable placeholder="不限"><el-option v-for="item in ['zh','en','ko','ja','th','vi','es','fr']" :key="item" :value="item" :label="item" /></el-select></el-form-item>
            </div></el-collapse-item>
            <el-collapse-item title="作者候选条件" name="rules"><div class="plan-form-grid">
              <el-form-item label="最低粉丝"><el-input-number v-model="form.config.rules.min_followers" :min="0" :max="9007199254740991" controls-position="right" placeholder="不限" /></el-form-item>
              <el-form-item label="最高粉丝"><el-input-number v-model="form.config.rules.max_followers" :min="0" :max="9007199254740991" controls-position="right" placeholder="不限" /></el-form-item>
              <el-form-item label="至少命中合格帖"><el-input-number v-model="form.config.rules.min_hits" :min="1" :max="100" controls-position="right" /><span class="unit">篇</span></el-form-item>
              <el-form-item label="最近活跃"><el-input-number v-model="form.config.rules.active_days" :min="1" :max="365" controls-position="right" placeholder="不限" /><span class="unit">天</span></el-form-item>
              <el-form-item label="仅公开账号"><el-switch v-model="form.config.rules.public_only" /></el-form-item>
              <el-form-item label="候选国家"><el-select v-model="form.config.rules.candidate_countries" multiple filterable clearable placeholder="不限；未知需人工确认"><el-option v-for="item in countries" :key="item" :value="item" :label="item" /></el-select></el-form-item>
              <el-form-item label="简介至少包含"><el-select v-model="form.config.rules.bio_include" multiple filterable allow-create default-first-option clearable placeholder="输入后回车" /></el-form-item>
              <el-form-item label="正文 / 简介排除词"><el-select v-model="form.config.rules.exclude_words" multiple filterable allow-create default-first-option clearable placeholder="输入后回车" /></el-form-item>
            </div></el-collapse-item>
            <el-collapse-item title="定时与加入监听设置" name="monitor"><div class="plan-form-grid">
              <el-form-item label="每天执行时间"><el-time-picker v-model="form.config.schedule_time" format="HH:mm" value-format="HH:mm" :clearable="false" /><span class="unit">北京时间</span></el-form-item>
              <el-form-item label="新增监听间隔"><el-input-number v-model="form.config.monitor_interval" :min="1" :max="1440" controls-position="right" /><span class="unit">分钟</span></el-form-item>
              <el-form-item label="新增监听标签"><el-select v-model="form.config.monitor_tag_ids" multiple filterable clearable placeholder="不设置"><el-option v-for="item in tags" :key="item.id" :value="item.id" :label="item.name" /></el-select></el-form-item>
              <el-form-item label="新增监听国家"><el-select v-model="form.config.monitor_country" filterable clearable placeholder="不设置"><el-option v-for="item in countries" :key="item" :value="item" :label="item" /></el-select></el-form-item>
            </div></el-collapse-item>
          </el-collapse>
          <el-alert v-if="unavailable.length" :title="`${unavailable.join('、')} 协议或帖子检索能力待配置 / 确认`" type="warning" :closable="false" />
          <div class="protocol-notes"><span v-for="item in capabilities.filter(item=>form.config.platforms.includes(item.platform))" :key="item.platform">{{ discoveryPlatforms[item.platform] }}：{{ item.note }}</span></div>
        </el-form>

        <section v-if="activeTab==='keywords'">
          <div class="keyword-toolbar"><el-select :model-value="keywordId" placeholder="选择关键词版本" @change="changeKeyword"><el-option v-for="item in keywordVersions" :key="item.id" :value="item.id" :label="`${formatDate(item.created_at)} · ${label(item.status)} · ${item.total} 词`" /></el-select><el-button :icon="RefreshCw" :loading="keywordLoading" @click="reloadKeyword">重新加载</el-button><span v-if="keywordVersion">共 {{ words.length }} 个，启用 {{ enabledWords }} 个 / 本轮上限 {{ form.config.max_keywords }}</span></div>
          <el-pagination v-if="keywordTotal>20" v-model:current-page="versionPage" :page-size="20" :total="keywordTotal" layout="total,prev,next" @current-change="loadVersions" />
          <el-alert v-if="keywordError" :title="keywordError" type="error" :closable="false" />
          <el-empty v-if="!keywordVersions.length&&!keywordLoading" description="尚无关键词草案" />
          <template v-if="keywordVersion">
            <div v-if="editableKeywords" class="keyword-toolbar"><el-checkbox :model-value="enabledWords===words.length&&!!words.length" :indeterminate="enabledWords>0&&enabledWords<words.length" :disabled="busy" @change="words.forEach(item=>item.enabled=Boolean($event))">全部启用</el-checkbox><el-input v-model="wordInput" placeholder="新增关键词" maxlength="100" @keyup.enter="addWord" /><el-button :icon="Plus" :disabled="!wordInput.trim()||words.length>=5000" @click="addWord">新增</el-button></div>
            <el-table :data="pageWords" v-loading="keywordLoading" row-key="_key"><el-table-column label="启用" width="72"><template #default="{row}"><el-checkbox v-model="row.enabled" :disabled="!editableKeywords||busy" :aria-label="`启用${row.text}`" /></template></el-table-column><el-table-column label="关键词" min-width="200"><template #default="{row}"><el-input v-if="editableKeywords" v-model="row.text" maxlength="100" :disabled="busy" /><span v-else>{{ row.text }}</span></template></el-table-column><el-table-column label="语言" width="120"><template #default="{row}"><el-input v-if="editableKeywords" v-model="row.language" maxlength="30" :disabled="busy" /><span v-else>{{ row.language||'未标注' }}</span></template></el-table-column><el-table-column label="来源" width="90"><template #default="{row}">{{ row.source==='ai'?'AI 提取':'运营新增' }}</template></el-table-column><el-table-column label="样本依据" width="120"><template #default="{row}"><el-button v-if="row.evidence_ids.length" link type="primary" @click="showEvidence(row)">{{ row.evidence_ids.length }} 篇 <ChevronRight :size="13" /></el-button><span v-else>运营新增</span></template></el-table-column><el-table-column v-if="editableKeywords" label="移除" width="70"><template #default="{row}"><el-tooltip content="移除关键词"><el-button :icon="Trash2" circle aria-label="移除关键词" :disabled="busy" @click="words=words.filter(item=>item._key!==row._key)" /></el-tooltip></template></el-table-column></el-table>
            <el-pagination v-model:current-page="keywordPage" :page-size="50" :total="words.length" background layout="total,prev,pager,next" />
            <div v-if="editableKeywords" class="keyword-toolbar"><el-button :icon="Save" :loading="busy" @click="saveWords(false)">保存草案</el-button><el-button v-if="canReview" :icon="Check" type="primary" :loading="busy" :disabled="!enabledWords||enabledWords>form.config.max_keywords" @click="saveWords(true)">审核通过</el-button></div>
          </template>
        </section>

        <section v-if="activeTab==='runs'">
          <div class="keyword-toolbar"><el-button :icon="RefreshCw" @click="loadRuns">刷新运行记录</el-button></div>
          <el-table :data="runs">
            <el-table-column label="阶段与状态" min-width="220"><template #default="{row}">
              <el-tag :type="row.result.partial?'warning':row.status==='failed'?'danger':row.status==='completed'?'success':'info'">{{ row.result.partial?'部分未完成':label(row.status) }}</el-tag>
              <p>{{ row.result.stage||row.phase }}</p><small v-if="row.result.limited">搜索范围受本轮页数、作者评估上限或协议能力限制</small>
            </template></el-table-column>
            <el-table-column label="进度 / Token" min-width="220"><template #default="{row}">
              <template v-if="row.kind==='analyze'">样本 {{ row.result.counters?.analyzed_posts||0 }} / {{ row.result.counters?.selected_posts||0 }} · 已完成 {{ row.result.completed_batches||0 }} / {{ row.result.total_batches||0 }} 批</template>
              <template v-else-if="row.result.operation==='refresh'">仅刷新作者资料与条件重判</template>
              <template v-else>搜索 {{ row.result.counters?.search_pages||0 }} 页 · 返回 {{ row.result.counters?.returned_posts||0 }} 帖 · 纳入评估 {{ row.result.counters?.discovered_authors||0 }} 位作者</template>
              <small v-if="row.kind==='analyze'">Token {{ Number(row.budget.tokens).toLocaleString('zh-CN') }} / {{ Number(row.budget.max_tokens).toLocaleString('zh-CN') }}</small>
            </template></el-table-column>
            <el-table-column label="具体原因" prop="error_message" min-width="220" />
            <el-table-column label="时间" width="170"><template #default="{row}">{{ formatDate(row.created_at) }}</template></el-table-column>
            <el-table-column label="操作" min-width="180"><template #default="{row}">
              <el-tooltip v-if="row.result.operation!=='refresh'" :content="row.kind==='analyze'?'查看分析样本':'查看各关键词搜索状态'"><el-button :icon="FileSearch" circle :aria-label="row.kind==='analyze'?'查看分析样本':'查看各关键词搜索状态'" @click="showSearches(row)" /></el-tooltip>
              <template v-if="canEdit">
                <el-tooltip v-if="['queued','running'].includes(row.status)" content="暂停本轮"><el-button :icon="Pause" circle aria-label="暂停本轮" :disabled="busy" @click="control(row,'pause')" /></el-tooltip>
                <el-tooltip v-if="['failed','paused'].includes(row.status)||(row.status==='completed'&&row.result.partial)" content="从断点继续"><el-button :icon="Play" circle aria-label="从断点继续" :disabled="busy" @click="control(row,'resume')" /></el-tooltip>
                <el-tooltip v-if="['queued','running','paused','waiting_keywords','failed'].includes(row.status)" content="停止本轮"><el-button :icon="X" circle aria-label="停止本轮" :disabled="busy" @click="control(row,'cancel')" /></el-tooltip>
              </template>
            </template></el-table-column>
          </el-table>
          <el-pagination v-model:current-page="runPage" :page-size="20" :total="runTotal" background layout="total,prev,pager,next" @current-change="loadRuns" />
        </section>
        <AccountDiscoveryCandidates v-if="activeTab==='candidates'&&planId" :plan-id="planId" />
      </div>
      <template #footer><el-button :disabled="busy" @click="closePlan(()=>visible=false)">关闭</el-button><el-button v-if="canEdit&&activeTab==='config'" :icon="Save" type="primary" :loading="busy" :disabled="!form.name.trim()||detailLoading" @click="save">保存计划</el-button><el-button v-if="canEdit&&planId" :icon="FileSearch" :disabled="busy||dirty||wordsDirty||detailLoading" @click="start('analyze')">分析关键词</el-button><el-button v-if="canEdit&&planId" :icon="Play" type="primary" :disabled="busy||dirty||wordsDirty||!detail?.plan.approved_keywords_id||detailLoading" @click="start('search')">开始搜索</el-button></template>
    </el-dialog>

    <el-dialog v-model="searchesVisible" :title="searchRun?.kind==='analyze'?'分析样本明细':'关键词搜索进度'" width="min(900px,calc(100vw - 32px))" align-center @closed="searchRequest++">
      <el-alert v-if="searchesError" :title="searchesError" type="error" :closable="false" />
      <el-radio-group v-if="searchRun?.kind==='analyze'" v-model="sampleSkipped" @change="searchPage=1;loadSearches()"><el-radio-button :value="false">已选样本</el-radio-button><el-radio-button :value="true">已跳过</el-radio-button></el-radio-group>
      <el-table v-if="searchRun?.kind==='search'" :data="searchRows" v-loading="searchesLoading"><el-table-column label="平台" width="120"><template #default="{row}">{{ discoveryPlatforms[row.platform] }}</template></el-table-column><el-table-column label="关键词" prop="keyword" min-width="140" /><el-table-column label="状态" width="140"><template #default="{row}">{{ label(row.status) }}</template></el-table-column><el-table-column label="页数 / 帖子" width="120"><template #default="{row}">{{ row.pages }} / {{ row.posts_count }}</template></el-table-column><el-table-column label="具体原因" prop="error_message" min-width="220" /></el-table>
      <el-table v-else :data="sampleRows" v-loading="searchesLoading"><el-table-column label="来源账号 ID" prop="monitor_id" min-width="180" show-overflow-tooltip /><el-table-column label="正文 / 原因" min-width="300" show-overflow-tooltip><template #default="{row}">{{ row.reason||row.text_content||'无有效正文' }}</template></el-table-column><el-table-column label="原帖" width="100"><template #default="{row}"><a v-if="row.content_url" :href="safeSelectionLink(row.content_url)" target="_blank" rel="noopener noreferrer">原帖</a><span v-else>无可用链接</span></template></el-table-column></el-table>
      <el-pagination v-model:current-page="searchPage" :page-size="50" :total="searchTotal" layout="total,prev,pager,next" @current-change="loadSearches" />
    </el-dialog>
    <el-dialog v-model="evidenceVisible" title="关键词样本依据" width="min(760px,calc(100vw - 32px))" align-center><div class="keyword-evidence"><article v-for="post in evidencePosts" :key="post.id"><small>{{ discoveryPlatforms[post.platform||'']||'本轮样本' }} · {{ post.id }}</small><p>{{ post.text_content }}</p><small v-if="post.truncated">正文已截取</small><a v-if="post.content_url" :href="safeSelectionLink(post.content_url)" target="_blank" rel="noopener noreferrer">原帖</a></article></div></el-dialog>
  </section>
</template>

<style scoped>
:global(.discovery-plan-dialog){display:flex;flex-direction:column;max-height:calc(100dvh - 32px)}
:global(.discovery-plan-dialog .el-dialog__body){min-height:0;overflow-y:auto}
:global(.discovery-plan-dialog .el-dialog__header),:global(.discovery-plan-dialog .el-dialog__footer){flex-shrink:0}
:global(.discovery-plan-dialog .el-dialog__title){display:block;overflow-wrap:anywhere;padding-right:24px}
@media(max-width:600px){.plan-form-grid :deep(.el-form-item){display:block}.plan-form-grid :deep(.el-form-item__label){display:block;width:auto!important;height:auto;line-height:22px;text-align:left;padding:0 0 6px}.plan-form-grid :deep(.el-form-item__content){margin-left:0!important}}
.discovery-toolbar,.keyword-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:14px}.discovery-toolbar>.el-input,.keyword-toolbar>.el-input{width:230px;max-width:100%}.create-plan{margin-left:auto}.el-pagination{margin-top:16px;overflow-x:auto}.el-tag+.el-tag{margin-left:5px}small{display:block;color:var(--app-text-muted,#687786);font-size:12px;margin-top:4px;overflow-wrap:anywhere}.plan-detail{min-height:180px;max-height:68vh;overflow-y:auto;overflow-wrap:anywhere}.plan-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px;padding:8px 0}.plan-form-grid :deep(.el-form-item){min-width:0}.plan-form-grid :deep(.el-form-item__content){min-width:0;gap:6px}.el-form :deep(.el-select){width:100%}.plan-form-grid :deep(.el-input-number){width:180px;max-width:100%}.plan-form-grid :deep(.el-date-editor){width:160px;max-width:100%}.unit{color:var(--app-text-muted,#687786);font-size:12px}.protocol-notes{display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--app-text-muted,#687786);padding-top:12px}.keyword-toolbar .el-select{width:370px;max-width:100%}.keyword-toolbar>span{font-size:13px}.keyword-evidence{max-height:65vh;overflow-y:auto;overflow-wrap:anywhere}.keyword-evidence article{padding:12px 0;border-bottom:1px solid var(--app-border,#dce3eb)}.keyword-evidence p{white-space:pre-wrap;line-height:1.65}.keyword-evidence a{color:var(--el-color-primary)}:deep(.el-button>span){gap:5px}@media(max-width:800px){.plan-form-grid{grid-template-columns:minmax(0,1fr)}.create-plan{margin-left:0}.discovery-toolbar>.el-input{flex:1;min-width:150px}}
</style>
