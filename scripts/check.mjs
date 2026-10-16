import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {models,sources,fieldDefinitions,snapshot as checked} from '../data/catalog.mjs';
const root=new URL('../',import.meta.url);
const authorNamespaces=new Set(['deepseek-ai','moonshotai','openai','Qwen','zai-org','MiniMaxAI','internlm','OpenGVLab','baidu','tencent','inclusionAI','google','Cloudflare','FlashLabs','IFM','IQuestLab','LiquidAI','XiaomiMiMo','ai-sage','deepreinforce-ai','dots-studio','ibm-granite','meituan-longcat','meta-llama','meta-models','mistralai','nvidia','openbmb','perplexity-ai','poolside','stepfun-ai','thinkingmachines']);
const allowed=[['huggingface.co',p=>authorNamespaces.has(p.split('/')[1])],['arxiv.org',p=>/^\/html\/2505\.09388v1/.test(p)],['www.qwencloud.com',p=>/^\/models\/qwen3\.[678]-/.test(p)],['docs.sglang.io',p=>p.startsWith('/cookbook/autoregressive/')],['docs.vllm.ai',p=>p.startsWith('/en/latest/models/supported_models/')],['recipes.vllm.ai',p=>p==='/zai-org/GLM-5.2'],['docs.z.ai',p=>p==='/guides/vlm/glm-5.3-flash'],['ai.meta.com',p=>p.startsWith('/blog/')]];
const ids=new Set();let fields=0,known=0;
for(const s of Object.values(sources)){const url=new URL(s.url);assert.equal(url.protocol,'https:');assert(allowed.some(([host,path])=>host===url.hostname&&path(url.pathname)),'不在已核实官方发布方列表：'+s.url);assert.match(s.checked,/^\d{4}-\d{2}-\d{2}$/);assert(s.checked<=checked);}
for(const m of models){assert(!ids.has(m.id));ids.add(m.id);assert(sources[m.card]);if(m.access==='api'||m.configAvailability==='gated')assert.equal(m.config,null);else assert(sources[m.config]);for(const k of ['total','active','arch','routed','selected','shared','weight','quantization','speculative','context'])assert(m.fields[k],m.name+' 缺少 '+k);for(const [k,f] of Object.entries(m.fields)){assert(fieldDefinitions[k]);assert(f.sources.length>0);assert(f.sources.every(id=>sources[id]));assert(f.locator);assert(f.checked);assert(['verified','config','framework','derived','not_found','not_applicable'].includes(f.status));assert.equal(f.value===null,['not_found','not_applicable'].includes(f.status));if(f.status==='derived'){assert(f.derivation?.premises?.length>=2);assert(f.scope);assert(f.note);}fields++;if(f.value!==null)known++;}if(m.fields.arch.value==='MoE'){if(typeof m.fields.routed.value==='number'&&typeof m.fields.selected.value==='number')assert(m.fields.routed.value>=m.fields.selected.value);if(typeof m.fields.total.value==='number'&&typeof m.fields.active.value==='number')assert(m.fields.total.value>=m.fields.active.value);}else if(m.fields.arch.value==='Dense') for(const k of ['routed','selected','shared'])assert.equal(m.fields[k].status,'not_applicable');}
const generated=JSON.parse(readFileSync(new URL('dist/data.json',root),'utf8'));assert.deepEqual(generated.models,models);assert.deepEqual(generated.sources,sources);assert.equal(generated.checked,checked);
// 检查会改变比较含义的口径，避免把版本名取整值写进正式字段。
assert.equal(models.find(m=>m.name==='Qwen3-30B-A3B').fields.total.value,30.5);
assert.equal(models.find(m=>m.name==='Qwen3-32B').fields.total.value,32.8);
assert.equal(models.find(m=>m.name==='MiniMax-M2.5').fields.total.status,'not_found');
assert.equal(models.find(m=>m.name==='DeepSeek-V4-Flash-0731').fields.speculative.value,'DSpark');
assert.notEqual(models.find(m=>m.name==='DeepSeek-V4-Flash').fields.speculative.value,'DSpark');
assert.equal(models.find(m=>m.name==='DeepSeek-V4-Flash-0731').fields.total.status,'derived');
assert.equal(models.find(m=>m.name==='DeepSeek-V4-Flash-0731').fields.total.value,284);
assert.equal(models.find(m=>m.name==='Qwen3.7-Plus').config,null);
assert.equal(models.find(m=>m.name==='Qwen3.7-Plus').fields.total.value,null);
assert.equal(models.find(m=>m.name==='Intern-S1').fields.total.status,'derived');
assert(models.length>=88);
assert.equal(models.find(m=>m.name==='GLM-5.2').fields.total.status,'framework');
assert.equal(models.find(m=>m.name==='GLM-5.3-FlashX').fields.total.value,null);
assert.equal(models.find(m=>m.name==='GLM-5.3-FlashX').access,'api');
assert.equal(models.find(m=>m.name==='GLM-5.3-Flash').fields.total.value,320);
assert.equal(models.find(m=>m.name==='Inkling').fields.total.value,975);
assert.equal(models.find(m=>m.name==='LFM2.5-8B-A1B').fields.active.value,1.5);
const index=generated.frameworkIndex;assert(index.entries.length>=690);assert(index.sglang.pages>=112);assert(index.vllm.rows>=225);
const indexIds=new Set();for(const x of index.entries){assert(!indexIds.has(x.key));indexIds.add(x.key);if(x.modelId)assert(ids.has(x.modelId));assert(x.evidence.length);for(const e of x.evidence){const url=new URL(e.url);assert(['docs.sglang.io','docs.vllm.ai','recipes.vllm.ai'].includes(url.hostname));assert(['recipe','example','template','placeholder','hybrid','draft_reference','architecture'].includes(e.level));}}
for(const m of models)for(const k of ['sglang','vllm']){const f=m.fields[k];assert(f);assert(f.runtimeTested===false||m.access==='api'||f.checked>'2026-10-15');if(f.supportLevel==='architecture')assert(m.architectures?.length);}
assert(index.entries.find(x=>x.name==='InternVL3.5').evidence.every(e=>e.level==='placeholder'));
console.log(JSON.stringify({ok:true,models:models.length,sources:Object.keys(sources).length,fields,known,snapshot:checked}));
