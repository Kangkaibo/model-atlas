// Discovery is deliberately kept separate from reviewed parameter facts.
export function coverageAudit(raw,models,index,sources){
 const ready=new Map(models.map(m=>[m.repo.toLowerCase(),m]));
 const entries=new Map();
 for(const inventory of raw.inventories)for(const row of inventory.entries){
  const key=row.repo.toLowerCase();
  entries.set(key,{...row,publisher:row.publisher||inventory.publisher,name:row.repo.split('/').at(-1),origin:'author_inventory',inventoryStale:!!inventory.stale,modelId:ready.get(key)?.id||null,frameworks:[]});
 }
 for(const x of index.entries){
  const key=(x.repo||x.key).toLowerCase();
  if(!entries.has(key))entries.set(key,{repo:x.repo,name:x.name,publisher:x.publisher,url:x.repo?'https://huggingface.co/'+x.repo:x.evidence[0].url,origin:'framework_reference',modelId:x.modelId,frameworks:[]});
  entries.get(key).frameworks=x.evidence.map(e=>({framework:e.framework,level:e.level,url:e.url}));
 }
 for(const m of models){const key=m.repo.toLowerCase();if(!entries.has(key))entries.set(key,{repo:m.repo,name:m.name,publisher:m.repo.split('/')[0],url:sources[m.card].url,origin:'curated',modelId:m.id,frameworks:[]});}
 for(const x of entries.values()){
  // These labels organize a queue; they do not assert architecture or independent release identity.
  x.queueType=/draft|eagle|mtp|dflash|dspark/i.test(x.name)?'draft_hint':/fp8|fp4|int4|int8|gguf|awq|gptq|bnb|mxfp4/i.test(x.name)?'variant_hint':/base|preview|experimental/i.test(x.name)?'base_preview_hint':'model_candidate';
 }
 return {...raw,inventories:raw.inventories.map(({entries,...rest})=>({...rest,repositories:entries.length})),entries:[...entries.values()].sort((a,b)=>Number(!!a.modelId)-Number(!!b.modelId)||a.publisher.localeCompare(b.publisher)||a.name.localeCompare(b.name))};
}
