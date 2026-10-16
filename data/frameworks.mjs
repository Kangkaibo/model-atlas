import {readFileSync} from 'node:fs';
const read=name=>JSON.parse(readFileSync(new URL(name,import.meta.url),'utf8'));
export const frameworkIndex=read('./framework-index.json');
for(const entry of frameworkIndex.entries)for(const evidence of entry.evidence)evidence.checked??=frameworkIndex.checked;
const expansion=read('./framework-expansion.json'), glm=read('./glm-expansion.json'), inspected=read('./inspected-configs.json'), extra=read('./extra-parameter-facts.json');
export function addFrameworkModels({models,sources,source,f,u,na,checked}){
 const register=(url,title,vendor,kind='官方模型卡',sha)=>{
  if(url.includes('docs.vllm.ai'))title='vLLM · 官方支持模型表';else if(url.includes('docs.sglang.io'))title='SGLang · '+url.split('/').at(-1);else if(url.includes('recipes.vllm.ai'))title='vLLM · GLM-5.2 官方部署 recipe';else if(url.includes('huggingface.co'))title=url.split('/')[4]+' · '+(url.includes('config.json')?'官方配置':'作者模型卡');
  const existing=Object.values(sources).find(s=>s.url===url);if(existing)return existing.id;
  const id=source(url,title,vendor,kind);if(sha)sources[id].revision=sha;return id;
 };
 const create=(repo,vendor,sha,description,hasConfig=true)=>{
  const card=register('https://huggingface.co/'+repo+'/blob/'+sha+'/README.md',repo+' · 作者模型卡',vendor,'官方模型卡',sha);
  const config=hasConfig?register('https://huggingface.co/'+repo+'/blob/'+sha+'/config.json',repo+' · 官方配置',vendor,'官方配置',sha):null;
  const m={id:repo.toLowerCase().replaceAll('/','--').replaceAll('.','-'),name:repo.split('/')[1],repo,vendor,access:'weights',description,checked,card,config,fields:{},configAvailability:hasConfig?'read':'gated'};
  for(const key of ['total','active','arch','routed','selected','shared','weight','quantization','speculative','context','layers','auxiliary'])m.fields[key]=u(card,hasConfig?'本次已查阅作者模型卡与配置，未找到本字段的明确披露；不按名称、相近版本或文件大小补填。':'公开配置需要访问权限，本次未读取；未凭名称补填。');
  models.push(m);return m;
 };
 for(const r of expansion){
  const vendorMap={'internlm':'书生','OpenGVLab':'书生','inclusionAI':'蚂蚁 Ling','tencent':'混元 Hunyuan','stepfun-ai':'StepFun','ai-sage':'GigaChat','thinkingmachines':'Thinking Machines','meta-llama':'Meta Llama','meta-models':'Meta Muse','meituan-longcat':'LongCat','nvidia':'NVIDIA','mistralai':'Mistral','openbmb':'OpenBMB'};
  const m=create(r.repo,vendorMap[r.repo.split('/')[0]]||r.repo.split('/')[0],r.sha,r.description,r.configAvailable);m.architectures=r.architectures;
  for(const [key,v] of Object.entries(r.fields))m.fields[key]=f(v.value,v.status==='config'?m.config:(/config|num_nextn|max_position/i.test(v.locator)||m.repo==='IQuestLab/IQuest-Q1'&&key==='speculative')?[m.card,m.config].filter(Boolean):m.card,v.locator,v.note,v.status);
 }
 for(const r of glm){
  const isApi=r.kind==='official-api-variant',repo='zai-org/'+r.name;
  let m=models.find(x=>x.repo===repo);
  if(isApi){const card=register('https://docs.z.ai/guides/vlm/glm-5.3-flash','GLM-5.3-Flash / FlashX · 官方 API 文档','GLM','官方API文档');m={id:'glm-5-3-flashx',name:r.name,repo:'glm-5.3-flashx',vendor:'GLM',access:'api',card,config:null,checked,description:'FlashX 是官方 API 服务标识。未发现独立公开权重配置，不能直接继承 Flash 的参数、专家或量化。',aliases:r.aliases,fields:{}};for(const k of ['total','active','arch','routed','selected','shared','weight','quantization','speculative','context','layers','auxiliary'])m.fields[k]=u(card,'未独立披露 FlashX 的此项规格；同页 Flash 数据不直接套用。');models.push(m);}
  else if(!m)m=create(repo,'GLM',r.revision,'GLM 独立版本；区分作者披露、官方配置和框架文档中的参数口径。');
  if(!isApi&&r.revision){m.card=register('https://huggingface.co/'+repo+'/blob/'+r.revision+'/README.md',r.name+' · 作者模型卡','GLM','官方模型卡',r.revision);m.config=register('https://huggingface.co/'+repo+'/blob/'+r.revision+'/config.json',r.name+' · 官方配置','GLM','官方配置',r.revision);}
  const map={totalParamsB:'total',activeParamsB:'active',routedExperts:'routed',selectedExperts:'selected',sharedExperts:'shared',contextTokens:'context',layers:'layers',weightDtype:'weight',speculation:'speculative',officialQuantization:'quantization'};
  for(const [key,target] of Object.entries(map)){
   const v=r.fields[key];if(!v)continue;let url=v.source;
   if(r.revision&&url.startsWith('https://huggingface.co/'+repo+'/'))url=url.replace('/blob/main/','/blob/'+r.revision+'/');
   const kind=url.includes('recipes.vllm.ai')?'框架官方文档':url.includes('config.json')?'官方配置':isApi?'官方API文档':'官方模型卡';
   const sid=register(url,r.name+' · '+key,'GLM',kind,url.includes(r.revision)?r.revision:undefined);
   if(v.value===null){m.fields[target]=u(sid,v.note||'本次来源未独立披露。');continue;}
   if(v.status==='官方关系推导'){
    const recipe=register('https://recipes.vllm.ai/zai-org/GLM-5.2','vLLM · GLM-5.2 recipe','vLLM','框架官方文档');
    const fact=f(v.value,[sid,recipe],'README / same base；vLLM recipe / model overview',v.note,'derived');
    fact.scope='与GLM-5.2同base的主模型近似口径；非完整检查点统计';
    fact.derivation={premises:['GLM-5.3 作者明确说明基于与GLM-5.2相同的base。','vLLM的GLM-5.2 recipe写约743B总量、39B激活。'],resultScope:fact.scope,limitation:'来源链包含框架文档数值；不证明附加MTP或所有张量的完整参数量。'};m.fields[target]=fact;
   }else m.fields[target]=f(v.value,sid,kind==='官方配置'?(r.name==='GLM-5.3-Flash'?'text_config.':'')+({routedExperts:'n_routed_experts',selectedExperts:'num_experts_per_tok',sharedExperts:'n_shared_experts',layers:'num_hidden_layers',contextTokens:'max_position_embeddings',weightDtype:'dtype / quantization_config',speculation:'num_nextn_predict_layers',officialQuantization:'quantization_config'}[key]||key):'README / model overview / '+key,v.note||'',kind==='框架官方文档'?'framework':kind==='官方配置'?'config':'verified');
  }
  const moe=r.fields.isMoE;if(moe?.value!==null&&moe?.value!==undefined)m.fields.arch=f(moe.value?'MoE':'Dense',m.config||m.card,'model_type / routed experts','语言主干；多模态组件另读。',m.config?'config':'verified');
  if(r.fields.architecture)m.architectures=[r.fields.architecture.value.split(' / ')[0]];
  if(m.name==='GLM-5.2')m.fields.total.scope='vLLM 文档近似口径；非checkpoint张量总数';
  if(r.fields.mtpLayers)m.fields.auxiliary=f('MTP配置 '+r.fields.mtpLayers.value+' 层',m.config,'num_nextn_predict_layers','不等于运行时每轮草稿 token 数。','config');
  if(isApi)m.fields.auxiliary=f('API 高速变体；最大输出128K',m.card,'GLM-5.3-FlashX / specifications','API 发布说明，不推断权重结构。');
 }
 const extraMap={totalParamsB:'total',activeParamsB:'active',routedExperts:'routed',selectedExperts:'selected',sharedExperts:'shared',layers:'layers',contextTokens:'context',officialQuantization:'quantization'};
 for(const r of extra){const m=models.find(x=>x.repo===r.repo);if(!m)continue;for(const v of r.facts){let key=extraMap[v.field];if(v.field==='mtpLayers')key='speculative';if(!key)continue;if(v.value===null){m.fields[key]=u(m.card,v.boundary||'本次未明确披露');continue;}const config=v.sourceUrl.includes('config.json');const sid=register(v.sourceUrl,m.name+' · '+v.field,m.vendor,config?'官方配置':'官方模型卡',r.sha);m.fields[key]=f(v.field==='mtpLayers'?'MTP · 配置 '+v.value+' 层':v.value,sid,v.location,v.boundary,config?'config':'verified');}if(m.fields.routed.value>0)m.fields.arch=f('MoE',m.fields.routed.sources,m.fields.routed.locator,'按作者专家结构。');}
 const qwen=models.find(m=>m.repo==='Qwen/Qwen3.8-2.4T-A95B');if(qwen)qwen.fields.shared=f(1,qwen.card,'README / Model Overview / Experts','作者写1个共享专家，不从FFN宽度直接换算。');
 for(const m of models){
  if(m.fields.arch.value==='Dense'){for(const key of ['routed','selected','shared'])m.fields[key]=na(m.fields.arch.sources,'Dense语言主干，不适用MoE专家数量。');if(m.fields.active.value===null)m.fields.active=na(m.fields.arch.sources,'Dense未单列逐token激活参数，不以总参数直接替代。');}
  const conf=inspected.find(x=>x.repo===m.repo);if(conf?.architectures?.length&&!m.architectures?.length)m.architectures=conf.architectures;
  for(const framework of ['SGLang','vLLM']){
   const key=framework.toLowerCase();if(m.access==='api'){m.fields[key]=na(m.card,'API服务未提供独立公开checkpoint，此处本地框架适配不适用。');continue;}
   const hits=frameworkIndex.entries.filter(x=>x.repo?.toLowerCase()===m.repo.toLowerCase()).flatMap(x=>x.evidence).filter(x=>x.framework===framework);
   const best=hits.find(x=>['recipe','example'].includes(x.level))||hits.find(x=>x.level==='template')||hits[0];
   let ev=best,label=best?{recipe:'有部署示例',example:'官方表格示例',template:'官方模板选项',placeholder:'仅目录占位',hybrid:'混合服务架构'}[best.level]:null;
   if(!ev&&framework==='vLLM'){const row=frameworkIndex.architectureRows.find(x=>(m.architectures||[]).some(a=>x.architectures.includes(a)));if(row){ev={url:row.url,locator:row.architecture,note:'官方表列出相同配置架构，未列该具体checkpoint；不推断所有版本、量化或特性可用。',level:'architecture'};label='架构已列';}}
   if(m.name==='GLM-5.2'&&framework==='vLLM'){ev={url:'https://recipes.vllm.ai/zai-org/GLM-5.2',locator:'GLM-5.2 deployment recipe',note:'独立vLLM官方recipe，比支持表中的架构级匹配更具体；未本机实测。',level:'recipe'};label='有部署示例';}
   const url=ev?.url||(framework==='SGLang'?frameworkIndex.sglang.url:frameworkIndex.vllm.url);
   const sid=register(url,framework+' · '+(ev?.locator||'官方模型目录'),framework,'框架官方文档');
   const refs=ev?.level==='architecture'?[sid,register(conf?.architectures?.length&&JSON.stringify(conf.architectures)===JSON.stringify(m.architectures)?'https://huggingface.co/'+m.repo+'/blob/'+conf.sha+'/config.json':sources[m.config].url,m.name+' · 架构匹配配置',m.vendor,'官方配置',conf?.sha)]:sid;
   m.fields[key]=ev?f(label,refs,ev.locator,ev.note,'framework'):u(sid,'仅表示本次所查目录未列出该checkpoint或已核实架构，不等于框架不支持；可能另有新recipe或后端实现。');
   m.fields[key].supportLevel=ev?.level||'not_listed';m.fields[key].runtimeTested=false;
  }
 }
 for(const x of frameworkIndex.entries){const m=models.find(m=>m.repo.toLowerCase()===x.repo?.toLowerCase());x.modelId=m?.id||null;if(!m)continue;for(const engine of ['SGLang','vLLM']){const fact=m.fields[engine.toLowerCase()];if(!['architecture','recipe'].includes(fact.supportLevel)||x.evidence.some(e=>e.framework===engine&&['recipe','example','template'].includes(e.level)))continue;x.evidence.push({framework:engine,level:fact.supportLevel,url:sources[fact.sources[0]].url,locator:fact.locator,note:fact.note,role:'target',relationship:'按已核实的具体模型配置匹配架构；具体checkpoint另读原文',architectures:m.architectures||[],configUrl:fact.supportLevel==='architecture'?sources[fact.sources[1]].url:null});}}
 const used=new Set(models.flatMap(m=>[m.card,m.config,...Object.values(m.fields).flatMap(f=>f.sources)]));for(const id of Object.keys(sources))if(!used.has(id))delete sources[id];
}
