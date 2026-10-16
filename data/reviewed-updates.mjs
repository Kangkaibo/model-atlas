import {createHash} from 'node:crypto';

const keys=new Set(['total','active','arch','routed','selected','shared','weight','quantization','speculative','context','layers','auxiliary','sglang','vllm']);
const statuses=new Set(['verified','config','framework','derived','not_found','not_applicable']);
const validDate=date=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;

export function applyReviewedUpdates(models,sources,changes){
 const register=(raw,date)=>{
  if(typeof raw==='string'){if(!sources[raw])throw Error('Unknown source ID: '+raw);return raw;}
  if(!raw?.url||!raw.title||!raw.vendor)throw Error('A reviewed source needs URL, title and vendor.');
  const url=new URL(raw.url);if(url.protocol!=='https:')throw Error('Official evidence must use HTTPS.');
  const checked=raw.checked||date;if(!validDate(checked))throw Error('Invalid source review date.');
  const id='r'+createHash('sha256').update(JSON.stringify([raw.url,raw.revision||'online',checked])).digest('hex').slice(0,18);
  sources[id]={id,url:raw.url,title:raw.title,vendor:raw.vendor,kind:raw.kind||'官方模型卡',revision:raw.revision||'在线页面；未固定提交',checked};return id;
 };
 for(const change of changes){
  if(!validDate(change.checked))throw Error('Each reviewed update needs its real checked date.');
  let m=models.find(m=>m.repo===change.repo);
  if(!m){
   const meta=change.model;if(!meta?.id||!meta.name||!meta.vendor||!meta.card||!['weights','api'].includes(meta.access))throw Error('A new record requires explicit model metadata: '+change.repo);
   m={...meta,repo:change.repo,checked:change.checked,card:register(meta.card,change.checked),config:meta.config?register(meta.config,change.checked):null,fields:{}};models.push(m);
  }
  for(const [key,raw] of Object.entries(change.fields||{})){
   if(!keys.has(key)||!statuses.has(raw.status)||!raw.locator||!raw.sources?.length||!Object.hasOwn(raw,'value'))throw Error('Incomplete reviewed field: '+key);
   const checked=raw.checked||change.checked;if(!validDate(checked))throw Error('Invalid field review date.');
   if((raw.value===null)!==['not_found','not_applicable'].includes(raw.status))throw Error('Unknown values need explicit status: '+key);
   if(raw.status==='derived'&&(!raw.scope||!(raw.derivation?.premises?.length>=2)||!raw.note))throw Error('Derived values need scope and premises.');
   m.fields[key]={...raw,sources:raw.sources.map(s=>register(s,checked)),checked};
  }
  if(change.description)m.description=change.description;
  if(change.aliases)m.aliases=change.aliases;
  m.checked=[m.checked,...Object.values(m.fields).map(f=>f.checked)].sort().at(-1);
 }
 return [...models.map(m=>m.checked),...models.flatMap(m=>Object.values(m.fields).map(f=>f.checked))].sort().at(-1);
}
